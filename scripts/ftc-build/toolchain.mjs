import fs from 'fs';
import path from 'path';
import {
  log,
  mkdirp,
  rmrf,
  toolchainRoot,
  downloadFile,
  extractAny,
  extractZip,
  extractTarGz,
  runProcess,
  fetchJson,
  readFileIfExists,
  withFileLock,
} from './util.mjs';
import { detectProject, jdkCandidatesFor } from './detect.mjs';
import { memoryAwareJvmArgs } from './util.mjs';

export function detectHost() {
  const platform = process.platform;
  const arch = process.arch;
  return {
    platform,
    arch,
    btOs: platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macosx' : 'linux',
    temurinOs: platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux',
    temurinArch: arch === 'arm64' ? 'aarch64' : 'x64',
    isLinuxArm64: platform === 'linux' && arch === 'arm64',
    exe: platform === 'win32' ? '.exe' : '',
  };
}

export const host = detectHost();

export function androidSdkRoot() {
  return path.join(toolchainRoot(), 'android-sdk');
}

export function gradleHome() {
  return path.join(toolchainRoot(), 'gradle-home');
}

export function downloadsDir() {
  return path.join(toolchainRoot(), 'downloads');
}

// ---------------------------------------------------------------------------
// JDK (Temurin)
// ---------------------------------------------------------------------------

