import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  CadDocument, Body, Feature, SceneNode, Sketch, SketchEntity, Constraint, Transform,
  SelectionTarget, ToolMode, Command, BackgroundTask,
  GizmoState, SnapSettings, ViewportSettings, WorkspaceLayout, CollabUser, PlaneRef, MaterialDef,
} from './types'
import { CAD_DOCUMENT_VERSION, CAD_APP_VERSION } from './constants'

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function selectionEqual(a: SelectionTarget, b: SelectionTarget): boolean {
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'node': return b.type === 'node' && a.nodeId === b.nodeId
    case 'body': return b.type === 'body' && a.bodyId === b.bodyId
    case 'feature': return b.type === 'feature' && a.featureId === b.featureId
    case 'face': return b.type === 'face' && a.bodyId === b.bodyId && a.faceIndex === b.faceIndex
    case 'edge': return b.type === 'edge' && a.bodyId === b.bodyId && a.edgeIndex === b.edgeIndex
    case 'vertex': return b.type === 'vertex' && a.bodyId === b.bodyId && a.vertexIndex === b.vertexIndex
    case 'sketch-entity': return b.type === 'sketch-entity' && a.sketchId === b.sketchId && a.entityId === b.entityId
    case 'sketch-constraint': return b.type === 'sketch-constraint' && a.sketchId === b.sketchId && a.constraintId === b.constraintId
    case 'construction-plane': return b.type === 'construction-plane' && a.planeId === b.planeId
    case 'construction-axis': return b.type === 'construction-axis' && a.axisId === b.axisId
    case 'construction-point': return b.type === 'construction-point' && a.pointId === b.pointId
    case 'construction-csys': return b.type === 'construction-csys' && a.csysId === b.csysId
    default: return false
  }
}

function createDefaultDocument(name = 'Untitled'): CadDocument {
  const bodyId = `body_${generateId()}`
  return {
    version: CAD_DOCUMENT_VERSION,
    bodies: {
      [bodyId]: {
        id: bodyId,
        name: 'Body 1',
        features: [],
        appearance: { color: '#94a3b8', opacity: 1, roughness: 0.5, metalness: 0.3, visible: true, transparency: 0 },
      },
    },
    scene: [{
      id: `node_${generateId()}`,
      name: 'Root',
      visible: true,
      locked: false,
      selectable: true,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      bodyId: null,
      children: [{
        id: `node_${generateId()}`,
        name: 'Body 1',
        visible: true,
        locked: false,
        selectable: true,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        bodyId,
        children: [],
        parentId: null,
      }],
      parentId: null,
    }],
    sketches: {},
    constructionPlanes: {},
    constructionAxes: {},
    constructionPoints: {},
    constructionCSys: {},
    materials: {},
    units: 'mm',
    precision: 4,
    angleUnits: 'degrees',
    metadata: {
      name,
      description: '',
      author: '',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      version: 1,
      appVersion: CAD_APP_VERSION,
    },
  }
}

interface DocumentSlice {
  doc: CadDocument
  dirty: boolean
  filePath: string | null
  setDoc: (doc: CadDocument) => void
  loadDoc: (doc: CadDocument, path?: string) => void
  saveDoc: () => CadDocument
  markClean: () => void
  markDirty: () => void
  resetDoc: () => void
}

interface SceneSlice {
  addBody: (body: Body) => void
  removeBody: (bodyId: string) => void
  updateBodyAppearance: (bodyId: string, appearance: Partial<Body['appearance']>) => void
  addFeature: (bodyId: string, feature: Feature) => void
  updateFeature: (bodyId: string, featureId: string, patch: Partial<Feature>) => void
  removeFeature: (bodyId: string, featureId: string) => void
  reorderFeature: (bodyId: string, featureId: string, newIndex: number) => void
  addNode: (node: SceneNode, parentId?: string) => void
  removeNode: (nodeId: string) => void
  updateTransform: (nodeId: string, transform: Partial<Transform>) => void
  setParent: (nodeId: string, parentId: string | null) => void
  setNodeVisibility: (nodeId: string, visible: boolean) => void
  setNodeLock: (nodeId: string, locked: boolean) => void
  renameNode: (nodeId: string, name: string) => void
  getBody: (bodyId: string) => Body | undefined
}

