import { useState, useCallback, useRef } from 'react'
import type { SvgDocument, HistoryEntry } from './types'

const MAX_HISTORY = 100

function docToEntry(doc: SvgDocument): HistoryEntry {
  return {
    elements: JSON.parse(JSON.stringify(doc.elements)),
    gradients: JSON.parse(JSON.stringify(doc.gradients)),
    patterns: JSON.parse(JSON.stringify(doc.patterns)),
    filters: JSON.parse(JSON.stringify(doc.filters)),
  }
}

function entryToDoc(entry: HistoryEntry, doc: SvgDocument): SvgDocument {
  return {
    ...doc,
    elements: JSON.parse(JSON.stringify(entry.elements)),
    gradients: JSON.parse(JSON.stringify(entry.gradients)),
    patterns: JSON.parse(JSON.stringify(entry.patterns)),
    filters: JSON.parse(JSON.stringify(entry.filters)),
  }
}

export function useHistory(initialDoc: SvgDocument) {
  const [past, setPast] = useState<HistoryEntry[]>([])
  const [future, setFuture] = useState<HistoryEntry[]>([])
  const docRef = useRef(initialDoc)
  const pushingRef = useRef(false)

  const push = useCallback((doc: SvgDocument) => {
    docRef.current = doc
    if (pushingRef.current) return
    pushingRef.current = true

    const entry = docToEntry(doc)
    setPast((prev) => {
      const next = [...prev, entry]
      if (next.length > MAX_HISTORY) next.shift()
      return next
    })
    setFuture([])

    setTimeout(() => { pushingRef.current = false }, 0)
  }, [])

  const undo = useCallback((): SvgDocument | null => {
    if (past.length === 0) return null
    const lastPast = past[past.length - 1]
    const newPast = past.slice(0, -1)

    const currentEntry = docToEntry(docRef.current)

    setPast(newPast)
    setFuture((prev) => [currentEntry, ...prev])

    return entryToDoc(lastPast, docRef.current)
  }, [past])

  const redo = useCallback((): SvgDocument | null => {
    if (future.length === 0) return null
    const firstFuture = future[0]
    const newFuture = future.slice(1)

    const currentEntry = docToEntry(docRef.current)

    setFuture(newFuture)
    setPast((prev) => [...prev, currentEntry])

    return entryToDoc(firstFuture, docRef.current)
  }, [future])

  const reset = useCallback((doc: SvgDocument) => {
    docRef.current = doc
    setPast([])
    setFuture([])
  }, [])

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
