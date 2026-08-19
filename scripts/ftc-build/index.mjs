import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { log } from './util.mjs';
import { provisionProject } from './toolchain.mjs';
import { ensureSkeleton, overlayUserFiles, assertSdkVersionSupported } from './sdkProject.mjs';
import { buildProject } from './builder.mjs';
import { verifyApkStructure, dexContainsClasses } from './verify.mjs';

export const FTC_DEFAULT_SDK_VERSION = process.env.FTC_DEFAULT_SDK_VERSION || '11.2.1';

const jobs = new Map();
let currentJobId = null;
let warmupPromise = null;

const ALLOWED_EXTS = new Set(['.java', '.xml', '.json', '.txt']);
const MAX_FILES = 200;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const JOB_TTL_MS = 30 * 60 * 1000;

export function sanitizeRelPath(p) {
  let s = String(p).replace(/\\/g, '/');
  s = s.replace(/^\.\/+/, '');
  s = s.replace(/^FtcRobotController\//, '');
  s = s.replace(/^\/+/, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.some((part) => part === '..' || part === '.' || part.includes(':'))) return null;
  return parts.join('/');
}

export function validateFiles(rawFiles) {
  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    return { error: 'No source files provided' };
  }
  if (rawFiles.length > MAX_FILES) {
    return { error: `Too many files (max ${MAX_FILES})` };
  }
  let total = 0;
  const files = [];
  for (const f of rawFiles) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') {
      return { error: 'Each file must have string path and content fields' };
    }
    const rel = sanitizeRelPath(f.path);
    if (!rel) return { error: `Invalid file path: ${f.path}` };
    if (!rel.startsWith('TeamCode/')) return { error: `File must live under TeamCode/: ${f.path}` };
    const ext = path.extname(rel).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return { error: `Unsupported file type ${ext || '(none)'} for ${f.path} (only .java/.xml/.json/.txt)` };
    }
    const bytes = Buffer.byteLength(f.content, 'utf8');
    if (bytes > MAX_FILE_BYTES) return { error: `File too large: ${f.path}` };
    total += bytes;
    files.push({ path: rel, content: f.content, bytes });
  }
  if (total > MAX_TOTAL_BYTES) return { error: 'Total source size exceeds 5MB' };
  return { files };
}

export function normalizeSdkVersion(sdkVersion) {
  if (!sdkVersion) return FTC_DEFAULT_SDK_VERSION;
  return String(sdkVersion).trim().replace(/^v/, '');
}

export function queueFtcBuild({ files, sdkVersion, userId }) {
  if (currentJobId) {
    const running = jobs.get(currentJobId);
    return {
      error: running ? `A build is already in progress (${running.id})` : 'A build is already in progress',
    };
  }
  const job = {
    id: randomUUID(),
    status: 'queued',
    message: 'Build queued',
    stages: [],
    files,
    sdkVersion: normalizeSdkVersion(sdkVersion),
    userId: userId || null,
    createdAt: Date.now(),
    errors: [],
    warnings: [],
  };
  jobs.set(job.id, job);
  currentJobId = job.id;
  runBuildJob(job).finally(() => {
    if (currentJobId === job.id) currentJobId = null;
    setTimeout(() => jobs.delete(job.id), JOB_TTL_MS);
  });
  return { job };
}

export function getFtcBuild(buildId) {
  return jobs.get(buildId) || null;
}

export function getCurrentBuildId() {
  return currentJobId;
}

function stage(job, status, message) {
  job.status = status;
  job.message = message;
  job.stages.push({ status, message, at: Date.now() });
}

async function runBuildJob(job) {
  try {
    await assertSdkVersionSupported(job.sdkVersion);
    stage(job, 'provisioning', `Preparing FTC SDK v${job.sdkVersion} toolchain (first build downloads JDK + Android SDK, can take several minutes)...`);
    const projectDir = await ensureSkeleton(job.sdkVersion, (msg) => stage(job, 'provisioning', msg));
    const prov = await provisionProject(projectDir, (msg) => stage(job, 'provisioning', msg));
    stage(job, 'provisioning', 'Installing your source files...');
    overlayUserFiles(projectDir, job.files);
    stage(job, 'compiling', 'Running Gradle build (:FtcRobotController:assembleDebug)...');
    const res = await buildProject(projectDir, {
      jdkHome: prov.jdkHome,
      jdkCandidates: prov.jdkCandidates,
      onLine: (line) => {
        const trimmed = line.trim();
        if (trimmed && /^(> Task |> Configure|BUILD|Task :|:FtcRobotController|:TeamCode)/.test(trimmed)) {
          stage(job, 'compiling', trimmed);
        }
      },
    });
    if (res.code !== 0 || !res.apkPath) {
      job.errors = res.errors && res.errors.length > 0 ? res.errors : ['Gradle build failed'];
      stage(job, 'error', `Build failed — ${job.errors.length} error(s)`);
      return;
    }
    const structural = verifyApkStructure(res.apkPath);
    if (!structural.ok) {
      job.errors = ['Gradle reported success but the APK is missing classes.dex / AndroidManifest.xml / resources.arsc'];
      stage(job, 'error', 'Invalid APK produced');
      return;
    }
    const userClasses = dexContainsClasses(
      res.apkPath,
      job.files.filter((f) => f.path.endsWith('.java')).map((f) => `L${f.path.slice('TeamCode/src/main/java/'.length, -'.java'.length)};`),
    );
    job.apkBase64 = fs.readFileSync(res.apkPath).toString('base64');
    job.apkSize = fs.statSync(res.apkPath).size;
    job.warnings = [];
    if (userClasses.length === 0) {
      job.warnings.push('Could not verify your compiled classes inside the APK dex (they may still be present).');
    }
    stage(job, 'success', `Build successful — signed APK ready (${(job.apkSize / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    job.errors = [msg];
    stage(job, 'error', msg);
  }
}

export function startFtcBuildWarmup() {
  if (warmupPromise) return warmupPromise;
  warmupPromise = (async () => {
    try {
      log(`warmup: provisioning default FTC SDK v${FTC_DEFAULT_SDK_VERSION} toolchain in the background...`);
      const projectDir = await ensureSkeleton(FTC_DEFAULT_SDK_VERSION);
      await provisionProject(projectDir);
      log('warmup: FTC toolchain ready');
    } catch (err) {
      log(`warmup failed (will retry on demand): ${err instanceof Error ? err.message : err}`);
    }
  })();
  return warmupPromise;
}