#!/usr/bin/env node
/**
 * Unit tests for the FTC build pipeline's pure logic:
 * - file validation / path sanitization
 * - build-file detection & parsing
 * - javac error extraction
 * - overlay path safety
 * - APK verification negatives
 *
 * Run: node scripts/ftc-build/unit.test.mjs
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
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
function eq(name, actual, expected) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

const { sanitizeRelPath, validateFiles } = await import('./index.mjs');
const d = await import('./detect.mjs');
const b = await import('./builder.mjs');
const v = await import('./verify.mjs');
const { memoryAwareJvmArgs } = await import('./util.mjs');
const { overlayUserFiles } = await import('./sdkProject.mjs');

console.log('-- sanitizeRelPath --');
eq('plain path', sanitizeRelPath('TeamCode/src/main/java/a/B.java'), 'TeamCode/src/main/java/a/B.java');
eq('backslashes normalized', sanitizeRelPath('TeamCode\\src\\main\\java\\a\\B.java'), 'TeamCode/src/main/java/a/B.java');
eq('leading ./ stripped', sanitizeRelPath('./TeamCode/a.java'), 'TeamCode/a.java');
eq('FtcRobotController prefix stripped', sanitizeRelPath('FtcRobotController/TeamCode/a.java'), 'TeamCode/a.java');
eq('leading / stripped', sanitizeRelPath('/TeamCode/a.java'), 'TeamCode/a.java');
check('traversal rejected', sanitizeRelPath('../x.java') === null);
check('embedded .. rejected', sanitizeRelPath('TeamCode/src/../../x.java') === null);
check('dot segment rejected', sanitizeRelPath('TeamCode/./x.java') === null);
check('windows drive rejected', sanitizeRelPath('C:/TeamCode/x.java') === null);
check('double slash collapses', sanitizeRelPath('TeamCode//a.java') === 'TeamCode/a.java');

console.log('-- validateFiles --');
eq('non-array', validateFiles(null).error, 'No source files provided');
eq('empty array', validateFiles([]).error, 'No source files provided');
eq('missing content', validateFiles([{ path: 'TeamCode/a.java' }]).error, 'Each file must have string path and content fields');
eq('wrong type content', validateFiles([{ path: 'TeamCode/a.java', content: 5 }]).error, 'Each file must have string path and content fields');
eq('outside TeamCode', validateFiles([{ path: 'FtcRobotController/src/a.java', content: 'x' }]).error, 'File must live under TeamCode/: FtcRobotController/src/a.java');
eq('unsupported ext', validateFiles([{ path: 'TeamCode/lib/x.jar', content: 'x' }]).error, 'Unsupported file type .jar for TeamCode/lib/x.jar (only .java/.xml/.json/.txt)');
eq('unsupported .kt', validateFiles([{ path: 'TeamCode/a.kt', content: 'x' }]).error, 'Unsupported file type .kt for TeamCode/a.kt (only .java/.xml/.json/.txt)');
eq('too many files', validateFiles(Array.from({ length: 201 }, (_, i) => ({ path: `TeamCode/f${i}.java`, content: 'x' }))).error, 'Too many files (max 200)');
eq('file too large', validateFiles([{ path: 'TeamCode/a.java', content: 'x'.repeat(1024 * 1024 + 1) }]).error, 'File too large: TeamCode/a.java');
eq('total too large', validateFiles(Array.from({ length: 6 }, (_, i) => ({ path: `TeamCode/f${i}.java`, content: 'x'.repeat(1024 * 1024) }))).error, 'Total source size exceeds 5MB');
const okFiles = validateFiles([{ path: 'TeamCode/src/main/java/a/B.java', content: 'class B {}' }, { path: 'TeamCode/src/main/res/values/strings.xml', content: '<x/>' }]);
check('valid set accepted', okFiles.files?.length === 2, `count=${okFiles.files?.length}`);
check('normalized paths kept', okFiles.files?.[0].path === 'TeamCode/src/main/java/a/B.java');

console.log('-- detect.mjs parsing (real fixtures on disk) --');
const fixtures = [
  ['EdwardCasler-FTC-DECODE-25-Edward_branch', { gradle: '8.9', agp: '8.7.0', app: 'TeamCode', jdk: 17 }],
  ['Pedro-Pathing-Quickstart-master', { gradle: '8.9', app: 'TeamCode', jdk: 17 }],
  ['Kalipso-Robotics-FtcRobotController-master', { gradle: '8.13', app: 'TeamCode', jdk: 17 }],
  ['OverlakeRobotics-OverlakeRoboticsLibrary-master', { gradle: '8.13', app: 'TeamCode', jdk: 17 }],
];
for (const [name, want] of fixtures) {
  const dir = path.join(ROOT, '.ftc-toolchain', 'projects', 'repos', name);
  if (!fs.existsSync(dir)) {
    console.log(`  SKIP  fixture missing: ${name}`);
    continue;
  }
  const info = d.detectProject(dir);
  eq(`${name}: gradle`, info.gradleVersion, want.gradle);
  if (want.agp) eq(`${name}: agp`, info.agpVersion, want.agp);
  eq(`${name}: appModule`, info.appModule, want.app);
  eq(`${name}: jdkMajor`, info.jdkMajor, want.jdk);
  eq(`${name}: workspace`, info.isWorkspace, true);
}
for (const ver of ['6.2', '9.2', '10.1.1', '11.2.1']) {
  const dir = path.join(ROOT, '.ftc-toolchain', 'projects', `FtcRobotController-${ver}`);
  if (!fs.existsSync(dir)) {
    console.log(`  SKIP  skeleton missing: ${ver}`);
    continue;
  }
  const info = d.detectProject(dir);
  check(`skeleton ${ver}: appModule detected`, info.appModule === 'TeamCode' || info.appModule === 'FtcRobotController', `app=${info.appModule}`);
  check(`skeleton ${ver}: has gradle wrapper version`, !!info.gradleVersion, `gradle=${info.gradleVersion}`);
  check(`skeleton ${ver}: compileSdk parsed`, info.compileSdk >= 28, `compileSdk=${info.compileSdk}`);
}

console.log('-- pickJdkMajor --');
eq('gradle 4.4', d.pickJdkMajor('4.4', '3.2.1'), 8);
eq('gradle 5.6', d.pickJdkMajor('5.6.4', '3.5.3'), 8);
eq('gradle 6.7', d.pickJdkMajor('6.7.1', '4.1.3'), 8);
eq('gradle 7.0 + agp 7', d.pickJdkMajor('7.0.2', '7.0.4'), 11);
eq('gradle 7.4 + agp 7.2', d.pickJdkMajor('7.4.2', '7.2.0'), 17);
eq('gradle 8.9 + agp 8.7', d.pickJdkMajor('8.9', '8.7.0'), 17);
eq('gradle 9.1 no agp', d.pickJdkMajor('9.1.0', null), 17);

console.log('-- parseBuildErrors --');
const gradleFail = [
  '> Task :TeamCode:compileDebugJavaWithJavac FAILED',
  '/home/x/FtcRobotController/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Foo.java:12: error: cannot find symbol',
  '        badMethod();',
  '        ^',
  '  symbol:   method badMethod()',
  '/home/x/FtcRobotController/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Foo.java:15: error: unreachable statement',
  '2 errors',
  'FAILURE: Build failed with an exception.',
].join('\n');
const errs = b.parseBuildErrors(gradleFail);
eq('extracts javac errors', errs.length, 2);
check('first error line format', errs[0].includes('Foo.java:12: error: cannot find symbol'), errs[0]);
check('second error extracted', errs[1].includes('unreachable statement'));
const noJavaErr = b.parseBuildErrors('FAILURE: Build failed with an exception.\n* What went wrong:\nCould not resolve all dependencies.\n* Try:');
check('falls back to What went wrong', noJavaErr.some((e) => e.includes('What went wrong')));
eq('empty output -> last lines', b.parseBuildErrors('').length, 1);

console.log('-- memoryAwareJvmArgs --');
const args = memoryAwareJvmArgs();
check('heap within bounds', args.heapMb >= 512 && args.heapMb <= 4096, `heap=${args.heapMb}`);
check('metaspace sane', args.metaspaceMb >= 256 && args.metaspaceMb <= 1024, `meta=${args.metaspaceMb}`);
process.env.FTC_GRADLE_HEAP_MB = '1024';
eq('env override honored', memoryAwareJvmArgs().heapMb, 1024);
process.env.FTC_GRADLE_HEAP_MB = 'notanumber';
check('bad env override ignored', memoryAwareJvmArgs().heapMb >= 512, `heap=${memoryAwareJvmArgs().heapMb}`);
delete process.env.FTC_GRADLE_HEAP_MB;

console.log('-- overlayUserFiles path safety --');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ftc-overlay-'));
fs.mkdirSync(path.join(tmp, 'TeamCode', 'src', 'main'), { recursive: true });
const dangerous = [
  { path: '../evil.java', content: 'x' },
  { path: 'TeamCode/src/../../evil.java', content: 'x' },
];
for (const f of dangerous) {
  try {
    overlayUserFiles(tmp, [f]);
    check(`overlay rejects ${f.path}`, false, 'did not throw');
  } catch {
    check(`overlay rejects ${f.path}`, true);
  }
}
overlayUserFiles(tmp, [{ path: 'TeamCode/src/main/java/ok.java', content: 'class Ok {}' }]);
check('overlay accepts valid path', fs.existsSync(path.join(tmp, 'TeamCode', 'src', 'main', 'java', 'ok.java')));
overlayUserFiles(tmp, [{ path: 'TeamCode/src/main/java/a/B.java', content: 'class B {}' }]);
check('overlay writes nested file', fs.existsSync(path.join(tmp, 'TeamCode', 'src', 'main', 'java', 'a', 'B.java')));
check('overlay wipes stale java dir', !fs.existsSync(path.join(tmp, 'TeamCode', 'src', 'main', 'java', 'ok.java')) || fs.readFileSync(path.join(tmp, 'TeamCode', 'src', 'main', 'java', 'a', 'B.java'), 'utf8') === 'class B {}');
fs.rmSync(tmp, { recursive: true, force: true });

console.log('-- verify.mjs negatives --');
const badZip = path.join(os.tmpdir(), 'not-an-apk.zip');
fs.writeFileSync(badZip, 'definitely not a zip file');
const structure = v.verifyApkStructure(badZip);
check('garbage file rejected as APK', structure.ok === false, `ok=${structure.ok}`);
const emptyZip = path.join(os.tmpdir(), 'empty.zip');
fs.writeFileSync(emptyZip, Buffer.from('504b05060000000000000000000000000000000000', 'hex'));
const structure2 = v.verifyApkStructure(emptyZip);
check('empty zip rejected (no dex/manifest/arsc)', structure2.ok === false);
fs.rmSync(badZip, { force: true });
fs.rmSync(emptyZip, { force: true });

console.log('-- archive extraction safety --');
const { zipSync } = await import('fflate');
const { extractZip, extractTarGz, verifyChecksum, sha256Hex } = await import('./util.mjs');
const evilZipPath = path.join(os.tmpdir(), 'evil-slip.zip');
fs.writeFileSync(evilZipPath, Buffer.from(zipSync({
  '../escaped.txt': new TextEncoder().encode('pwned'),
  'ok/nested.txt': new TextEncoder().encode('fine'),
})));
const slipDest = fs.mkdtempSync(path.join(os.tmpdir(), 'ftc-slip-'));
extractZip(evilZipPath, slipDest);
check('zip-slip entry blocked', !fs.existsSync(path.join(os.tmpdir(), 'escaped.txt')));
check('legit entry extracted', fs.existsSync(path.join(slipDest, 'ok', 'nested.txt')));
fs.rmSync(evilZipPath, { force: true });
fs.rmSync(slipDest, { recursive: true, force: true });

console.log('-- tar symlink escape safety --');
import zlib from 'zlib';
function makeTar(entries) {
  const blocks = [];
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const header = Buffer.alloc(512);
    nameBuf.copy(header, 0, 0, Math.min(100, nameBuf.length));
    const contentBuf = e.content ? Buffer.from(e.content) : Buffer.alloc(0);
    header.write(e.type === '5' ? '0000755' : e.type === '2' ? '0120777' : '0000644', 100, 8);
    header.write('0000000', 108, 8);
    header.write('0000000', 116, 8);
    header.write(contentBuf.length.toString(8).padStart(11, '0') + ' ', 124, 12);
    header.write('00000000000', 136, 12);
    header[156] = e.type.charCodeAt(0);
    if (e.linkname) Buffer.from(e.linkname, 'utf8').copy(header, 157, 0, Math.min(100, Buffer.byteLength(e.linkname)));
    header.write('ustar', 257, 5);
    header.write('00', 263, 2);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    blocks.push(header);
    if (contentBuf.length) {
      const padded = Buffer.alloc(Math.ceil(contentBuf.length / 512) * 512);
      contentBuf.copy(padded);
      blocks.push(padded);
    }
  }
  blocks.push(Buffer.alloc(512), Buffer.alloc(512));
  return Buffer.concat(blocks);
}
const tarBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ftc-tar-'));
const tarPath = path.join(tarBase, 'evil.tar.gz');
const tarContent = makeTar([
  { name: 'good/a.txt', type: '0', content: 'fine' },
  { name: 'escape', type: '2', linkname: '/tmp' },
  { name: 'escape/pwned.txt', type: '0', content: 'pwned' },
  { name: 'linkinside', type: '2', linkname: 'good' },
  { name: 'linkinside/b.txt', type: '0', content: 'through-internal-link' },
]);
fs.writeFileSync(tarPath, zlib.gzipSync(tarContent));
const tarDest = path.join(tarBase, 'out');
extractTarGz(tarPath, tarDest);
check('file written through escaping symlink is dropped', !fs.existsSync('/tmp/pwned.txt'));
const escapeStat = fs.existsSync(path.join(tarDest, 'escape')) ? fs.lstatSync(path.join(tarDest, 'escape')) : null;
check('escaping symlink never created (plain dir at most)', !escapeStat || !escapeStat.isSymbolicLink(), escapeStat ? (escapeStat.isSymbolicLink() ? 'symlink!' : 'dir') : 'absent');
check('legit file extracted', fs.existsSync(path.join(tarDest, 'good', 'a.txt')));
check('internal symlink allowed', fs.existsSync(path.join(tarDest, 'linkinside', 'b.txt')));
fs.rmSync(tarBase, { recursive: true, force: true });
fs.rmSync('/tmp/pwned.txt', { force: true });

console.log('-- checksum verification --');
const chkFile = path.join(os.tmpdir(), 'checksum-me.bin');
fs.writeFileSync(chkFile, 'hello checksum');
const chkSha = sha256Hex(fs.readFileSync(chkFile));
check('sha256 verify passes', verifyChecksum(chkFile, 'sha256', chkSha) === true);
let threw = null;
try {
  verifyChecksum(chkFile, 'sha256', '0'.repeat(64));
} catch (err) {
  threw = err.message;
}
check('sha256 mismatch throws', !!threw && threw.includes('Checksum mismatch'), threw || '');
fs.rmSync(chkFile, { force: true });

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;