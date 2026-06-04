import { useRef, useState, useCallback } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import type { SketchEntity } from '../types'

interface SvgPath {
  type: 'line' | 'circle' | 'rectangle'
  params: Record<string, number>
}

function parseSvgPathData(d: string): SvgPath[] {
  const results: SvgPath[] = []
  const cmdRe = /([MLCHVmlchv])\s*([-\d.,\s]*)/g
  let match: RegExpExecArray | null
  let lastX = 0, lastY = 0

  while ((match = cmdRe.exec(d)) !== null) {
    const cmd = match[1]
    const nums = (match[2] || '').trim().split(/[\s,]+/).filter(Boolean).map(Number)

    switch (cmd) {
      case 'M':
        if (nums.length >= 2) { lastX = nums[0]; lastY = nums[1] }
        break
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: nums[i], y2: nums[i + 1] } })
          lastX = nums[i]; lastY = nums[i + 1]
        }
        break
      case 'H':
        results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: nums[0], y2: lastY } })
        lastX = nums[0]
        break
      case 'V':
        results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: lastX, y2: nums[0] } })
        lastY = nums[0]
        break
      case 'C':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: nums[4], y2: nums[5] } })
          lastX = nums[4]; lastY = nums[5]
        }
        break
      case 'm':
        if (nums.length >= 2) { lastX += nums[0]; lastY += nums[1] }
        break
      case 'l':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const nx = lastX + nums[i], ny = lastY + nums[i + 1]
          results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: nx, y2: ny } })
          lastX = nx; lastY = ny
        }
        break
      case 'h':
        results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: lastX + nums[0], y2: lastY } })
        lastX += nums[0]
        break
      case 'v':
        results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: lastX, y2: lastY + nums[0] } })
        lastY += nums[0]
        break
      case 'c':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const nx = lastX + nums[4], ny = lastY + nums[5]
          results.push({ type: 'line', params: { x1: lastX, y1: lastY, x2: nx, y2: ny } })
          lastX = nx; lastY = ny
        }
        break
    }
  }

  return results
}

function parseSvgText(text: string): SvgPath[] {
  const results: SvgPath[] = []
  const pathRe = /<path[^>]*d=["']([^"']*)["']/gi
  let match: RegExpExecArray | null
  while ((match = pathRe.exec(text)) !== null) {
    results.push(...parseSvgPathData(match[1]))
  }

  const rectRe = /<rect[^>]*x=["']([^"']*)["'][^>]*y=["']([^"']*)["'][^>]*width=["']([^"']*)["'][^>]*height=["']([^"']*)["']/gi
  while ((match = rectRe.exec(text)) !== null) {
    results.push({ type: 'rectangle', params: { x: parseFloat(match[1]) || 0, y: parseFloat(match[2]) || 0, width: parseFloat(match[3]) || 10, height: parseFloat(match[4]) || 10 } })
  }

  const circleRe = /<circle[^>]*cx=["']([^"']*)["'][^>]*cy=["']([^"']*)["'][^>]*r=["']([^"']*)["']/gi
  while ((match = circleRe.exec(text)) !== null) {
    results.push({ type: 'circle', params: { cx: parseFloat(match[1]) || 0, cy: parseFloat(match[2]) || 0, radius: parseFloat(match[3]) || 5 } })
  }

  return results
}

function createEntityId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function SketchImport() {
  const activeSketch = useCADStore(s => s.activeSketch)
  const addSketchEntity = useCADStore(s => s.addSketchEntity)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeSketch) return

    setStatus(`Reading ${file.name}...`)

    try {
      const text = await file.text()
      let paths: SvgPath[] = []

      if (file.name.endsWith('.svg')) {
        paths = parseSvgText(text)
      } else if (file.name.endsWith('.dxf')) {
        setStatus('DXF import: extracting LINE/CIRCLE entities...')
        const lineRe = /^0\s*\nLINE\s*\n8\s*\n[^\n]*\n(?:10\s*\n([-\d.eE+]+)\s*\n20\s*\n([-\d.eE+]+)\s*\n30\s*\n[^\n]*\n11\s*\n([-\d.eE+]+)\s*\n21\s*\n([-\d.eE+]+))/gm
        let lmatch: RegExpExecArray | null
        while ((lmatch = lineRe.exec(text)) !== null) {
          paths.push({
            type: 'line',
            params: { x1: parseFloat(lmatch[1]) || 0, y1: parseFloat(lmatch[2]) || 0, x2: parseFloat(lmatch[3]) || 0, y2: parseFloat(lmatch[4]) || 0 },
          })
        }

        const circleRe = /^0\s*\nCIRCLE\s*\n8\s*\n[^\n]*\n(?:10\s*\n([-\d.eE+]+)\s*\n20\s*\n([-\d.eE+]+)\s*\n30\s*\n[^\n]*\n40\s*\n([-\d.eE+]+))/gm
        while ((circleRe.lastIndex = text.indexOf('CIRCLE', circleRe.lastIndex)) >= 0) {
          const cmatch = circleRe.exec(text)
          if (cmatch) {
            paths.push({
              type: 'circle',
              params: { cx: parseFloat(cmatch[1]) || 0, cy: parseFloat(cmatch[2]) || 0, radius: parseFloat(cmatch[3]) || 5 },
            })
          }
        }
      }

      if (paths.length === 0) {
        setStatus('No entities found in file.')
        return
      }

      let imported = 0
      for (const path of paths) {
        const entity: SketchEntity = {
          id: createEntityId(),
          type: path.type as any,
          params: path.params,
          construction: false,
          locked: false,
          layer: 'default',
        }
        addSketchEntity(activeSketch, entity)
        imported++
      }

      setStatus(`Imported ${imported} entit${imported === 1 ? 'y' : 'ies'} from ${file.name}`)
    } catch (err) {
      setStatus(`Import error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    e.target.value = ''
  }, [activeSketch, addSketchEntity])

  if (!activeSketch) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No active sketch. Start a sketch to import into.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-xs font-medium">Import SVG / DXF</div>
      <div className="text-[10px] text-muted-foreground">
        Import entities into the active sketch.
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,.dxf"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        size="sm"
        variant="outline"
        className="w-full h-7 text-xs"
        onClick={() => fileInputRef.current?.click()}
      >
        Choose File...
      </Button>
      {status && (
        <div className="text-[10px] text-muted-foreground">{status}</div>
      )}
    </div>
  )
}
