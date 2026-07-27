import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import * as gitService from '@/services/gitService'
import type { GitState, GitRemote, GitBranch, GitChange, FileNode } from '@/types/ide'

const CORS_PROXY = 'https://cors.isomorphic-git.org'

type GitOperation = 'idle' | 'initializing' | 'pulling' | 'pushing' | 'committing' | 'branching'

export interface GitProgress {
  stage: string
  loaded: number
  total: number
}

export interface GitLastResult {
  label: string
  status: 'success' | 'error'
  message: string
  at: number
}

interface GitStatusState {
  operation: GitOperation
  operationLabel: string | null
  error: string | null
  progress: GitProgress | null
  lastResult: GitLastResult | null
  lastFailed: { label: string; retry: () => Promise<unknown> } | null
}

// Module-level shared status store so both IDELayout and GitPanel see the same state.
const initialStatus: GitStatusState = {
  operation: 'idle',
  operationLabel: null,
  error: null,
  progress: null,
  lastResult: null,
  lastFailed: null,
}
let sharedStatus: GitStatusState = initialStatus
const statusListeners = new Set<(s: GitStatusState) => void>()

function setStatus(patch: Partial<GitStatusState>) {
  sharedStatus = { ...sharedStatus, ...patch }
  statusListeners.forEach((l) => l(sharedStatus))
}

export function useGitStatus() {
  const [snapshot, setSnapshot] = useState<GitStatusState>(sharedStatus)
  useEffect(() => {
    const fn = (s: GitStatusState) => setSnapshot(s)
    statusListeners.add(fn)
    // Sync in case status changed between render and effect.
    setSnapshot(sharedStatus)
    return () => {
      statusListeners.delete(fn)
    }
  }, [])
  return {
    ...snapshot,
    clearError: useCallback(() => setStatus({ error: null, lastFailed: null }), []),
    dismissLastResult: useCallback(() => setStatus({ lastResult: null }), []),
    retry: useCallback(async () => {
      const lf = sharedStatus.lastFailed
      if (!lf) return
      try {
        await lf.retry()
      } catch {
        // Errors are already surfaced via the hook's wrapper.
      }
    }, []),
  }
}

