import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import LightningFS from '@isomorphic-git/lightning-fs'

const fs = new LightningFS('code-canvas-git')
const dir = '/repo'
const gitdir = dir + '/.git'

export type GitProgressCallback = (stage: string, progress: number, total: number) => void

async function ensureDir() {
  try {
    await fs.promises.stat(dir)
  } catch {
    await fs.promises.mkdir(dir)
  }
}

export async function initRepo(defaultBranch: string = 'main') {
  await ensureDir()
  await git.init({ fs: fs.promises, dir, defaultBranch })
}

export async function isRepoInitialized(): Promise<boolean> {
  try {
    await fs.promises.stat(gitdir)
    return true
  } catch {
    return false
  }
}

async function mkdirp(path: string) {
  const parts = path.split('/').filter(Boolean)
  let cur = ''
  for (const part of parts) {
    cur += '/' + part
    try { await fs.promises.mkdir(cur) } catch {}
  }
}

export async function writeFiles(
  files: Array<{ path: string; content: string }>,
) {
  await ensureDir()
  for (const file of files) {
    const fullPath = dir + '/' + file.path
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    await mkdirp(parentDir)
    await fs.promises.writeFile(fullPath, file.content)
  }
}

export async function readFiles(): Promise<Array<{ path: string; content: string }>> {
  async function readDirRecursive(basePath: string): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = []
    let entries: string[]
    try {
      entries = await fs.promises.readdir(basePath)
    } catch {
      return results
    }
    for (const entry of entries) {
      if (entry === '.git') continue
      const fullPath = basePath + '/' + entry
      const stat = await fs.promises.stat(fullPath)
      if (stat.isDirectory()) {
        results.push(...await readDirRecursive(fullPath))
      } else {
        const content = (await fs.promises.readFile(fullPath, 'utf-8')) as unknown as string
        const relativePath = fullPath.startsWith(dir + '/') ? fullPath.slice(dir.length + 1) : fullPath
        results.push({ path: relativePath, content })
      }
    }
    return results
  }
  return readDirRecursive(dir)
}

export async function stageAll() {
  await ensureDir()
  const files = await fs.promises.readdir(dir)
  for (const file of files) {
    if (file === '.git') continue
    try {
      await git.add({ fs: fs.promises, dir, filepath: file })
    } catch {}
  }
}

export async function createCommit(
  message: string,
  author: { name: string; email: string },
): Promise<string> {
  return git.commit({
    fs: fs.promises,
    dir,
    message,
    author: {
      name: author.name,
      email: author.email,
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: new Date().getTimezoneOffset(),
    },
  })
}

export async function pullFromRemote(
  remoteUrl: string,
  branch: string,
  auth: { username: string; password: string } | null,
  corsProxy: string = 'https://cors.isomorphic-git.org',
  onProgress?: GitProgressCallback,
): Promise<void> {
  await ensureDir()
  const callbacks: Record<string, any> = {}
  if (auth) {
    callbacks.onAuth = () => auth
  }
  if (onProgress) {
    callbacks.onProgress = (ev: { phase: string; loaded: number; total: number }) => {
      onProgress(ev.phase, ev.loaded, ev.total)
    }
  }
  await git.pull({
    fs: fs.promises,
    http,
    dir,
    ref: branch,
    url: remoteUrl,
    singleBranch: true,
    corsProxy,
    ...callbacks,
  })
}

export async function pushToRemote(
  remoteUrl: string,
  branch: string,
  auth: { username: string; password: string } | null,
  corsProxy: string = 'https://cors.isomorphic-git.org',
  onProgress?: GitProgressCallback,
  onMessage?: (msg: string) => void,
): Promise<boolean> {
  await ensureDir()
  const callbacks: Record<string, any> = {}
  if (auth) {
    callbacks.onAuth = () => auth
  }
  if (onProgress) {
    callbacks.onProgress = (ev: { phase: string; loaded: number; total: number }) => {
      onProgress(ev.phase, ev.loaded, ev.total)
    }
  }
  if (onMessage) {
    callbacks.onMessage = onMessage
  }
  const result = await git.push({
    fs: fs.promises,
    http,
    dir,
    remoteRef: branch,
    url: remoteUrl,
    corsProxy,
    ...callbacks,
  })
  return result.ok
}

export async function setRemote(url: string) {
  await ensureDir()
  try {
    await git.deleteRemote({ fs: fs.promises, dir, remote: 'origin' })
  } catch {}
  await git.addRemote({ fs: fs.promises, dir, remote: 'origin', url })
}

export async function listBranches(): Promise<string[]> {
  try {
    return await git.listBranches({ fs: fs.promises, dir })
  } catch {
    return []
  }
}

export async function listRemoteBranches(remoteUrl: string, corsProxy: string = 'https://cors.isomorphic-git.org'): Promise<string[]> {
  try {
    const info = await git.getRemoteInfo({ http, url: remoteUrl, corsProxy })
    return Object.keys(info.refs?.heads ?? {})
  } catch {
    return []
  }
}

export async function createBranch(name: string, checkout: boolean = true) {
  await git.branch({ fs: fs.promises, dir, ref: name, checkout })
}

export async function checkoutBranch(name: string) {
  await git.checkout({ fs: fs.promises, dir, ref: name })
}

export async function getCurrentBranch(): Promise<string> {
  try {
    return (await git.currentBranch({ fs: fs.promises, dir })) ?? 'main'
  } catch {
    return 'main'
  }
}

export async function logCommits(depth: number = 30): Promise<Array<{ oid: string; message: string; timestamp: number; author: { name: string; email: string } }>> {
  try {
    const commits = await git.log({ fs: fs.promises, dir, depth })
    return commits.map(c => ({
      oid: c.oid,
      message: c.commit.message,
      timestamp: c.commit.author.timestamp,
      author: c.commit.author,
    }))
  } catch {
    return []
  }
}

export async function getStatusMatrix(): Promise<Array<[string, number, number, number]>> {
  try {
    return await git.statusMatrix({ fs: fs.promises, dir })
  } catch {
    return []
  }
}

export async function flush() {
  await fs.flush()
}