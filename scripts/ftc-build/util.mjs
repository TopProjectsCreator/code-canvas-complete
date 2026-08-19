import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { unzipSync, gunzipSync, strFromU8 } from 'fflate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function log(msg) {
  console.log(`[ftc-build] ${msg}`);
}

export function toolchainRoot() {
  return process.env.FTC_TOOLCHAIN_DIR || path.join(__dirname, '..', '..', '.ftc-toolchain');
}

export function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function writeJson(file, data) {
  mkdirp(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function readFileIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export async function fetchJson(url, { timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'code-canvas-ftc-builder' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadFile(url, dest, { onProgress, timeoutMs = 900000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'code-canvas-ftc-builder' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const total = Number(res.headers.get('content-length') || 0);
    let received = 0;
    mkdirp(path.dirname(dest));
    const tmp = `${dest}.part`;
    const ws = fs.createWriteStream(tmp);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (!ws.write(Buffer.from(value))) {
        await new Promise((r) => ws.once('drain', r));
      }
      onProgress?.(received, total);
    }
    await new Promise((resolve, reject) => ws.end((err) => (err ? reject(err) : resolve())));
    fs.renameSync(tmp, dest);
    return dest;
  } finally {
    clearTimeout(timer);
  }
}

export function extractZip(zipPath, destDir) {
  const data = fs.readFileSync(zipPath);
  const entries = unzipSync(data);
  for (const [name, contents] of Object.entries(entries)) {
    if (name.endsWith('/')) continue;
    const out = path.join(destDir, ...name.split('/'));
    if (!out.startsWith(destDir + path.sep)) continue;
    mkdirp(path.dirname(out));
    fs.writeFileSync(out, contents);
  }
}

function parseOctal(buf, offset, length) {
  const text = buf.slice(offset, offset + length).toString('latin1').replace(/\0/g, '').trim();
  if (!text) return 0;
  return parseInt(text, 8) || 0;
}

function isInside(base, target) {
  const b = path.resolve(base);
  const t = path.resolve(target);
  return t === b || t.startsWith(b + path.sep);
}

/**
 * Ensure no path component between destDir and `out` is a symlink that
 * resolves outside destDir. Returns `out` when safe, null otherwise.
 * destDir itself is the boundary: if it does not exist yet, it is treated
 * as the (safe) anchor since extraction creates it.
 */
function safeAncestor(destDir, out) {
  const boundary = path.resolve(destDir);
  let dir = path.dirname(out);
  const missing = [];
  for (;;) {
    if (fs.existsSync(dir)) {
      let real;
      try {
        real = fs.realpathSync(dir);
      } catch {
        return null;
      }
      if (!isInside(boundary, real)) return null;
      const resolved = path.join(real, ...missing);
      return isInside(boundary, resolved) ? out : null;
    }
    if (path.resolve(dir) === boundary || dir === path.dirname(dir)) return out;
    missing.unshift(path.basename(dir));
    dir = path.dirname(dir);
  }
}

/**
 * Minimal ustar tar extractor (handles regular files, dirs, symlinks, and GNU
 * long names) — no external tar binary required on any platform.
 *
 * Symlink-safe: symlink targets that would escape the destination directory
 * are dropped, and regular files are never written through an escaping
 * symlinked ancestor.
 */
export function extractTarGz(tarGzPath, destDir) {
  const tar = Buffer.from(gunzipSync(fs.readFileSync(tarGzPath)));
  const chunk = (i) => tar.slice(i, i + 512);
  let offset = 0;
  const longName = { next: null };
  while (offset + 512 <= tar.length) {
    const header = chunk(offset);
    if (header[0] === 0) break;
    let name = header.slice(0, 100).toString('latin1').replace(/\0.*$/, '');
    const size = parseOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 0);
    const linkname = header.slice(157, 257).toString('latin1').replace(/\0.*$/, '');
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new Error(`Corrupt tar archive: ${tarGzPath}`);
    if (type === 'L') {
      longName.next = tar.slice(dataStart, dataEnd).toString('utf8').replace(/\0.*$/, '');
      offset = dataStart + Math.ceil(size / 512) * 512;
      continue;
    }
    if (type === 'x' || type === 'g') {
      offset = dataStart + Math.ceil(size / 512) * 512;
      continue;
    }
    if (longName.next) {
      name = longName.next;
      longName.next = null;
    }
    if (name.startsWith('./')) name = name.slice(2);
    const out = path.join(destDir, ...name.split('/'));
    const nextOffset = dataStart + Math.ceil(size / 512) * 512;
    if (!out.startsWith(destDir + path.sep)) {
      offset = nextOffset;
      continue;
    }
    if (type === '5') {
      if (!fs.existsSync(out)) mkdirp(out);
    } else if (type === '2') {
      const target = path.resolve(path.dirname(out), linkname);
      if (isInside(destDir, target)) {
        const parent = path.dirname(out);
        if (!fs.existsSync(parent)) mkdirp(parent);
        try {
          fs.symlinkSync(linkname, out);
        } catch {
          /* ignore broken links */
        }
      }
      // escaping symlink — dropped, never created
    } else if (safeAncestor(destDir, out)) {
      const parent = path.dirname(out);
      if (!fs.existsSync(parent)) mkdirp(parent);
      fs.writeFileSync(out, tar.slice(dataStart, dataEnd));
      if (name.includes('/bin/') || name.endsWith('/java') || name.endsWith('/javac')) {
        try {
          fs.chmodSync(out, 0o755);
        } catch {
          /* ignore */
        }
      }
    }
    // unsafe (symlinked ancestor escapes destDir) — entry dropped
    offset = nextOffset;
  }
}

export function extractAny(archivePath, destDir) {
  if (archivePath.endsWith('.zip')) extractZip(archivePath, destDir);
  else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) extractTarGz(archivePath, destDir);
  else throw new Error(`Unsupported archive format: ${archivePath}`);
}

function cappedAppend(existing, line, max) {
  let s = existing + line + '\n';
  if (s.length > max) s = s.slice(s.length - max);
  return s;
}

export function runProcess(cmd, args, { cwd, env, onLine, timeoutMs = 900000, maxCapture = 4 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    } catch (err) {
      resolve({ code: -1, stdout: '', stderr: String(err) });
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const pump = (stream, key) => {
      let buf = '';
      stream.on('data', (d) => {
        buf += d.toString();
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          onLine?.(line);
          if (key === 'stdout') stdout = cappedAppend(stdout, line, maxCapture);
          else stderr = cappedAppend(stderr, line, maxCapture);
        }
      });
      stream.on('end', () => {
        if (buf.length) {
          const line = buf.replace(/\r$/, '');
          onLine?.(line);
          if (key === 'stdout') stdout = cappedAppend(stdout, line, maxCapture);
          else stderr = cappedAppend(stderr, line, maxCapture);
        }
      });
    };
    pump(child.stdout, 'stdout');
    pump(child.stderr, 'stderr');
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ code: -1, stdout, stderr: stderr + `\nspawn error: ${err.message}` });
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ code: code ?? -1, stdout, stderr });
      }
    });
  });
}

