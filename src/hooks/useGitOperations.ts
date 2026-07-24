import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import * as gitService from '@/services/gitService'
import type { GitState, GitRemote, GitBranch, GitChange, FileNode } from '@/types/ide'

const CORS_PROXY = 'https://cors.isomorphic-git.org'

type GitOperation = 'idle' | 'initializing' | 'pulling' | 'pushing' | 'committing' | 'branching'

export function useGitOperations() {
  const { user } = useAuth()
  const [operation, setOperation] = useState<GitOperation>('idle')
  const [operationError, setOperationError] = useState<string | null>(null)
  const [operationProgress, setOperationProgress] = useState<string>('')
  const initializedRef = useRef(false)

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

  const initRepo = useCallback(async (defaultBranch: string = 'main'): Promise<GitState> => {
    setOperation('initializing')
    setOperationError(null)
    try {
      await gitService.initRepo(defaultBranch)
      initializedRef.current = true
      const branches: GitBranch[] = [{ name: defaultBranch, isActive: true, commits: [] }]
      return { branches, currentBranch: defaultBranch, changes: [], isInitialized: true, remote: null, isPulling: false, isPushing: false }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize repository'
      setOperationError(msg)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [])

  const commit = useCallback(async (
    message: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
  ): Promise<GitState> => {
    setOperation('committing')
    setOperationError(null)
    try {
      await ensureInit()
      const flatFiles = flattenFiles(files, fileContents)
      await gitService.writeFiles(flatFiles)
      await gitService.stageAll()
      await gitService.createCommit(message, { name: user?.email ?? 'User', email: user?.email ?? 'user@example.com' })
      return await buildGitState(files, fileContents, remote)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to commit'
      setOperationError(msg)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [ensureInit, buildGitState, user])

  const pull = useCallback(async (
    url: string,
    branch: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
    onProgress?: (stage: string, progress: number, total: number) => void,
  ): Promise<{ state: GitState; updatedFiles: Record<string, string> }> => {
    setOperation('pulling')
    setOperationError(null)
    try {
      await ensureInit()
      const flatFiles = flattenFiles(files, fileContents)
      await gitService.writeFiles(flatFiles)
      await gitService.stageAll()
      await gitService.commit('WIP: auto-save before pull', { name: user?.email ?? 'User', email: user?.email ?? 'user@example.com' }).catch(() => {})

      const auth = await getAuth()
      await gitService.pullFromRemote(url, branch, auth, CORS_PROXY, onProgress)

      const pulled = await gitService.readFiles()
      const updatedFiles: Record<string, string> = {}
      for (const f of pulled) {
        updatedFiles[f.path] = f.content
      }
      const mergedFileContents = { ...fileContents, ...updatedFiles }
      const newState = await buildGitState(files, mergedFileContents, remote)
      return { state: { ...newState, isPulling: false }, updatedFiles }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pull'
      setOperationError(msg)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [ensureInit, buildGitState, getAuth, user])

  const push = useCallback(async (
    url: string,
    branch: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
    onProgress?: (stage: string, progress: number, total: number) => void,
    onMessage?: (msg: string) => void,
  ): Promise<GitState> => {
    setOperation('pushing')
    setOperationError(null)
    try {
      await ensureInit()
      const flatFiles = flattenFiles(files, fileContents)
      await gitService.writeFiles(flatFiles)
      await gitService.stageAll()
      await gitService.createCommit('WIP: auto-save before push', { name: user?.email ?? 'User', email: user?.email ?? 'user@example.com' }).catch(() => {})

      const auth = await getAuth()
      const ok = await gitService.pushToRemote(url, branch, auth, CORS_PROXY, onProgress, onMessage)
      if (!ok) {
        throw new Error('Push failed. Check that you have write access and the remote URL is correct.')
      }
      return await buildGitState(files, fileContents, remote)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to push'
      setOperationError(msg)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [ensureInit, buildGitState, getAuth, user])

  const createBranch = useCallback(async (
    name: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
  ): Promise<GitState> => {
    setOperation('branching')
    setOperationError(null)
    try {
      await ensureInit()
      await gitService.createBranch(name, true)
      return await buildGitState(files, fileContents, remote)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch'
      setOperationError(msg)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [ensureInit, buildGitState])

  const switchBranch = useCallback(async (
    name: string,
    files: FileNode[],
    fileContents: Record<string, string>,
    remote: GitRemote | null,
  ): Promise<GitState> => {
    setOperation('branching')
    setOperationError(null)
    try {
      await ensureInit()
      await gitService.checkoutBranch(name)
      return await buildGitState(files, fileContents, remote)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch branch'
      setOperationError(msg)
      throw err
    } finally {
      setOperation('idle')
    }
  }, [ensureInit, buildGitState])

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
    clearError: () => setOperationError(null),
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

  // Detect deleted files
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