import { useEffect, useRef } from 'react'
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
  // Latest file.name held in a ref so the load-once-per-file effect can read
  // fresh values without depending on them.
  const fileNameRef = useRef(file.name);
  fileNameRef.current = file.name;
  const fileContentRef = useRef(file.content);
  fileContentRef.current = file.content;

  useEffect(() => {
    if (fileContentRef.current) {
      try {
        const parsed = JSON.parse(fileContentRef.current) as CadDocument
        parsed.metadata.name = fileNameRef.current
        loadDoc(parsed, fileNameRef.current)
      } catch {
        useCADStore.getState().resetDoc()
      }
    } else {
      const demo = createDemoDocument()
      demo.metadata.name = fileNameRef.current
      loadDoc(demo, fileNameRef.current)
    }
  }, [file.id, fileNameRef, fileContentRef, loadDoc])

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