export function useGitOperations() {
  const { user } = useAuth()
  const [operation, setOperation] = useState<GitOperation>('idle')
  const [operationError, setOperationError] = useState<string | null>(null)
  const [operationProgress, setOperationProgress] = useState<string>('')
  const initializedRef = useRef(false)
  const commitRef = useRef<(message: string, files: FileNode[], fileContents: Record<string, string>, remote: GitRemote | null) => Promise<GitState>>(null!)
  const pullRef = useRef<(url: string, branch: string, files: FileNode[], fileContents: Record<string, string>, remote: GitRemote | null, onProgress?: (stage: string, progress: number, total: number) => void) => Promise<{ state: GitState; updatedFiles: Record<string, string> }>>(null!)
  const pushRef = useRef<(url: string, branch: string, files: FileNode[], fileContents: Record<string, string>, remote: GitRemote | null, onProgress?: (stage: string, progress: number, total: number) => void, onMessage?: (msg: string) => void) => Promise<GitState>>(null!)
  const createBranchRef = useRef<(name: string, files: FileNode[], fileContents: Record<string, string>, remote: GitRemote | null) => Promise<GitState>>(null!)
  const switchBranchRef = useRef<(name: string, files: FileNode[], fileContents: Record<string, string>, remote: GitRemote | null) => Promise<GitState>>(null!)

  const getAuth = useCallback(async (): Promise<{ username: string; password: string } | null> => {
    if (!user) return null
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('provider', 'github')
        .maybeSingle()
      if (data?.api_key) {
        return { username: user.email ?? user.id, password: data.api_key }
      }
    } catch {}
    return null
  }, [user])

  const ensureInit = useCallback(async () => {
    if (initializedRef.current) return
    const exists = await gitService.isRepoInitialized()
    if (!exists) {
      await gitService.initRepo()
    }
    initializedRef.current = true
  }, [])

  const buildGitState = useCallback(async (
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
    originalFileContents?: Record<string, string>,
  ): Promise<GitState> => {
    await ensureInit()
    const [reposBranches, currentBranch, commits] = await Promise.all([
      gitService.listBranches(),
      gitService.getCurrentBranch(),
      gitService.logCommits(30),
    ])
    const changes = detectChanges(files, fileContents, originalFileContents)
    const branches: GitBranch[] = reposBranches.map(name => ({
      name,
      isActive: name === currentBranch,
      commits: name === currentBranch ? commits.map(c => ({
        id: c.oid,
        message: c.message,
        timestamp: new Date(c.timestamp * 1000),
        author: c.author.name,
        files: [],
      })) : [],
    }))
    if (branches.length === 0) {
      branches.push({ name: currentBranch, isActive: true, commits: [] })
    }
    return { branches, currentBranch, changes, isInitialized: true, remote, isPulling: false, isPushing: false }
  }, [ensureInit])

  // Central runner that publishes status + toasts + tracks retry.
  const run = useCallback(async <T,>(
    op: Exclude<GitOperation, 'idle'>,
    label: string,
    fn: () => Promise<T>,
    retryFactory: () => () => Promise<T>,
  ): Promise<T> => {
    setOperation(op)
    setOperationError(null)
    setOperationProgress('')
    setStatus({
      operation: op,
      operationLabel: label,
      error: null,
      progress: null,
    })
    try {
      const result = await fn()
      setStatus({
        operation: 'idle',
        operationLabel: null,
        progress: null,
        error: null,
        lastFailed: null,
        lastResult: { label, status: 'success', message: `${label} completed`, at: Date.now() },
      })
      toast.success(`${label} completed`)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${label.toLowerCase()}`
      setOperationError(msg)
      setStatus({
        operation: 'idle',
        operationLabel: null,
        progress: null,
        error: msg,
        lastFailed: { label, retry: retryFactory() },
        lastResult: { label, status: 'error', message: msg, at: Date.now() },
      })
      toast.error(`${label} failed: ${msg}`)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [])

  const initRepo = useCallback(async (defaultBranch: string = 'main'): Promise<GitState> => {
    return run('initializing', 'Initialize repository', async () => {
      await gitService.initRepo(defaultBranch)
      initializedRef.current = true
      const branches: GitBranch[] = [{ name: defaultBranch, isActive: true, commits: [] }]
      return { branches, currentBranch: defaultBranch, changes: [], isInitialized: true, remote: null, isPulling: false, isPushing: false }
    }, () => () => initRepo(defaultBranch))
  }, [run])

  const commit = useCallback(async (
    message: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
  ): Promise<GitState> => {
    return run('committing', 'Commit', async () => {
      await ensureInit()
      const flatFiles = flattenFiles(files, fileContents)
      await gitService.writeFiles(flatFiles)
      await gitService.stageAll()
      await gitService.createCommit(message, { name: user?.email ?? 'User', email: user?.email ?? 'user@example.com' })
      return await buildGitState(files, fileContents, remote)
    }, () => () => commitRef.current(message, files, fileContents, remote))
  }, [run, ensureInit, buildGitState, user])
  commitRef.current = commit

  const pull = useCallback(async (
    url: string,
    branch: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
    onProgress?: (stage: string, progress: number, total: number) => void,
  ): Promise<{ state: GitState; updatedFiles: Record<string, string> }> => {
    return run('pulling', 'Pull', async () => {
      await ensureInit()
      const flatFiles = flattenFiles(files, fileContents)
      await gitService.writeFiles(flatFiles)
      await gitService.stageAll()
      await gitService.createCommit('WIP: auto-save before pull', { name: user?.email ?? 'User', email: user?.email ?? 'user@example.com' }).catch(() => {})

      const auth = await getAuth()
      await gitService.pullFromRemote(url, branch, auth, CORS_PROXY, (stage, loaded, total) => {
        setStatus({ progress: { stage, loaded, total } })
        setOperationProgress(stage)
        onProgress?.(stage, loaded, total)
      })

      const pulled = await gitService.readFiles()
      const updatedFiles: Record<string, string> = {}
      for (const f of pulled) {
        updatedFiles[f.path] = f.content
      }
      const mergedFileContents = { ...fileContents, ...updatedFiles }
      const newState = await buildGitState(files, mergedFileContents, remote)
      return { state: { ...newState, isPulling: false }, updatedFiles }
    }, () => () => pullRef.current(url, branch, files, fileContents, remote, onProgress))
  }, [run, ensureInit, buildGitState, getAuth, user])
  pullRef.current = pull

  const push = useCallback(async (
    url: string,
    branch: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
    onProgress?: (stage: string, progress: number, total: number) => void,
    onMessage?: (msg: string) => void,
  ): Promise<GitState> => {
    return run('pushing', 'Push', async () => {
      await ensureInit()
      const flatFiles = flattenFiles(files, fileContents)
      await gitService.writeFiles(flatFiles)
      await gitService.stageAll()
      await gitService.createCommit('WIP: auto-save before push', { name: user?.email ?? 'User', email: user?.email ?? 'user@example.com' }).catch(() => {})

      const auth = await getAuth()
      const ok = await gitService.pushToRemote(url, branch, auth, CORS_PROXY, (stage, loaded, total) => {
        setStatus({ progress: { stage, loaded, total } })
        setOperationProgress(stage)
        onProgress?.(stage, loaded, total)
      }, onMessage)
      if (!ok) {
        throw new Error('Push failed. Check that you have write access and the remote URL is correct.')
      }
      return await buildGitState(files, fileContents, remote)
    }, () => () => pushRef.current(url, branch, files, fileContents, remote, onProgress, onMessage))
  }, [run, ensureInit, buildGitState, getAuth, user])
  pushRef.current = push

  const createBranch = useCallback(async (
    name: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
  ): Promise<GitState> => {
    return run('branching', `Create branch ${name}`, async () => {
      await ensureInit()
      await gitService.createBranch(name, true)
      return await buildGitState(files, fileContents, remote)
    }, () => () => createBranchRef.current(name, files, fileContents, remote))
  }, [run, ensureInit, buildGitState])
  createBranchRef.current = createBranch

  const switchBranch = useCallback(async (
    name: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
  ): Promise<GitState> => {
    return run('branching', `Switch to ${name}`, async () => {
      await ensureInit()
      await gitService.checkoutBranch(name)
      return await buildGitState(files, fileContents, remote)
    }, () => () => switchBranchRef.current(name, files, fileContents, remote))
  }, [run, ensureInit, buildGitState])
  switchBranchRef.current = switchBranch

  const setRemoteUrl = useCallback(async (url: string): Promise<void> => {
    await ensureInit()
    await gitService.setRemote(url)
  }, [ensureInit])

  const parseRemoteUrl = useCallback((url: string): GitRemote | null => {
    const githubMatch = url.match(/github\.com[:\/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
    if (githubMatch) {
      return {
        url: url.endsWith('.git') ? url : `https://github.com/${githubMatch[1]}/${githubMatch[2]}.git`,
        owner: githubMatch[1],
        repo: githubMatch[2],
        branch: 'main',
      }
    }
    const gitlabMatch = url.match(/gitlab\.com[:\/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
    if (gitlabMatch) {
      return {
        url: url.endsWith('.git') ? url : `https://gitlab.com/${gitlabMatch[1]}/${gitlabMatch[2]}.git`,
        owner: gitlabMatch[1],
        repo: gitlabMatch[2],
        branch: 'main',
      }
    }
    const bitbucketMatch = url.match(/bitbucket\.org[:\/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
    if (bitbucketMatch) {
      return {
        url: url.endsWith('.git') ? url : `https://bitbucket.org/${bitbucketMatch[1]}/${bitbucketMatch[2]}.git`,
        owner: bitbucketMatch[1],
        repo: bitbucketMatch[2],
        branch: 'main',
      }
    }
    return { url: url.endsWith('.git') ? url : url + '.git', owner: '', repo: '', branch: 'main' }
  }, [])

  return {
    initRepo,
    commit,
    pull,
    push,
    createBranch,
    switchBranch,
    setRemoteUrl,
    parseRemoteUrl,
    buildGitState,
    operation,
    operationError,
    operationProgress,
    clearError: () => {
      setOperationError(null)
      setStatus({ error: null, lastFailed: null })
    },
  }
}

function flattenFiles(
  nodes: FileNode[],
  fileContents: Record<string, string>,
  prefix: string = '',
): Array<{ path: string; content: string }> {
  const result: Array<{ path: string; content: string }> = []
  for (const node of nodes) {
    if (node.type === 'file') {
      const content = fileContents[node.id] ?? node.content ?? ''
      result.push({ path: prefix + node.name, content })
    } else if (node.children) {
      result.push(...flattenFiles(node.children, fileContents, prefix + node.name + '/'))
    }
  }
  return result
}

function detectChanges(
  nodes: FileNode[],
  fileContents: Record<string, string>,
  originalFileContents?: Record<string, string>,
): GitChange[] {
  const changes: GitChange[] = []
  const currentFileIds = new Set<string>()

  const walk = (children: FileNode[]) => {
    for (const node of children) {
      if (node.type === 'file') {
        currentFileIds.add(node.id)
        const currentContent = fileContents[node.id] ?? node.content ?? ''
        const originalContent = node.content ?? ''
        const status = !originalContent && currentContent ? 'added' : 'modified'
        changes.push({
          fileId: node.id,
          fileName: node.name,
          status,
          originalContent,
        })
      }
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)

  if (originalFileContents) {
    for (const [fileId, content] of Object.entries(originalFileContents)) {
      if (!currentFileIds.has(fileId)) {
        changes.push({
          fileId,
          fileName: fileId.split('/').pop() || fileId,
          status: 'deleted',
          originalContent: content,
        })
      }
    }
  }

  return changes
}