interface SelectionSlice {
  selection: SelectionTarget[]
  hovered: SelectionTarget | null
  select: (target: SelectionTarget) => void
  addToSelection: (target: SelectionTarget) => void
  deselect: (target: SelectionTarget) => void
  deselectAll: () => void
  toggleSelect: (target: SelectionTarget) => void
  setHovered: (target: SelectionTarget | null) => void
  marqueeSelect: (targets: SelectionTarget[]) => void
}

interface ToolSlice {
  toolMode: ToolMode
  toolOptions: Record<string, unknown>
  setToolMode: (mode: ToolMode) => void
  setToolOption: (key: string, value: unknown) => void
  resetToolOptions: () => void
}

interface ViewportSlice {
  viewport: ViewportSettings
  toggleBackground: () => void
  toggleGrid: () => void
  toggleWireframe: () => void
  toggleGhost: () => void
  toggleSection: () => void
  setEnvironment: (preset: ViewportSettings['environmentPreset']) => void
}

interface GizmoSlice {
  gizmo: GizmoState
  setGizmoMode: (mode: GizmoState['mode']) => void
  setGizmoSpace: (space: GizmoState['space']) => void
  setPivot: (pivot: GizmoState['pivot']) => void
  setSnapping: (snapping: boolean) => void
}

interface SnapSlice {
  snap: SnapSettings
  setSnapEnabled: (key: keyof SnapSettings, enabled: boolean) => void
  setGridSize: (size: number) => void
  setAngleStep: (deg: number) => void
  setThreshold: (threshold: number) => void
}

interface SketchSlice {
  activeSketch: string | null
  sketchPlane: PlaneRef | null
  constraintMode: boolean
  autoConstrain: boolean
  dimMode: 'driving' | 'driven'
  sketchTool: 'select' | 'line' | 'circle' | 'rectangle' | 'arc' | 'trim' | 'extend' | 'offset' | 'mirror' | 'pattern'
  beginSketch: (plane: PlaneRef) => void
  endSketch: () => void
  setConstraintMode: (mode: boolean) => void
  setAutoConstrain: (enabled: boolean) => void
  setDimMode: (mode: 'driving' | 'driven') => void
  setSketchTool: (tool: SketchSlice['sketchTool']) => void
  addSketchEntity: (sketchId: string, entity: SketchEntity) => void
  updateSketchEntity: (sketchId: string, entityId: string, patch: Partial<SketchEntity>) => void
  removeSketchEntity: (sketchId: string, entityId: string) => void
  addConstraint: (sketchId: string, constraint: Constraint) => void
  removeConstraint: (sketchId: string, constraintId: string) => void
  addDimension: (sketchId: string, dimension: import('./types').Dimension) => void
  removeDimension: (sketchId: string, dimensionId: string) => void
}

interface HistorySlice {
  undoStack: Command[]
  redoStack: Command[]
  maxHistory: number
  pushCommand: (cmd: Command) => void
  undo: () => boolean
  redo: () => boolean
  clearHistory: () => void
}

interface TasksSlice {
  tasks: BackgroundTask[]
  addTask: (task: BackgroundTask) => void
  updateTask: (id: string, patch: Partial<BackgroundTask>) => void
  cancelTask: (id: string) => void
  clearCompleted: () => void
}

interface UISlice {
  panels: Record<string, { visible: boolean; order: number; size: number }>
  workspace: string
  commandPaletteOpen: boolean
  contextMenu: {
    x: number
    y: number
    items: { label: string; action: string; featureId?: string; bodyId?: string }[]
  } | null
  sceneSearchQuery: string
  sceneFilter: { bodies: boolean; sketches: boolean; planes: boolean; construction: boolean }
  propertySearchQuery: string
  editDialog: { open: boolean; featureId?: string; bodyId?: string }
  togglePanel: (panelId: string) => void
  setPanelSize: (panelId: string, size: number) => void
  setWorkspace: (workspace: string) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  showContextMenu: (menu: {
    x: number
    y: number
    items: { label: string; action: string; featureId?: string; bodyId?: string }[]
  }) => void
  hideContextMenu: () => void
  openEditDialog: (featureId: string, bodyId: string) => void
  closeEditDialog: () => void
  setSceneSearchQuery: (query: string) => void
  setSceneFilter: (filter: Partial<UISlice['sceneFilter']>) => void
  setPropertySearchQuery: (query: string) => void
}

