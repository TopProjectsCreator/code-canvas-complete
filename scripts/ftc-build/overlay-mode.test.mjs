#!/usr/bin/env node
/**
 * Tests the "TeamCode-only repo" (overlay mode) build path that the harness
 * falls back to when a repo has no FtcRobotController app module:
 *   repo sources -> skeleton overlay -> provision -> build -> APK contains code
 *
 * Run: node scripts/ftc-build/overlay-mode.test.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

let failures = 0;
let checks = 0;
function check(name, ok, detail = '') {
  checks++;
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
}

const { ensureSkeleton, overlayUserFiles } = await import('./sdkProject.mjs');
const { provisionProject } = await import('./toolchain.mjs');
const { buildProject } = await import('./builder.mjs');
const { verifyApkStructure, dexContainsClasses } = await import('./verify.mjs');
const { detectProject } = await import('./detect.mjs');
const { collectTeamCodeSources } = await import('../ftc-build.test.mjs');

// Build a synthetic TeamCode-only repo (no FtcRobotController module, no gradle wrapper)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ftc-overlay-repo-'));
const repoDir = path.join(tmp, 'TeamCodeOnly-Repo');
const teamPkg = path.join(repoDir, 'TeamCode', 'src', 'main', 'java', 'org', 'firstinspires', 'ftc', 'teamcode');
fs.mkdirSync(teamPkg, { recursive: true });
fs.writeFileSync(
  path.join(teamPkg, 'OverlayOnly.java'),
  [
    'package org.firstinspires.ftc.teamcode;',
    'import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;',
    'import com.qualcomm.robotcore.eventloop.opmode.TeleOp;',
    '@TeleOp(name="OverlayOnly")',
    'public class OverlayOnly extends LinearOpMode {',
    '  @Override public void runOpMode() { waitForStart(); while (opModeIsActive()) { telemetry.addData("o", 1); telemetry.update(); } }',
    '}',
    '',
  ].join('\n'),
);
fs.writeFileSync(path.join(repoDir, 'README.md'), 'teamcode only repo\n');
fs.writeFileSync(path.join(repoDir, 'TeamCode', 'build.gradle'), '// stub\n');

console.log('-- detection of TeamCode-only repo --');
const info = detectProject(repoDir);
check('isWorkspace=false (no app module)', info.isWorkspace === false, `isWorkspace=${info.isWorkspace}`);
check('hasTeamCode=true', info.hasTeamCode === true);
check('no wrapper (bare repo)', info.hasWrapper === false);

console.log('-- overlay mode (what the harness does for such repos) --');
const sources = collectTeamCodeSources(repoDir);
check('sources collected from TeamCode/src/main', sources.length >= 1, `count=${sources.length}`);
check('source path preserved', sources[0].path === 'TeamCode/src/main/java/org/firstinspires/ftc/teamcode/OverlayOnly.java', sources[0]?.path);

const skeleton = await ensureSkeleton('11.2.1');
overlayUserFiles(skeleton, sources);
check('file landed in skeleton TeamCode', fs.existsSync(path.join(skeleton, 'TeamCode', 'src', 'main', 'java', 'org', 'firstinspires', 'ftc', 'teamcode', 'OverlayOnly.java')));

const prov = await provisionProject(skeleton);
const res = await buildProject(skeleton, {
  jdkHome: prov.jdkHome,
  jdkCandidates: prov.jdkCandidates,
});
check('build succeeds', res.code === 0 && !!res.apkPath, res.code !== 0 ? (res.errors || []).slice(0, 2).join(' | ') : 'apk ok');
if (res.apkPath) {
  const structure = verifyApkStructure(res.apkPath);
  check('APK structure valid', structure.ok, JSON.stringify(structure));
  const found = dexContainsClasses(res.apkPath, ['Lorg/firstinspires/ftc/teamcode/OverlayOnly;']);
  check('OverlayOnly class in dex', found.length === 1, found.join(', '));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;
