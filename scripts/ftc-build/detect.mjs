import fs from 'fs';
import path from 'path';
import { readFileIfExists } from './util.mjs';

export function readProjectFile(projectDir, rel) {
  return readFileIfExists(path.join(projectDir, rel));
}

export function parseGradleVersion(projectDir) {
  const props = readProjectFile(projectDir, 'gradle/wrapper/gradle-wrapper.properties') || '';
  const m = props.match(/gradle-(\d+(?:\.\d+)*)-(?:bin|all|base)\.zip/);
  return m ? m[1] : null;
}

export function parseAgpVersion(projectDir) {
  const root = readProjectFile(projectDir, 'build.gradle') || '';
  const m = root.match(/com\.android\.tools\.build:gradle:(\d+(?:\.\d+)*)/);
  return m ? m[1] : null;
}

export function parseFtcSdkVersion(projectDir) {
  const candidates = [
    'TeamCode/build.gradle',
    'build.dependencies.gradle',
    'build.common.gradle',
    'FtcRobotController/build.gradle',
    'build.gradle',
  ];
  const text = candidates.map((f) => readProjectFile(projectDir, f) || '').join('\n');
  const m = text.match(/org\.firstinspires\.ftc:(?:RobotCore|FtcCommon|Hardware|FtcRobotController):(\d+(?:\.\d+)*)/);
  return m ? m[1] : null;
}

export function parseSdkConfig(projectDir) {
  const candidates = [
    'build.common.gradle',
    'FtcRobotController/build.gradle',
    'TeamCode/build.gradle',
    'build.gradle',
    'gradle.properties',
  ];
  const text = candidates.map((f) => readProjectFile(projectDir, f) || '').join('\n');
  const matchInt = (re) => {
    const m = text.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  const matchStr = (re) => {
    const m = text.match(re);
    return m ? m[1] : null;
  };
  return {
    compileSdk: matchInt(/compileSdk(?:Version)?\s+(?:=\s*)?(\d+)/),
    buildTools: matchStr(/buildToolsVersion\s+(?:=\s*)?["']?([\d.]+)/),
    minSdk: matchInt(/minSdk(?:Version)?\s+(?:=\s*)?(\d+)/),
    targetSdk: matchInt(/targetSdk(?:Version)?\s+(?:=\s*)?(\d+)/),
  };
}

export function pickJdkMajor(gradleVersion, agpVersion) {
  const g = gradleVersion ? parseFloat(gradleVersion) : 0;
  const a = agpVersion ? parseInt(agpVersion.split('.')[0], 10) : 0;
  let jdk = 17;
  if (g < 5) jdk = 8;
  else if (g < 6.8) jdk = 8;
  else if (g < 7.3) jdk = 11;
  else if (g < 8) jdk = 17;
  else jdk = 17;
  if (a >= 4 && a < 8 && g >= 7 && g < 7.3) jdk = 11;
  if (a >= 8) jdk = 17;
  return jdk;
}

export function jdkCandidatesFor(info) {
  const order = [info.jdkMajor, ...[21, 17, 11, 8].filter((v) => v !== info.jdkMajor)];
  return [...new Set(order)];
}

export function detectAppModule(projectDir) {
  const settings = readProjectFile(projectDir, 'settings.gradle') || '';
  const modules = [...settings.matchAll(/include\s+['"]?:([A-Za-z0-9_]+)['"]?/g)].map((m) => m[1]);
  if (modules.length === 0) modules.push('FtcRobotController', 'TeamCode');
  const candidates = [...new Set([...modules, 'TeamCode', 'FtcRobotController'])];
  const isApp = (module) => {
    const modGradle = readProjectFile(projectDir, `${module}/build.gradle`) || '';
    if (/com\.android\.application/.test(modGradle)) return true;
    if (/apply from:\s*['"].*build\.common\.gradle/.test(modGradle)) {
      const common = readProjectFile(projectDir, 'build.common.gradle') || '';
      return /com\.android\.application/.test(common);
    }
    return false;
  };
  const apps = candidates.filter(isApp);
  if (apps.includes('TeamCode')) return 'TeamCode';
  return apps[0] || null;
}

export function detectProject(projectDir) {
  const gradleVersion = parseGradleVersion(projectDir);
  const agpVersion = parseAgpVersion(projectDir);
  const sdkConfig = parseSdkConfig(projectDir);
  const ftcSdkVersion = parseFtcSdkVersion(projectDir);
  const hasAppModule = !!readProjectFile(projectDir, 'FtcRobotController/build.gradle');
  const hasTeamCode = !!readProjectFile(projectDir, 'TeamCode/build.gradle');
  const hasWrapper = !!readProjectFile(projectDir, 'gradlew') || !!readProjectFile(projectDir, 'gradlew.bat');
  return {
    gradleVersion,
    agpVersion,
    ftcSdkVersion,
    hasAppModule,
    hasTeamCode,
    hasWrapper,
    appModule: detectAppModule(projectDir),
    isWorkspace: hasAppModule && hasTeamCode,
    jdkMajor: pickJdkMajor(gradleVersion, agpVersion),
    ...sdkConfig,
  };
}

export function listTeamCodeJavaClasses(projectDir) {
  const base = path.join(projectDir, 'TeamCode', 'src', 'main', 'java');
  const classes = [];
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
      else if (e.isFile() && e.name.endsWith('.java')) {
        classes.push(`L${nextRel.slice(0, -'.java'.length)};`);
      }
    }
  };
  walk(base, '');
  return classes;
}