import { useCADStore } from '../store'
import { TransformProperties } from './TransformProperties'
import { FeatureProperties } from './FeatureProperties'
import { BodyProperties } from './BodyProperties'
import { SceneProperties } from './SceneProperties'
import { MaterialProperties } from './MaterialProperties'
import { PropertySearch } from './PropertySearch'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'

export function PropertiesPanel() {
  const selection = useCADStore(s => s.selection)
  const [tab, setTab] = useState<'properties' | 'materials' | 'scene'>('properties')

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b text-xs">
        <button
          className={`flex-1 py-1.5 text-center ${tab === 'properties' ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('properties')}
        >
          Properties
        </button>
        <button
          className={`flex-1 py-1.5 text-center ${tab === 'materials' ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('materials')}
        >
          Materials
        </button>
        <button
          className={`flex-1 py-1.5 text-center ${tab === 'scene' ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('scene')}
        >
          Scene
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {tab === 'properties' && (
          <>
            {selection.length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing selected</p>
            )}

            {selection.some(s => s.type === 'feature') && (
              <FeatureProperties />
            )}

            {selection.some(s => s.type === 'body' || s.type === 'node') && (
              <>
                <TransformProperties />
                <Separator />
                <BodyProperties />
              </>
            )}

            {selection.some(s => s.type === 'vertex' || s.type === 'edge' || s.type === 'face') && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-medium">Sub-object Selection</div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <span>Vertices: {selection.filter(s => s.type === 'vertex').length}</span>
                  <span>Edges: {selection.filter(s => s.type === 'edge').length}</span>
                  <span>Faces: {selection.filter(s => s.type === 'face').length}</span>
                </div>
              </div>
            )}

            <PropertySearch />
          </>
        )}

        {tab === 'materials' && <MaterialProperties />}

        {tab === 'scene' && <SceneProperties />}
      </div>
    </div>
  )
}