export function memoryAwareJvmArgs() {
  const override = parseInt(process.env.FTC_GRADLE_HEAP_MB || '', 10);
  const totalMb = Math.floor(os.totalmem() / 1024 / 1024);
  const heapMb = override && Number.isFinite(override)
    ? Math.max(512, override)
    : Math.max(768, Math.min(3072, Math.floor(totalMb * 0.4)));
  const metaspaceMb = Math.max(384, Math.min(768, Math.floor(totalMb * 0.08)));
  return { heapMb, metaspaceMb };
}

/**
 * Cross-process mutex via a lock file. Stale locks (older than staleMs) are
 * stolen so a crashed process never deadlocks the toolchain.
 */
export async function withFileLock(lockPath, fn, { timeoutMs = 45 * 60 * 1000, staleMs = 30 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  mkdirp(path.dirname(lockPath));
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > staleMs) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for lock: ${lockPath}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      /* ignore */
    }
  }
}

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function sha1Hex(data) {
  return createHash('sha1').update(data).digest('hex');
}

/** Verify a file's checksum; throws on mismatch. */
export function verifyChecksum(filePath, type, expected) {
  const data = fs.readFileSync(filePath);
  const actual = type === 'sha256' ? sha256Hex(data) : sha1Hex(data);
  if (actual.toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`Checksum mismatch for ${filePath}: expected ${type} ${expected}, got ${actual}`);
  }
  return true;
}

export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

export { strFromU8, unzipSync };