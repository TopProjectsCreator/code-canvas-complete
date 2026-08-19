import fs from 'fs';
import path from 'path';
import { runProcess, log } from './util.mjs';
import { detectProject, jdkCandidatesFor } from './detect.mjs';
import { gradleHome, ensureJdk } from './toolchain.mjs';

const BUILD_TIMEOUT_MS = 25 * 60 * 1000;

export function findApk(projectDir, appModule) {
  const module = appModule || detectProject(projectDir).appModule || 'FtcRobotController';
  const dir = path.join(projectDir, module, 'build', 'outputs', 'apk', 'debug');
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.apk'));
    if (files.length === 0) return null;
    files.sort();
    return path.join(dir, files[0]);
  } catch {
    return null;
  }
}

export function parseBuildErrors(output) {
  const errors = [];
  const re = /^([^\n]*\.java:\d+):\s*error:\s*(.*)$/gm;
  let m;
  while ((m = re.exec(output))) {
    const line = `${m[1]}: error: ${m[2]}`;
    if (!errors.includes(line)) errors.push(line);
    if (errors.length >= 50) break;
  }
  if (errors.length === 0) {
    const whatWentWrong = output.match(/What went wrong:[\s\S]{0,500}/);
    if (whatWentWrong) {
      errors.push(whatWentWrong[0].trim());
    } else {
      const lines = output.trim().split('\n');
      errors.push(lines.slice(-6).join('\n'));
    }
  }
  return errors;
}

const JDK_MISMATCH_RE =
  /Unsupported class file major version|Unsupported Java version|requires Java \d+|is not compatible with this version of Gradle|Unable to start the daemon process[\s\S]{0,200}(class file|version)|has been compiled by a more recent version of the Java Runtime/i;

function buildEnv(jdkHome, gradleUserHome) {
  const jdkBin = path.join(jdkHome, 'bin');
  return {
    JAVA_HOME: jdkHome,
    PATH: `${jdkBin}${path.delimiter}${process.env.PATH || ''}`,
    GRADLE_USER_HOME: gradleUserHome,
    // Some sandboxed hosts block posix_spawn; force the classic fork/exec path
    // for the launcher and for any JVM children (daemon/workers inherit env).
    GRADLE_OPTS: '-Djdk.lang.Process.launchMechanism=fork',
    JAVA_TOOL_OPTIONS: '-Djdk.lang.Process.launchMechanism=fork',
  };
}

async function runGradleOnce(projectDir, { jdkHome, gradleUserHome, onLine, timeoutMs }) {
  const win = process.platform === 'win32';
  const info = detectProject(projectDir);
  const appModule = info.appModule || 'FtcRobotController';
  const gradleMajor = info.gradleVersion ? parseInt(info.gradleVersion.split('.')[0], 10) : 8;
  const taskArgs = [`:${appModule}:assembleDebug`, '--no-daemon'];
  if (gradleMajor >= 4) taskArgs.push('--console=plain');
  const env = buildEnv(jdkHome, gradleUserHome);
  if (win) {
    const r = await runProcess('cmd.exe', ['/d', '/s', '/c', path.join(projectDir, 'gradlew.bat'), ...taskArgs], {
      cwd: projectDir,
      env,
      onLine,
      timeoutMs,
    });
    return r;
  }
  const gradlew = path.join(projectDir, 'gradlew');
  fs.chmodSync(gradlew, 0o755);
  return runProcess(gradlew, taskArgs, { cwd: projectDir, env, onLine, timeoutMs });
}

/**
 * Build the FTC workspace. Tries the detected JDK first, then escalates through
 * the candidate ladder if the JDK/Gradle combination mismatches.
 */
export async function buildProject(projectDir, { jdkHome, jdkCandidates, gradleUserHome, onLine, timeoutMs = BUILD_TIMEOUT_MS } = {}) {
  const info = detectProject(projectDir);
  const candidates = jdkCandidates || jdkCandidatesFor(info);
  const gHome = gradleUserHome || gradleHome();
  const tried = new Set();
  for (const jdkMajor of candidates) {
    if (tried.has(jdkMajor)) continue;
    tried.add(jdkMajor);
    let home;
    try {
      home = jdkHome && jdkMajor === info.jdkMajor ? jdkHome : await ensureJdk(jdkMajor, onLine);
    } catch (err) {
      log(`JDK ${jdkMajor} unavailable: ${err.message}`);
      continue;
    }
    log(`building with JDK ${jdkMajor} (${home})`);
    const r = await runGradleOnce(projectDir, { jdkHome: home, gradleUserHome: gHome, onLine, timeoutMs });
    const output = r.stdout + '\n' + r.stderr;
    if (r.code === 0) {
      const apkPath = findApk(projectDir, info.appModule);
      return { code: 0, output, apkPath, errors: [], jdkMajor };
    }
    if (!JDK_MISMATCH_RE.test(output)) {
      return { code: r.code, output, apkPath: null, errors: parseBuildErrors(output), jdkMajor };
    }
    log(`JDK ${jdkMajor} mismatch with this project — trying the next candidate`);
  }
  return { code: 1, output: '', apkPath: null, errors: ['No compatible JDK found for this project'], jdkMajor: null };
}