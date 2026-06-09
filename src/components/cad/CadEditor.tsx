import { useEffect } from 'react'
import { CadLayout } from './layout/CadLayout'
import { useCADStore } from './store'
import type { CadDocument } from './types'
import { createDemoDocument } from './demo/createDemoDocument'

interface CadEditorProps {
  file: { id: string; name: string; content?: string }
  onContentChange: (fileId: string, content: string) => void
}

export function CadEditor({ file, onContentChange }: CadEditorProps) {
  const loadDoc = useCADStore(s => s.loadDoc)
  const doc = useCADStore(s => s.doc)
  const dirty = useCADStore(s => s.dirty)

  useEffect(() => {
    if (file.content) {
      try {
        const parsed = JSON.parse(file.content) as CadDocument
        parsed.metadata.name = file.name
        loadDoc(parsed, file.name)
      } catch {
        useCADStore.getState().resetDoc()
      }
    } else {
      const demo = createDemoDocument()
      demo.metadata.name = file.name
      loadDoc(demo, file.name)
    }
  }, [file.id])

  useEffect(() => {
    if (dirty) {
      const timer = setTimeout(() => {
        onContentChange(file.id, JSON.stringify(doc, null, 2))
        useCADStore.getState().markClean()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [dirty, doc, file.id, onContentChange])

  return <CadLayout />
}
