#!/usr/bin/env node
/**
 * FTC build pipeline test harness.
 *
 * Downloads REAL FTC team repos, builds them with the self-provisioning
 * toolchain, and verifies the produced APK actually contains the repo's code.
 *
 * Usage:
 *   node scripts/ftc-build.test.mjs                     # default repo set + SDK version matrix
 *   node scripts/ftc-build.test.mjs --only Owner/Repo   # subset of repos
 *   node scripts/ftc-build.test.mjs --skip-matrix       # skip stock SDK matrix builds
 *   FTC_TEST_REPOS=a/b,c/d node scripts/ftc-build.test.mjs
 *   FTC_TEST_MATRIX=v10.1.1 node scripts/ftc-build.test.mjs
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { log } from './ftc-build/util.mjs';
import { cloneRepo, ensureSkeleton, overlayUserFiles } from './ftc-build/sdkProject.mjs';
import { provisionProject } from './ftc-build/toolchain.mjs';
import { buildProject } from './ftc-build/builder.mjs';
import { verifyApkStructure, dexContainsClasses, verifySignature, verifyAlignment } from './ftc-build/verify.mjs';
import { detectProject, listTeamCodeJavaClasses } from './ftc-build/detect.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_REPOS = [
  'EdwardCasler/FTC-DECODE-25#Edward_branch',
  'Pedro-Pathing/Quickstart',
  'OverlakeRobotics/OverlakeRoboticsLibrary',
  'Kalipso-Robotics/FtcRobotController',
];

const DEFAULT_MATRIX = ['v6.2', 'v9.2', 'v10.1.1', 'v11.2.1'];

function parseArgs() {
  const args = process.argv.slice(2);
  const only = [];
  let skipMatrix = false;
  let matrixOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only' && args[i + 1]) {
      for (const s of args[++i].split(',')) if (s.trim()) only.push(s.trim());
    } else if (args[i] === '--skip-matrix') {
      skipMatrix = true;
    } else if (args[i] === '--matrix-only') {
      matrixOnly = true;
    }
  }
  return { only, skipMatrix, matrixOnly };
}

export function collectTeamCodeSources(repoDir) {
  const files = [];
  const base = path.join(repoDir, 'TeamCode', 'src', 'main');
  const walk = (dir, rel) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const nextRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, nextRel);
      else if (/\.(java|xml|json|txt)$/.test(e.name)) {
        files.push({ path: `TeamCode/src/main/${nextRel}`, content: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  walk(base, '');
  return files;
}

function collectSteps(steps, line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return;
  if (/^(> Task |> Configure|BUILD |FAILURE|Execution failed|What went wrong|error:|warning:|Downloading|Download |Task :)/.test(trimmed)) {
    if (steps.length < 600) steps.push(trimmed.slice(0, 160));
  }
}

async function verifyApk(apkPath, prov, expectedClasses) {
  const checks = [];
  const structure = verifyApkStructure(apkPath);
  checks.push(`structure(${structure.dex.length} dex, manifest=${structure.manifest}, arsc=${structure.arsc}) ${structure.ok ? 'OK' : 'FAIL'}`);
  const sig = await verifySignature(apkPath, {
    javaBin: path.join(prov.jdkHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
    buildToolsDir: prov.buildToolsDir,
  });
  checks.push(`signature ${sig.ok ? 'OK' : 'FAIL'}`);
  const align = await verifyAlignment(apkPath, { buildToolsDir: prov.buildToolsDir });
  if (align.ok !== null) checks.push(`zipalign ${align.ok ? 'OK' : 'FAIL'}`);
  let classCheck = 'classes: skipped (no sources)';
  if (expectedClasses.length > 0) {
    const found = dexContainsClasses(apkPath, expectedClasses);
    const ok = found.length > 0;
    classCheck = `classes: ${found.length}/${expectedClasses.length} in dex ${ok ? 'OK' : 'FAIL'}`;
    if (ok) checks.push(`real code in APK: ${found.slice(0, 3).join(', ')} OK`);
  }
  return {
    ok: structure.ok && sig.ok && (expectedClasses.length === 0 || dexContainsClasses(apkPath, expectedClasses).length > 0) && align.ok !== false,
    checks,
    classCheck,
  };
}

function parseRepoSpec(spec) {
  const [ownerRepo, branch] = spec.split('#');
  const [owner, repo] = ownerRepo.split('/');
  return { owner, repo, branch: branch || null };
}

async function testRepo(slug, results) {
  const t0 = Date.now();
  const entry = { type: 'repo', slug, status: 'RUNNING', detail: '', ms: 0 };
  results.push(entry);
  try {
    const { owner, repo, branch } = parseRepoSpec(slug);
    const repoDir = await cloneRepo(owner, repo, branch, () => {});
    const info = detectProject(repoDir);
    let buildDir = repoDir;
    if (!info.isWorkspace) {
      if (!info.hasTeamCode) throw new Error('Not an FTC workspace: no FtcRobotController app module and no TeamCode module');
      const ver = info.ftcSdkVersion || '11.2.1';
      log(`.. ${slug} has no app module — overlaying TeamCode into FTC SDK v${ver} skeleton`);
      buildDir = await ensureSkeleton(ver);
      overlayUserFiles(buildDir, collectTeamCodeSources(repoDir));
    }
    const prov = await provisionProject(buildDir, (m) => log(`.. ${m}`));
    const res = await buildProject(buildDir, {
      jdkHome: prov.jdkHome,
      jdkCandidates: prov.jdkCandidates,
      onLine: (l) => collectSteps(entry.steps || (entry.steps = []), l),
    });
    if (res.code !== 0 || !res.apkPath) {
      entry.status = 'FAIL';
      entry.detail = `gradle exit ${res.code}`;
      entry.errors = (res.errors || []).slice(0, 8);
      entry.ms = Date.now() - t0;
      return;
    }
    const expectedClasses = listTeamCodeJavaClasses(buildDir);
    const verdict = await verifyApk(res.apkPath, prov, expectedClasses);
    entry.status = verdict.ok ? 'PASS' : 'FAIL';
    entry.detail = `apk=${(fs.statSync(res.apkPath).size / 1024 / 1024).toFixed(1)}MB jdk=${res.jdkMajor} ${verdict.classCheck}`;
    entry.checks = verdict.checks;
    entry.errors = verdict.ok ? [] : ['APK verification failed'];
    entry.ms = Date.now() - t0;
  } catch (err) {
    entry.status = 'FAIL';
    entry.detail = err instanceof Error ? err.message : String(err);
    entry.errors = [err instanceof Error ? err.message : String(err)];
    entry.ms = Date.now() - t0;
  }
}

async function testStock(version, results) {
  const t0 = Date.now();
  const entry = { type: 'matrix', slug: `stock ${version}`, status: 'RUNNING', detail: '', ms: 0 };
  results.push(entry);
  try {
    const projectDir = await ensureSkeleton(version, (m) => log(`.. ${m}`));
    const prov = await provisionProject(projectDir, (m) => log(`.. ${m}`));
    const res = await buildProject(projectDir, {
      jdkHome: prov.jdkHome,
      jdkCandidates: prov.jdkCandidates,
      onLine: (l) => collectSteps(entry.steps || (entry.steps = []), l),
    });
    if (res.code !== 0 || !res.apkPath) {
      entry.status = 'FAIL';
      entry.detail = `gradle exit ${res.code}`;
      entry.errors = (res.errors || []).slice(0, 8);
      entry.ms = Date.now() - t0;
      return;
    }
    const verdict = await verifyApk(res.apkPath, prov, []);
    entry.status = verdict.ok ? 'PASS' : 'FAIL';
    entry.detail = `apk=${(fs.statSync(res.apkPath).size / 1024 / 1024).toFixed(1)}MB jdk=${res.jdkMajor}`;
    entry.checks = verdict.checks;
    entry.errors = verdict.ok ? [] : ['APK verification failed'];
    entry.ms = Date.now() - t0;
  } catch (err) {
    entry.status = 'FAIL';
    entry.detail = err instanceof Error ? err.message : String(err);
    entry.errors = [err instanceof Error ? err.message : String(err)];
    entry.ms = Date.now() - t0;
  }
}

async function main() {
  const { only, skipMatrix, matrixOnly } = parseArgs();
  const envRepos = (process.env.FTC_TEST_REPOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const repos = only.length > 0 ? only : envRepos.length > 0 ? envRepos : DEFAULT_REPOS;
  const matrix = (process.env.FTC_TEST_MATRIX || '').split(',').map((s) => s.trim()).filter(Boolean);
  const matrixVersions = matrix.length > 0 ? matrix : DEFAULT_MATRIX;

  log(`FTC build test harness — ${matrixOnly ? 0 : repos.length} repos, ${skipMatrix ? 'matrix skipped' : `${matrixVersions.length} stock SDK builds`}`);
  log(`Toolchain root: ${process.env.FTC_TOOLCHAIN_DIR || path.join(__dirname, '..', '.ftc-toolchain')}`);

  const results = [];
  if (!matrixOnly) {
    for (const slug of repos) {
      await testRepo(slug, results);
    }
  }
  if (!skipMatrix) {
    for (const version of matrixVersions) {
      await testStock(version, results);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('RESULTS');
  console.log('='.repeat(100));
  for (const r of results) {
    console.log(`[${r.status}] ${r.slug}  (${(r.ms / 1000).toFixed(0)}s)  ${r.detail}`);
    for (const c of r.checks || []) console.log(`       ${c}`);
    for (const e of r.errors || []) console.log(`       error: ${String(e).split('\n')[0].slice(0, 200)}`);
    if (r.status !== 'PASS' && Array.isArray(r.steps) && r.steps.length > 0) {
      console.log(`       last steps:`);
      for (const s of r.steps.slice(-10)) console.log(`         ${s}`);
    }
  }
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log('='.repeat(100));
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