interface CollabSlice {
  connected: boolean
  users: CollabUser[]
  connect: (userId: string, userName: string) => void
  disconnect: () => void
  updatePresence: (user: Partial<CollabUser>) => void
}

interface SettingsSlice {
  units: CadDocument['units']
  precision: number
  angleUnits: CadDocument['angleUnits']
  autosave: boolean
  autosaveInterval: number
  setUnits: (units: CadDocument['units']) => void
  setPrecision: (precision: number) => void
  setAngleUnits: (units: CadDocument['angleUnits']) => void
  setAutosave: (enabled: boolean) => void
}

function getWorkspacePreset(workspace: string): Record<string, { visible: boolean; order: number; size: number }> {
  switch (workspace) {
    case 'sculpting':
      return { scene: { visible: true, order: 0, size: 200 }, properties: { visible: true, order: 1, size: 250 }, history: { visible: false, order: 2, size: 0 }, palette: { visible: true, order: 3, size: 48 }, status: { visible: true, order: 4, size: 28 } }
    case 'simulation':
      return { scene: { visible: true, order: 0, size: 200 }, properties: { visible: true, order: 1, size: 350 }, history: { visible: false, order: 2, size: 0 }, palette: { visible: true, order: 3, size: 48 }, status: { visible: true, order: 4, size: 28 } }
    case 'drawing':
      return { scene: { visible: true, order: 0, size: 200 }, properties: { visible: true, order: 1, size: 300 }, history: { visible: false, order: 2, size: 0 }, palette: { visible: false, order: 3, size: 0 }, status: { visible: true, order: 4, size: 28 } }
    case 'animation':
      return { scene: { visible: true, order: 0, size: 200 }, properties: { visible: true, order: 1, size: 300 }, history: { visible: true, order: 2, size: 150 }, palette: { visible: true, order: 3, size: 48 }, status: { visible: true, order: 4, size: 28 } }
    case 'rendering':
      return { scene: { visible: true, order: 0, size: 200 }, properties: { visible: true, order: 1, size: 350 }, history: { visible: false, order: 2, size: 0 }, palette: { visible: false, order: 3, size: 0 }, status: { visible: true, order: 4, size: 28 } }
    default: // modeling
      return { scene: { visible: true, order: 0, size: 250 }, properties: { visible: true, order: 1, size: 300 }, history: { visible: true, order: 2, size: 200 }, palette: { visible: true, order: 3, size: 48 }, status: { visible: true, order: 4, size: 28 } }
  }
}

export type CADStore = DocumentSlice & SceneSlice & SelectionSlice & ToolSlice &
  ViewportSlice & GizmoSlice & SnapSlice & SketchSlice & HistorySlice &
  TasksSlice & UISlice & SettingsSlice & CollabSlice

