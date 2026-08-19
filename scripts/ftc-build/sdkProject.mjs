import fs from 'fs';
import path from 'path';
import {
  log,
  mkdirp,
  rmrf,
  toolchainRoot,
  downloadFile,
  extractZip,
  fetchJson,
  readJson,
  writeJson,
  withFileLock,
} from './util.mjs';

const SDK_REPO = 'FIRST-Tech-Challenge/FtcRobotController';
const TAGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchSdkTags() {
  const envTags = process.env.FTC_SDK_TAGS;
  if (envTags) {
    return envTags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  const cacheFile = path.join(toolchainRoot(), 'sdk-tags.json');
  const cached = readJson(cacheFile);
  if (cached && Array.isArray(cached.tags) && Date.now() - cached.ts < TAGS_CACHE_TTL_MS) {
    return cached.tags;
  }
  const tags = [];
  let page = 1;
  for (;;) {
    const data = await fetchJson(`https://api.github.com/repos/${SDK_REPO}/tags?per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    for (const t of data) {
      if (typeof t.name === 'string' && /^v?\d+\.\d+(\.\d+)?$/.test(t.name)) tags.push(t.name.replace(/^v/, ''));
    }
    if (data.length < 100) break;
    page++;
    if (page > 10) break;
  }
  writeJson(cacheFile, { ts: Date.now(), tags });
  log(`cached ${tags.length} FTC SDK tags`);
  return tags;
}

export async function assertSdkVersionSupported(sdkVersion) {
  const norm = String(sdkVersion).replace(/^v/, '');
  if (!/^\d+\.\d+(\.\d+)?$/.test(norm)) {
    throw new Error(`Invalid FTC SDK version: ${sdkVersion}`);
  }
  try {
    const tags = await fetchSdkTags();
    if (tags.length > 0 && !tags.includes(norm)) {
      throw new Error(
        `FTC SDK version ${norm} is not a known release. Supported versions include: ${tags.slice(-12).join(', ')}`,
      );
    }
  } catch (err) {
    // GitHub API hiccups (rate limits, outages) must not block valid builds —
    // the codeload download itself will 404 for unknown versions.
    if (err instanceof Error && err.message.includes('not a known release')) throw err;
    log(`warn: could not validate SDK version list (${err instanceof Error ? err.message : err}) — proceeding`);
  }
  return norm;
}

export function extractToNamedDir(zipPath, parentDir, expectedName) {
  const staging = path.join(parentDir, `.staging-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirp(staging);
  extractZip(zipPath, staging);
  let entries = [];
  try {
    entries = fs.readdirSync(staging);
  } catch {
    entries = [];
  }
  const dirs = entries.filter((e) => {
    try {
      return fs.statSync(path.join(staging, e)).isDirectory();
    } catch {
      return false;
    }
  });
  const dest = path.join(parentDir, expectedName);
  mkdirp(path.dirname(dest));
  rmrf(dest);
  if (dirs.length === 1) {
    fs.renameSync(path.join(staging, dirs[0]), dest);
    rmrf(staging);
  } else {
    fs.renameSync(staging, dest);
  }
  return dest;
}

export async function ensureSkeleton(sdkVersion, onProgress = () => {}) {
  const norm = await assertSdkVersionSupported(sdkVersion);
  return withFileLock(path.join(toolchainRoot(), '.locks', `skeleton-${norm}.lock`), async () => {
    const projectDir = path.join(toolchainRoot(), 'projects', `FtcRobotController-${norm}`);
    const marker = path.join(projectDir, '.ready');
    if (fs.existsSync(marker)) return projectDir;
    const zipPath = path.join(toolchainRoot(), 'downloads', `FtcRobotController-${norm}.zip`);
    onProgress(`Downloading official FTC SDK v${norm} project...`);
    if (!fs.existsSync(zipPath)) {
      await downloadFile(`https://codeload.github.com/${SDK_REPO}/zip/refs/tags/v${norm}`, zipPath, {
        onProgress: (r, t) => onProgress(`Downloading FTC SDK v${norm}... ${Math.round((r / Math.max(t, 1)) * 100)}%`),
      });
    }
    onProgress(`Extracting FTC SDK v${norm}...`);
    const projectsDir = path.join(toolchainRoot(), 'projects');
    mkdirp(projectsDir);
    extractToNamedDir(zipPath, projectsDir, `FtcRobotController-${norm}`);
    fs.writeFileSync(marker, new Date().toISOString());
    return projectDir;
  });
}

/**
 * Wipe the previous user sources and write the validated files into the skeleton.
 * Files use paths like TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Foo.java.
 */
export function overlayUserFiles(projectDir, files) {
  const mainDir = path.join(projectDir, 'TeamCode', 'src', 'main');
  rmrf(path.join(mainDir, 'java'));
  rmrf(path.join(mainDir, 'res'));
  for (const f of files) {
    const rel = String(f.path).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel.startsWith('TeamCode/')) throw new Error(`File outside TeamCode: ${f.path}`);
    const parts = rel.split('/');
    if (parts.some((p) => p === '..' || p === '' || p.includes(':'))) throw new Error(`Invalid file path: ${f.path}`);
    const out = path.join(projectDir, ...parts);
    if (!out.startsWith(mainDir)) throw new Error(`File outside TeamCode/src/main: ${f.path}`);
    mkdirp(path.dirname(out));
    fs.writeFileSync(out, f.content, 'utf8');
  }
}

export async function cloneRepo(owner, repo, branch, onProgress = () => {}) {
  if (typeof branch === 'function') {
    onProgress = branch;
    branch = null;
  }
  const slug = `${owner}/${repo}`;
  onProgress(`Fetching repo ${slug}...`);
  const meta = await fetchJson(`https://api.github.com/repos/${slug}`);
  if (!meta || !meta.full_name) throw new Error(`Could not resolve repo ${slug}`);
  const ref = branch || meta.default_branch || 'master';
  const dir = path.join(toolchainRoot(), 'projects', 'repos', `${owner}-${repo}-${ref}`);
  return withFileLock(path.join(toolchainRoot(), '.locks', `repo-${owner}-${repo}-${ref}.lock`), async () => {
    const marker = path.join(dir, '.ready');
    if (fs.existsSync(marker)) return dir;
    const zipPath = path.join(toolchainRoot(), 'downloads', `${owner}-${repo}-${ref}.zip`);
    onProgress(`Downloading ${slug}@${ref}...`);
    if (!fs.existsSync(zipPath)) {
      await downloadFile(`https://codeload.github.com/${slug}/zip/refs/heads/${ref}`, zipPath, {
        onProgress: (r, t) => onProgress(`Downloading ${slug}... ${Math.round((r / Math.max(t, 1)) * 100)}%`),
      });
    }
    onProgress(`Extracting ${slug}...`);
    const reposDir = path.join(toolchainRoot(), 'projects', 'repos');
    mkdirp(reposDir);
    extractToNamedDir(zipPath, reposDir, `${owner}-${repo}-${ref}`);
    fs.writeFileSync(marker, new Date().toISOString());
    return dir;
  });
}