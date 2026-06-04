import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCADStore } from '../store'
import type { PrimitiveFeature } from '../types'

const PRIMITIVE_TYPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane'] as const

const DEFAULT_PARAMS: Record<string, Record<string, number>> = {
  box: { width: 10, height: 10, depth: 10 },
  sphere: { radius: 5, segments: 32 },
  cylinder: { radiusTop: 5, radiusBottom: 5, height: 10, segments: 32 },
  cone: { radiusTop: 0, radiusBottom: 5, height: 10, segments: 32 },
  torus: { radius: 5, tube: 1.5, radialSegments: 16, tubularSegments: 32 },
  plane: { width: 10, height: 10 },
}

export function PrimitiveTool() {
  const [type, setType] = useState<string>('box')
  const [params, setParams] = useState<Record<string, number>>(DEFAULT_PARAMS.box)
  const addFeature = useCADStore(s => s.addFeature)
  const doc = useCADStore(s => s.doc)
  const setToolMode = useCADStore(s => s.setToolMode)

  const bodyIds = Object.keys(doc.bodies)
  const [selectedBody, setSelectedBody] = useState(bodyIds[0] ?? '')

  function handleTypeChange(newType: string) {
    setType(newType)
    setParams({ ...DEFAULT_PARAMS[newType] ?? {} })
  }

  function handleParamChange(key: string, value: string) {
    setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }))
  }

  function handleAdd() {
    if (!selectedBody) return
    const feature: PrimitiveFeature = {
      id: `prim_${Date.now()}`,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      type: 'primitive',
      primitiveType: type as PrimitiveFeature['primitiveType'],
      params: { ...params },
      visible: true,
      suppressed: false,
      bodyId: selectedBody,
      featureIndex: 0,
      dependencies: [],
    }
    addFeature(selectedBody, feature)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-3">
      <div className="text-sm font-medium">Add Primitive</div>

      <div className="space-y-2">
        <Label className="text-xs">Type</Label>
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIMITIVE_TYPES.map(t => (
              <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {Object.entries(params).map(([key, value]) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
          <Input
            className="h-8 text-xs"
            type="number"
            value={value}
            onChange={e => handleParamChange(key, e.target.value)}
          />
        </div>
      ))}

      {bodyIds.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs">Target Body</Label>
          <Select value={selectedBody} onValueChange={setSelectedBody}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bodyIds.map(bid => (
                <SelectItem key={bid} value={bid} className="text-xs">
                  {doc.bodies[bid]?.name ?? bid}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button size="sm" className="w-full text-xs" onClick={handleAdd}>
        Add {type.charAt(0).toUpperCase() + type.slice(1)}
      </Button>
    </div>
  )
}