export const useCADStore = create<CADStore>()(
  immer((set, get) => ({
    // === Document ===
    doc: createDefaultDocument(),
    dirty: false,
    filePath: null,

    setDoc: (doc) => set(state => { state.doc = doc; state.dirty = false }),
    loadDoc: (doc, path) => set(state => { state.doc = doc; state.filePath = path ?? null; state.dirty = false; state.undoStack = []; state.redoStack = [] }),
    saveDoc: () => get().doc,
    markClean: () => set(state => { state.dirty = false }),
    markDirty: () => set(state => { state.dirty = true; state.doc.metadata.modifiedAt = new Date().toISOString() }),
    resetDoc: () => set(state => { state.doc = createDefaultDocument(); state.dirty = false; state.filePath = null; state.undoStack = []; state.redoStack = [] }),

    // === Scene ===
    addBody: (body) => set(state => { state.doc.bodies[body.id] = body; state.markDirty() }),
    removeBody: (bodyId) => set(state => { delete state.doc.bodies[bodyId]; state.markDirty() }),
    updateBodyAppearance: (bodyId, appearance) => set(state => {
      const body = state.doc.bodies[bodyId]
      if (body) { Object.assign(body.appearance, appearance); state.markDirty() }
    }),
    addFeature: (bodyId, feature) => {
      const featureId = feature.id
      const featureClone = JSON.parse(JSON.stringify(feature))
      set(state => {
        const body = state.doc.bodies[bodyId]
        if (body) {
          feature.featureIndex = body.features.length
          body.features.push(feature)
          state.markDirty()
        }
      })
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: `Add ${featureClone.type}`,
          timestamp: Date.now(),
          execute: () => set(state => {
            const body = state.doc.bodies[bodyId]
            if (body) {
              body.features.push(JSON.parse(JSON.stringify(featureClone)))
              body.features.forEach((f, i) => { f.featureIndex = i })
              state.markDirty()
            }
          }),
          undo: () => set(state => {
            const body = state.doc.bodies[bodyId]
            if (body) {
              body.features = body.features.filter(f => f.id !== featureId)
              body.features.forEach((f, i) => { f.featureIndex = i })
              state.markDirty()
            }
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    updateFeature: (bodyId, featureId, patch) => {
      const prev = (() => {
        const body = get().doc.bodies[bodyId]
        if (!body) return null
        const f = body.features.find(f => f.id === featureId)
        return f ? JSON.parse(JSON.stringify(f)) : null
      })()
      if (!prev) { set(state => { /* no-op */ }); return }
      set(state => {
        const body = state.doc.bodies[bodyId]
        if (!body) return
        const idx = body.features.findIndex(f => f.id === featureId)
        if (idx >= 0) {
          Object.assign(body.features[idx], patch)
          state.markDirty()
        }
      })
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: `Update ${prev.type}`,
          timestamp: Date.now(),
          execute: () => set(state => {
            const body = state.doc.bodies[bodyId]
            if (!body) return
            const idx = body.features.findIndex(f => f.id === featureId)
            if (idx >= 0) { Object.assign(body.features[idx], patch); state.markDirty() }
          }),
          undo: () => set(state => {
            const body = state.doc.bodies[bodyId]
            if (!body) return
            const idx = body.features.findIndex(f => f.id === featureId)
            if (idx >= 0) {
              const restored = JSON.parse(JSON.stringify(prev))
              Object.assign(body.features[idx], restored)
              state.markDirty()
            }
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    removeFeature: (bodyId, featureId) => {
      const removed = (() => {
        const body = get().doc.bodies[bodyId]
        if (!body) return null
        const idx = body.features.findIndex(f => f.id === featureId)
        if (idx < 0) return null
        return { feature: JSON.parse(JSON.stringify(body.features[idx])), index: idx }
      })()
      if (!removed) return
      set(state => {
        const body = state.doc.bodies[bodyId]
        if (body) {
          body.features = body.features.filter(f => f.id !== featureId)
          body.features.forEach((f, i) => { f.featureIndex = i })
          state.markDirty()
        }
      })
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: `Remove ${removed.feature.type}`,
          timestamp: Date.now(),
          execute: () => set(state => {
            const body = state.doc.bodies[bodyId]
            if (body) {
              body.features = body.features.filter(f => f.id !== featureId)
              body.features.forEach((f, i) => { f.featureIndex = i })
              state.markDirty()
            }
          }),
          undo: () => set(state => {
            const body = state.doc.bodies[bodyId]
            if (body) {
              const restored = JSON.parse(JSON.stringify(removed.feature))
              body.features.splice(removed.index, 0, restored)
              body.features.forEach((f, i) => { f.featureIndex = i })
              state.markDirty()
            }
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    reorderFeature: (bodyId, featureId, newIndex) => set(state => {
      const body = state.doc.bodies[bodyId]
      if (!body) return
      const oldIdx = body.features.findIndex(f => f.id === featureId)
      if (oldIdx < 0) return
      const [item] = body.features.splice(oldIdx, 1)
      body.features.splice(newIndex, 0, item)
      body.features.forEach((f, i) => { f.featureIndex = i })
      state.markDirty()
    }),
    addNode: (node, parentId) => set(state => {
      if (parentId) {
        const addToParent = (nodes: SceneNode[]): boolean => {
          for (const n of nodes) {
            if (n.id === parentId) { n.children.push(node); node.parentId = parentId; return true }
            if (addToParent(n.children)) return true
          }
          return false
        }
        addToParent(state.doc.scene)
      } else {
        state.doc.scene.push(node)
        node.parentId = null
      }
      state.markDirty()
    }),
    removeNode: (nodeId) => {
      let removedNode: SceneNode | null = null
      const before = JSON.parse(JSON.stringify(get().doc.scene))
      set(state => {
        const removeFrom = (nodes: SceneNode[]): SceneNode[] =>
          nodes.filter(n => {
            if (n.id === nodeId) { removedNode = JSON.parse(JSON.stringify(n)); return false }
            n.children = removeFrom(n.children)
            return true
          })
        state.doc.scene = removeFrom(state.doc.scene)
        state.markDirty()
      })
      if (!removedNode) return
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: `Remove node`,
          timestamp: Date.now(),
          execute: () => set(state => {
            const removeFrom2 = (nodes: SceneNode[]): SceneNode[] =>
              nodes.filter(n => {
                if (n.id === nodeId) return false
                n.children = removeFrom2(n.children)
                return true
              })
            state.doc.scene = removeFrom2(state.doc.scene)
            state.markDirty()
          }),
          undo: () => set(state => {
            state.doc.scene = JSON.parse(JSON.stringify(before))
            state.markDirty()
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    updateTransform: (nodeId, transform) => {
      const prev = (() => {
        const findNode = (nodes: SceneNode[]): SceneNode | null => {
          for (const n of nodes) {
            if (n.id === nodeId) return n
            const found = findNode(n.children)
            if (found) return found
          }
          return null
        }
        const n = findNode(get().doc.scene)
        return n ? JSON.parse(JSON.stringify(n.transform)) : null
      })()
      set(state => {
        const updateNode = (nodes: SceneNode[]) => {
          for (const n of nodes) {
            if (n.id === nodeId) { Object.assign(n.transform, transform); return true }
            if (updateNode(n.children)) return true
          }
          return false
        }
        updateNode(state.doc.scene)
        state.markDirty()
      })
      if (!prev) return
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: `Update transform`,
          timestamp: Date.now(),
          execute: () => set(state => {
            const updateNode2 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { Object.assign(n.transform, transform); return true }
                if (updateNode2(n.children)) return true
              }
              return false
            }
            updateNode2(state.doc.scene)
            state.markDirty()
          }),
          undo: () => set(state => {
            const updateNode3 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.transform = JSON.parse(JSON.stringify(prev)); return true }
                if (updateNode3(n.children)) return true
              }
              return false
            }
            updateNode3(state.doc.scene)
            state.markDirty()
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    setParent: (nodeId, parentId) => set(state => {
      let node: SceneNode | null = null
      const removeFrom = (nodes: SceneNode[]): SceneNode[] =>
        nodes.filter(n => {
          if (n.id === nodeId) { node = n; return false }
          n.children = removeFrom(n.children)
          return true
        })
      state.doc.scene = removeFrom(state.doc.scene)
      if (node && parentId) {
        const addTo = (nodes: SceneNode[]) => {
          for (const n of nodes) {
            if (n.id === parentId) { n.children.push(node!); node!.parentId = parentId; return true }
            if (addTo(n.children)) return true
          }
          return false
        }
        addTo(state.doc.scene) ?? state.doc.scene.push(node)
      } else if (node) {
        node.parentId = null
        state.doc.scene.push(node)
      }
      state.markDirty()
    }),
    setNodeVisibility: (nodeId, visible) => {
      const prev = (() => {
        const findNode = (nodes: SceneNode[]): boolean | null => {
          for (const n of nodes) {
            if (n.id === nodeId) return n.visible
            const found = findNode(n.children)
            if (found !== null) return found
          }
          return null
        }
        return findNode(get().doc.scene)
      })()
      set(state => {
        const updateNode = (nodes: SceneNode[]) => {
          for (const n of nodes) {
            if (n.id === nodeId) { n.visible = visible; return }
            updateNode(n.children)
          }
        }
        updateNode(state.doc.scene)
        state.markDirty()
      })
      if (prev === null) return
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: visible ? 'Show node' : 'Hide node',
          timestamp: Date.now(),
          execute: () => set(state => {
            const updateNode2 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.visible = visible; return }
                updateNode2(n.children)
              }
            }
            updateNode2(state.doc.scene)
            state.markDirty()
          }),
          undo: () => set(state => {
            const updateNode3 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.visible = prev!; return }
                updateNode3(n.children)
              }
            }
            updateNode3(state.doc.scene)
            state.markDirty()
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    setNodeLock: (nodeId, locked) => {
      const prev = (() => {
        const findNode = (nodes: SceneNode[]): boolean | null => {
          for (const n of nodes) {
            if (n.id === nodeId) return n.locked
            const found = findNode(n.children)
            if (found !== null) return found
          }
          return null
        }
        return findNode(get().doc.scene)
      })()
      set(state => {
        const updateNode = (nodes: SceneNode[]) => {
          for (const n of nodes) {
            if (n.id === nodeId) { n.locked = locked; return }
            updateNode(n.children)
          }
        }
        updateNode(state.doc.scene)
        state.markDirty()
      })
      if (prev === null) return
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: locked ? 'Lock node' : 'Unlock node',
          timestamp: Date.now(),
          execute: () => set(state => {
            const updateNode2 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.locked = locked; return }
                updateNode2(n.children)
              }
            }
            updateNode2(state.doc.scene)
            state.markDirty()
          }),
          undo: () => set(state => {
            const updateNode3 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.locked = prev!; return }
                updateNode3(n.children)
              }
            }
            updateNode3(state.doc.scene)
            state.markDirty()
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    renameNode: (nodeId, name) => {
      const prev = (() => {
        const findNode = (nodes: SceneNode[]): string | null => {
          for (const n of nodes) {
            if (n.id === nodeId) return n.name
            const found = findNode(n.children)
            if (found !== null) return found
          }
          return null
        }
        return findNode(get().doc.scene)
      })()
      set(state => {
        const updateNode = (nodes: SceneNode[]) => {
          for (const n of nodes) {
            if (n.id === nodeId) { n.name = name; return }
            updateNode(n.children)
          }
        }
        updateNode(state.doc.scene)
        state.markDirty()
      })
      if (prev === null) return
      set(state => {
        state.undoStack.push({
          id: generateId(),
          name: 'Rename node',
          timestamp: Date.now(),
          execute: () => set(state => {
            const updateNode2 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.name = name; return }
                updateNode2(n.children)
              }
            }
            updateNode2(state.doc.scene)
            state.markDirty()
          }),
          undo: () => set(state => {
            const updateNode3 = (nodes: SceneNode[]) => {
              for (const n of nodes) {
                if (n.id === nodeId) { n.name = prev!; return }
                updateNode3(n.children)
              }
            }
            updateNode3(state.doc.scene)
            state.markDirty()
          }),
        })
        state.redoStack = []
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      })
    },
    getBody: (bodyId) => get().doc.bodies[bodyId],

    // === Selection ===
    selection: [],
    hovered: null,

    select: (target) => set(state => { state.selection = [target] }),
    addToSelection: (target) => set(state => {
      if (!state.selection.some(s => selectionEqual(s, target))) state.selection.push(target)
    }),
    deselect: (target) => set(state => {
      state.selection = state.selection.filter(s => !selectionEqual(s, target))
    }),
    deselectAll: () => set(state => { state.selection = [] }),
    toggleSelect: (target) => set(state => {
      const idx = state.selection.findIndex(s => selectionEqual(s, target))
      if (idx >= 0) state.selection.splice(idx, 1)
      else state.selection.push(target)
    }),
    setHovered: (target) => set(state => { state.hovered = target }),
    marqueeSelect: (targets) => set(state => { state.selection = targets }),

    // === Tool ===
    toolMode: 'select',
    toolOptions: {},
    setToolMode: (mode) => set(state => {
      state.toolMode = mode
      state.toolOptions = {}
      if (mode === 'sketch' && !state.activeSketch) {
        const sketchId = `sketch_${generateId()}`
        state.doc.sketches[sketchId] = {
          id: sketchId,
          plane: { type: 'standard', plane: 'xy' },
          entities: {},
          constraints: [],
          dimensions: {},
          solverState: { dof: 6, status: 'under', errors: {} },
        }
        state.activeSketch = sketchId
        state.sketchPlane = { type: 'standard', plane: 'xy' }
      }
    }),
    setToolOption: (key, value) => set(state => { state.toolOptions[key] = value }),
    resetToolOptions: () => set(state => { state.toolOptions = {} }),

    // === Viewport ===
    viewport: {
      background: 'dark',
      environmentPreset: 'studio',
      customBackgroundColor: '#0f172a',
      grid: true,
      wireframe: false,
      ghostMode: false,
      hiddenLine: false,
      sectionEnabled: false,
    },
    toggleBackground: () => set(state => {
      state.viewport.background = state.viewport.background === 'dark' ? 'light' : state.viewport.background === 'light' ? 'environment' : 'dark'
    }),
    toggleGrid: () => set(state => { state.viewport.grid = !state.viewport.grid }),
    toggleWireframe: () => set(state => { state.viewport.wireframe = !state.viewport.wireframe }),
    toggleGhost: () => set(state => { state.viewport.ghostMode = !state.viewport.ghostMode }),
    toggleSection: () => set(state => { state.viewport.sectionEnabled = !state.viewport.sectionEnabled }),
    setEnvironment: (preset) => set(state => { state.viewport.environmentPreset = preset }),

    // === Gizmo ===
    gizmo: { mode: 'translate', space: 'world', pivot: 'median', snapping: true },
    setGizmoMode: (mode) => set(state => { state.gizmo.mode = mode }),
    setGizmoSpace: (space) => set(state => { state.gizmo.space = space }),
    setPivot: (pivot) => set(state => { state.gizmo.pivot = pivot }),
    setSnapping: (snapping) => set(state => { state.gizmo.snapping = snapping }),

    // === Snap ===
    snap: { grid: true, vertex: true, edge: true, midpoint: true, center: true, angle: true, gridSize: 10, angleStep: 15, threshold: 5 },
    setSnapEnabled: (key, enabled) => set(state => { (state.snap as any)[key] = enabled }),
    setGridSize: (size) => set(state => { state.snap.gridSize = size }),
    setAngleStep: (deg) => set(state => { state.snap.angleStep = deg }),
    setThreshold: (threshold) => set(state => { state.snap.threshold = threshold }),

    // === Sketch ===
    activeSketch: null,
    sketchPlane: null,
    constraintMode: false,
    autoConstrain: true,
    dimMode: 'driving',
    sketchTool: 'select',
    beginSketch: (plane) => set(state => {
      const sketchId = `sketch_${generateId()}`
      state.doc.sketches[sketchId] = {
        id: sketchId,
        plane,
        entities: {},
        constraints: [],
        dimensions: {},
        solverState: { dof: 6, status: 'under', errors: {} },
      }
      state.activeSketch = sketchId
      state.sketchPlane = plane
      state.toolMode = 'sketch'
    }),
    endSketch: () => set(state => { state.activeSketch = null; state.sketchPlane = null; state.toolMode = 'select' }),
    setConstraintMode: (mode) => set(state => { state.constraintMode = mode }),
    setAutoConstrain: (enabled) => set(state => { state.autoConstrain = enabled }),
    setDimMode: (mode) => set(state => { state.dimMode = mode }),
    setSketchTool: (tool) => set(state => { state.sketchTool = tool }),
    addSketchEntity: (sketchId, entity) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch) { sketch.entities[entity.id] = entity; state.markDirty() }
    }),
    updateSketchEntity: (sketchId, entityId, patch) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch && sketch.entities[entityId]) {
        Object.assign(sketch.entities[entityId], patch)
        state.markDirty()
      }
    }),
    removeSketchEntity: (sketchId, entityId) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch) { delete sketch.entities[entityId]; state.markDirty() }
    }),
    addConstraint: (sketchId, constraint) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch) { sketch.constraints.push(constraint); state.markDirty() }
    }),
    removeConstraint: (sketchId, constraintId) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch) {
        sketch.constraints = sketch.constraints.filter(c => c.id !== constraintId)
        state.markDirty()
      }
    }),
    addDimension: (sketchId, dimension) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch) { sketch.dimensions[dimension.id] = dimension; state.markDirty() }
    }),
    removeDimension: (sketchId, dimensionId) => set(state => {
      const sketch = state.doc.sketches[sketchId]
      if (sketch) { delete sketch.dimensions[dimensionId]; state.markDirty() }
    }),

    // === History ===
    undoStack: [],
    redoStack: [],
    maxHistory: 500,
    pushCommand: (cmd) => set(state => {
      const last = state.undoStack[state.undoStack.length - 1]
      if (last && last.merge) {
        const merged = last.merge(cmd)
        if (merged) {
          state.undoStack[state.undoStack.length - 1] = merged
          return
        }
      }
      state.undoStack.push(cmd)
      if (state.undoStack.length > state.maxHistory) state.undoStack.shift()
      state.redoStack = []
    }),
    undo: () => {
      const state = get()
      if (state.undoStack.length === 0) return false
      const cmd = state.undoStack[state.undoStack.length - 1]
      cmd.undo()
      set(s => { s.undoStack.pop(); s.redoStack.push(cmd); s.markDirty() })
      return true
    },
    redo: () => {
      const state = get()
      if (state.redoStack.length === 0) return false
      const cmd = state.redoStack[state.redoStack.length - 1]
      cmd.execute()
      set(s => { s.redoStack.pop(); s.undoStack.push(cmd); s.markDirty() })
      return true
    },
    clearHistory: () => set(state => { state.undoStack = []; state.redoStack = [] }),

    // === Tasks ===
    tasks: [],
    addTask: (task) => set(state => { state.tasks.push(task) }),
    updateTask: (id, patch) => set(state => {
      const task = state.tasks.find(t => t.id === id)
      if (task) Object.assign(task, patch)
    }),
    cancelTask: (id) => set(state => {
      const task = state.tasks.find(t => t.id === id)
      if (task) { task.status = 'cancelled'; task.cancel?.() }
    }),
    clearCompleted: () => set(state => { state.tasks = state.tasks.filter(t => t.status === 'pending' || t.status === 'running') }),

    // === UI ===
    panels: getWorkspacePreset('modeling'),
    workspace: 'modeling',
    commandPaletteOpen: false,
    contextMenu: null,
    sceneSearchQuery: '',
    sceneFilter: { bodies: true, sketches: true, planes: true, construction: true },
    propertySearchQuery: '',
    togglePanel: (panelId) => set(state => {
      const panel = state.panels[panelId]
      if (panel) panel.visible = !panel.visible
    }),
    setPanelSize: (panelId, size) => set(state => {
      const panel = state.panels[panelId]
      if (panel) panel.size = size
    }),
    setWorkspace: (workspace) => set(state => {
      state.workspace = workspace
      state.panels = getWorkspacePreset(workspace)
    }),
    openCommandPalette: () => set(state => { state.commandPaletteOpen = true }),
    closeCommandPalette: () => set(state => { state.commandPaletteOpen = false }),
    showContextMenu: (menu) => set(state => { state.contextMenu = menu }),
    hideContextMenu: () => set(state => { state.contextMenu = null }),
    editDialog: { open: false },
    openEditDialog: (featureId, bodyId) => set(state => { state.editDialog = { open: true, featureId, bodyId } }),
    closeEditDialog: () => set(state => { state.editDialog = { open: false } }),
    setSceneSearchQuery: (query) => set(state => { state.sceneSearchQuery = query }),
    setSceneFilter: (filter) => set(state => { Object.assign(state.sceneFilter, filter) }),
    setPropertySearchQuery: (query) => set(state => { state.propertySearchQuery = query }),

    // === Collab ===
    connected: false,
    users: [],
    connect: (userId, userName) => set(state => {
      state.connected = true
      state.users.push({ id: userId, name: userName, color: '#3b82f6' })
    }),
    disconnect: () => set(state => { state.connected = false; state.users = [] }),
    updatePresence: (user) => set(state => {
      const idx = state.users.findIndex(u => u.id === user.id)
      if (idx >= 0) Object.assign(state.users[idx], user)
    }),

    // === Settings ===
    units: 'mm',
    precision: 4,
    angleUnits: 'degrees',
    autosave: true,
    autosaveInterval: 60000,
    setUnits: (units) => set(state => { state.units = units; state.doc.units = units; state.markDirty() }),
    setPrecision: (precision) => set(state => { state.precision = precision; state.doc.precision = precision; state.markDirty() }),
    setAngleUnits: (units) => set(state => { state.angleUnits = units; state.doc.angleUnits = units; state.markDirty() }),
    setAutosave: (enabled) => set(state => { state.autosave = enabled }),
  }))
)
