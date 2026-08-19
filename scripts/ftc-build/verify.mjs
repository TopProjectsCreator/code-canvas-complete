import fs from 'fs';
import path from 'path';
import { unzipSync, strFromU8, runProcess } from './util.mjs';

export function readApkZip(apkPath) {
  const buf = fs.readFileSync(apkPath);
  return unzipSync(new Uint8Array(buf));
}

export function verifyApkStructure(apkPath) {
  let zip;
  try {
    zip = readApkZip(apkPath);
  } catch {
    return {
      ok: false,
      dex: [],
      manifest: false,
      arsc: false,
      signature: false,
      entryCount: 0,
      sizeBytes: fs.statSync(apkPath).size,
    };
  }
  const names = Object.keys(zip);
  const dex = names.filter((n) => /^classes\d*\.dex$/.test(n));
  const manifest = names.includes('AndroidManifest.xml');
  const arsc = names.includes('resources.arsc');
  const signature = names.some((n) => /^META-INF\/.*\.(RSA|DSA|EC|SF)$/.test(n));
  return {
    ok: dex.length > 0 && manifest && arsc,
    dex,
    manifest,
    arsc,
    signature,
    entryCount: names.length,
    sizeBytes: fs.statSync(apkPath).size,
  };
}

export function dexContainsClasses(apkPath, classDescriptors) {
  const zip = readApkZip(apkPath);
  const dexText = Object.entries(zip)
    .filter(([n]) => /^classes\d*\.dex$/.test(n))
    .map(([, v]) => strFromU8(v))
    .join('');
  return classDescriptors.filter((c) => dexText.includes(c));
}

export async function verifySignature(apkPath, { javaBin, buildToolsDir }) {
  const jar = path.join(buildToolsDir, 'lib', 'apksigner.jar');
  if (!fs.existsSync(jar)) return { ok: false, output: `apksigner.jar not found in ${buildToolsDir}` };
  const r = await runProcess(javaBin, ['-jar', jar, 'verify', '--print-certs', apkPath], { timeoutMs: 120000 });
  return { ok: r.code === 0, output: (r.stdout || r.stderr).trim() };
}

export async function verifyAlignment(apkPath, { buildToolsDir }) {
  const zipalign = path.join(buildToolsDir, process.platform === 'win32' ? 'zipalign.exe' : 'zipalign');
  if (!fs.existsSync(zipalign)) return { ok: null, output: 'zipalign not available' };
  const r = await runProcess(zipalign, ['-c', '4', apkPath], { timeoutMs: 60000 });
  return { ok: r.code === 0, output: (r.stdout || r.stderr).trim() };
}