function findJdkHome(majorDir) {
  let entries = [];
  try {
    entries = fs.readdirSync(majorDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const candidate = path.join(majorDir, e.name);
    if (fs.existsSync(path.join(candidate, 'bin', `java${host.exe}`))) return candidate;
  }
  return null;
}

export async function ensureJdk(major, onProgress = () => {}) {
  return withFileLock(path.join(toolchainRoot(), '.locks', `jdk-${major}.lock`), async () => {
    const majorDir = path.join(toolchainRoot(), 'jdk', String(major));
    const marker = path.join(majorDir, '.ready');
    const existing = findJdkHome(majorDir);
    if (existing && fs.existsSync(marker)) return existing;
    rmrf(majorDir);
    mkdirp(majorDir);
    onProgress(`Downloading JDK ${major} for ${host.temurinOs}/${host.temurinArch}...`);
    const ext = host.platform === 'win32' ? 'zip' : 'tar.gz';
    const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${host.temurinOs}/${host.temurinArch}/jdk/hotspot/normal/eclipse`;
    const dest = path.join(downloadsDir(), `temurin-${major}-${host.temurinOs}-${host.temurinArch}.${ext}`);
    if (!fs.existsSync(dest)) await downloadFile(url, dest, { onProgress: (r, t) => onProgress(`Downloading JDK ${major}... ${Math.round((r / Math.max(t, 1)) * 100)}%`) });
    onProgress(`Extracting JDK ${major}...`);
    if (ext === 'zip') extractZip(dest, majorDir);
    else extractTarGz(dest, majorDir);
    const home = findJdkHome(majorDir);
    if (!home) throw new Error(`JDK ${major} extraction failed: no java binary found`);
    fs.writeFileSync(marker, new Date().toISOString());
    return home;
  });
}

// ---------------------------------------------------------------------------
// Android SDK components (platforms + build-tools) via the official repo XML
// ---------------------------------------------------------------------------

const REPO_XML_URLS = [
  'https://dl.google.com/android/repository/repository2-3.xml',
  'https://dl.google.com/android/repository/repository2-2.xml',
];

let repoXmlCache = null;

async function fetchRepoXml() {
  if (repoXmlCache) return repoXmlCache;
  let lastErr = null;
  for (const url of REPO_XML_URLS) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'code-canvas-ftc-builder' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      repoXmlCache = await res.text();
      return repoXmlCache;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Failed to fetch Android repository XML: ${lastErr?.message || 'unknown'}`);
}

function packageBlock(xml, pkgPath) {
  const escaped = pkgPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<remotePackage[^>]*path="${escaped}"[^>]*>([\\s\\S]*?)<\\/remotePackage>`);
  const m = xml.match(re);
  return m ? m[1] : null;
}

function archiveUrls(block) {
  return [...block.matchAll(/<url>([^<]+)<\/url>/g)].map((m) => m[1]);
}

async function resolveArchiveUrl(pkgPath) {
  const xml = await fetchRepoXml();
  const block = packageBlock(xml, pkgPath);
  if (!block) throw new Error(`Android package not found in repository XML: ${pkgPath}`);
  const urls = archiveUrls(block);
  if (urls.length === 0) throw new Error(`No archive URL for Android package: ${pkgPath}`);
  let url = urls.find((u) => u.includes(`-${host.btOs}.zip`)) || urls[0];
  if (!/^https?:/.test(url)) url = `https://dl.google.com/android/repository/${url}`;
  return url;
}

async function chmodExecutables(dir) {
  if (host.platform === 'win32') return;
  const walk = (d) => {
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          fs.chmodSync(full, 0o755);
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(dir);
}

async function extractWithInnerDir(zipPath, destDir) {
  const staging = `${destDir}.tmp`;
  rmrf(staging);
  mkdirp(staging);
  extractZip(zipPath, staging);
  let entries = [];
  try {
    entries = fs.readdirSync(staging);
  } catch {
    entries = [];
  }
  if (entries.length === 1 && fs.statSync(path.join(staging, entries[0])).isDirectory()) {
    const inner = path.join(staging, entries[0]);
    rmrf(destDir);
    fs.renameSync(inner, destDir);
    rmrf(staging);
  } else {
    rmrf(destDir);
    fs.renameSync(staging, destDir);
  }
}

export async function ensurePlatform(apiLevel, onProgress = () => {}) {
  return withFileLock(path.join(toolchainRoot(), '.locks', `platform-${apiLevel}.lock`), async () => {
    const api = String(apiLevel);
    const pkgPath = `platforms;android-${api}`;
    const destDir = path.join(androidSdkRoot(), 'platforms', `android-${api}`);
    const marker = path.join(destDir, '.ready');
    if (fs.existsSync(marker) && fs.existsSync(path.join(destDir, 'android.jar'))) return destDir;
    const url = await resolveArchiveUrl(pkgPath);
    const fileName = url.split('/').pop();
    const zipPath = path.join(downloadsDir(), fileName);
    onProgress(`Downloading Android platform ${api}...`);
    if (!fs.existsSync(zipPath)) await downloadFile(url, zipPath, { onProgress: (r, t) => onProgress(`Downloading Android platform ${api}... ${Math.round((r / Math.max(t, 1)) * 100)}%`) });
    await extractWithInnerDir(zipPath, destDir);
    if (!fs.existsSync(path.join(destDir, 'android.jar'))) throw new Error(`Platform ${api} missing android.jar`);
    fs.writeFileSync(marker, new Date().toISOString());
    return destDir;
  });
}

export function buildToolsDir(version) {
  return path.join(androidSdkRoot(), 'build-tools', version);
}

async function overlayArm64Natives(btDir, onProgress) {
  onProgress('Installing ARM64 build-tools natives (aapt2/zipalign/aidl/split-select)...');
  const release = await fetchJson('https://api.github.com/repos/Commit451/android-arm-build-tools/releases/latest');
  const assets = (release.assets || []).map((a) => a.browser_download_url);
  const wanted = ['aapt2', 'zipalign', 'aidl', 'split-select'];
  const shaAsset = assets.find((u) => /SHA256SUMS$/i.test(u.split('/').pop() || ''));
  let sumsText = '';
  if (shaAsset) {
    const res = await fetch(shaAsset, { redirect: 'follow', headers: { 'User-Agent': 'code-canvas-ftc-builder' } });
    if (res.ok) sumsText = await res.text();
  }
  for (const name of wanted) {
    const url = assets.find((u) => (u.split('/').pop() || '').toLowerCase() === name.toLowerCase());
    if (!url) throw new Error(`Commit451 release ${release.tag_name} is missing ${name} asset`);
    const tmp = path.join(downloadsDir(), `arm-${name}`);
    await downloadFile(url, tmp);
    if (sumsText) {
      const expected = sumsText
        .split('\n')
        .find((line) => line.toLowerCase().endsWith(name.toLowerCase()))
        ?.split(/\s+/)[0];
      const { createHash } = await import('crypto');
      const actual = createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
      if (expected && expected.toLowerCase() !== actual) {
        throw new Error(`SHA256 mismatch for ${name} (expected ${expected}, got ${actual})`);
      }
    }
    const out = path.join(btDir, name);
    fs.copyFileSync(tmp, out);
    fs.chmodSync(out, 0o755);
  }
  const aapt2Path = path.join(btDir, 'aapt2');
  const check = await runProcess(aapt2Path, ['version'], { timeoutMs: 60000 });
  if (check.code !== 0) {
    throw new Error(`ARM64 aapt2 overlay is not executable: ${(check.stderr || check.stdout).slice(0, 300)}`);
  }
  onProgress('ARM64 build-tools natives verified (aapt2 ' + (check.stdout || '').trim().split('\n')[0] + ')');
}

export async function ensureBuildTools(version, onProgress = () => {}) {
  return withFileLock(path.join(toolchainRoot(), '.locks', `build-tools-${version}.lock`), async () => {
    const ver = String(version);
    const btDir = buildToolsDir(ver);
    const marker = path.join(btDir, '.ready');
    if (fs.existsSync(marker) && fs.existsSync(path.join(btDir, 'aapt2'))) return btDir;
    const pkgPath = `build-tools;${ver}`;
    const url = await resolveArchiveUrl(pkgPath);
    const fileName = url.split('/').pop();
    const zipPath = path.join(downloadsDir(), fileName);
    onProgress(`Downloading Android build-tools ${ver}...`);
    if (!fs.existsSync(zipPath)) await downloadFile(url, zipPath, { onProgress: (r, t) => onProgress(`Downloading Android build-tools ${ver}... ${Math.round((r / Math.max(t, 1)) * 100)}%`) });
    await extractWithInnerDir(zipPath, btDir);
    if (!fs.existsSync(path.join(btDir, 'aapt2'))) throw new Error(`build-tools ${ver} missing aapt2`);
    // fflate does not preserve zip exec bits — make every tool executable.
    await chmodExecutables(btDir);
    if (host.isLinuxArm64) {
      await overlayArm64Natives(btDir, onProgress);
    } else {
      const check = await runProcess(path.join(btDir, 'aapt2'), ['version'], { timeoutMs: 60000 });
      if (check.code !== 0) throw new Error(`aapt2 not executable: ${(check.stderr || check.stdout).slice(0, 300)}`);
    }
    fs.writeFileSync(marker, new Date().toISOString());
    return btDir;
  });
}

export async function ensureLicenses() {
  const dir = path.join(androidSdkRoot(), 'licenses');
  mkdirp(dir);
  const content = [
    'android-sdk-license',
    '8933bad161af4178b1185d1a37fbf41ea5269c55',
    'd56f5187479451eabf01fb78af6dfcb131a6481e',
    '24333f8a63b6825ea9c5514f83c2829b004d1fee',
    '',
    'android-sdk-preview-license',
    '84831b9409646a918e30573bab4c9c91346d8abd',
    '',
    'android-googletv-license',
    '601085b94cd77f0b54ff86406957099ebe79c4d6',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'android-sdk-license'), content.split('\n').slice(0, 5).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'android-sdk-preview-license'), '84831b9409646a918e30573bab4c9c91346d8abd\n');
  fs.writeFileSync(path.join(dir, 'android-googletv-license'), '601085b94cd77f0b54ff86406957099ebe79c4d6\n');
}

export const DEFAULT_BUILD_TOOLS = '34.0.0';

export function writeLocalProperties(projectDir) {
  const sdk = androidSdkRoot();
  const content = `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`;
  const file = path.join(projectDir, 'local.properties');
  if (readFileIfExists(file) !== content) fs.writeFileSync(file, content);
}

/**
 * Append memory-aware daemon settings + sandbox-safe process launch mode to the
 * project's gradle.properties (appended last so it wins over repo defaults).
 */
export function writeGradleProps(projectDir) {
  const { heapMb, metaspaceMb } = memoryAwareJvmArgs();
  const lines = [
    '# code-canvas ftc-builder overrides',
    `org.gradle.jvmargs=-Xmx${heapMb}m -XX:MaxMetaspaceSize=${metaspaceMb}m -Djdk.lang.Process.launchMechanism=fork`,
    'org.gradle.workers.max=2',
    '',
  ];
  const file = path.join(projectDir, 'gradle.properties');
  let existing = readFileIfExists(file) || '';
  if (existing.includes('code-canvas ftc-builder overrides')) return;
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, prefix + lines.join('\n'));
}

/**
 * Provision everything a project needs (JDK + SDK components + local.properties).
 * Returns env pieces used by the builder.
 */
export async function provisionProject(projectDir, onProgress = () => {}) {
  const info = detectProject(projectDir);
  if (!info.gradleVersion && !info.isWorkspace) {
    throw new Error('Not an FTC Android workspace: no gradle wrapper or FtcRobotController module found');
  }
  await ensureLicenses();
  onProgress(`Selecting JDK for Gradle ${info.gradleVersion || '?'} / AGP ${info.agpVersion || '?'}...`);
  const jdkHome = await ensureJdk(info.jdkMajor, onProgress);
  const sdkRoot = androidSdkRoot();
  if (info.compileSdk) {
    await ensurePlatform(info.compileSdk, onProgress);
  } else {
    log('warn: compileSdk not detected — letting AGP resolve it at build time');
  }
  const bt = info.buildTools || DEFAULT_BUILD_TOOLS;
  const buildTools = await ensureBuildTools(bt, onProgress);
  writeLocalProperties(projectDir);
  writeGradleProps(projectDir);
  return {
    info,
    jdkHome,
    jdkCandidates: jdkCandidatesFor(info),
    gradleHome: gradleHome(),
    sdkRoot,
    buildToolsDir: buildTools,
  };
}

export async function provisionProjectWithJdkCandidates(projectDir, onProgress = () => {}) {
  const prov = await provisionProject(projectDir, onProgress);
  return prov;
}