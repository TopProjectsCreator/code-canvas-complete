import type { CadDocument } from '../types'

let idCounter = 0
function id(): string {
  idCounter++
  return `demo_${idCounter}_${Date.now().toString(36)}`
}

export function createDemoDocument(): CadDocument {
  idCounter = 0

  const bodyId = id()
  const sketchId1 = id()
  const sketchId2 = id()

  return {
    version: 1,
    bodies: {
      [bodyId]: {
        id: bodyId,
        name: 'Demo Bracket',
        features: [
          {
            id: id(),
            name: 'Base Extrude',
            type: 'extrude',
            visible: true,
            suppressed: false,
            bodyId,
            featureIndex: 0,
            dependencies: [sketchId1],
            sketchId: sketchId1,
            direction: 'forward',
            endCondition: 'blind',
            depth: 8,
            mergeType: 'new-body',
          },
          {
            id: id(),
            name: 'Hole',
            type: 'hole',
            visible: true,
            suppressed: false,
            bodyId,
            featureIndex: 1,
            dependencies: [sketchId2],
            sketchId: sketchId2,
            holeType: 'simple',
            diameter: 4,
            depth: 12,
            endCondition: 'through-all',
            thread: { majorDiameter: 4, minorDiameter: 3.2, pitch: 0.7, depth: 12, class: '6H', standard: 'iso', size: 'M4', direction: 'right', modeled: true },
          },
          {
            id: id(),
            name: 'Fillet',
            type: 'fillet',
            visible: true,
            suppressed: false,
            bodyId,
            featureIndex: 2,
            dependencies: [],
            edges: [],
            radius: 1,
            mode: 'constant',
            blendType: 'circular',
            tangentPropagation: true,
            overflow: 'default',
          },
        ],
        appearance: { color: '#94a3b8', opacity: 1, roughness: 0.5, metalness: 0.3, visible: true, transparency: 0 },
      },
    },
    scene: [
      {
        id: id(),
        name: 'Root',
        visible: true,
        locked: false,
        selectable: true,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        bodyId: null,
        children: [],
        parentId: null,
      },
    ],
    sketches: {
      [sketchId1]: {
        id: sketchId1,
        plane: { type: 'standard', plane: 'xy' },
        entities: {
          [id()]: { id: id(), type: 'rectangle', params: { x: -10, y: -5, width: 20, height: 10 }, construction: false, locked: false, layer: 'default' },
          [id()]: { id: id(), type: 'line', params: { x1: -5, y1: -3, x2: 5, y2: -3 }, construction: true, locked: false, layer: 'default' },
        },
        constraints: [],
        dimensions: {},
        solverState: { dof: 4, status: 'under', errors: {} },
      },
      [sketchId2]: {
        id: sketchId2,
        plane: { type: 'standard', plane: 'xy' },
        entities: {
          [id()]: { id: id(), type: 'circle', params: { cx: 0, cy: 0, radius: 2 }, construction: false, locked: false, layer: 'default' },
        },
        constraints: [],
        dimensions: {},
        solverState: { dof: 2, status: 'under', errors: {} },
      },
    },
    constructionPlanes: {},
    constructionAxes: {},
    constructionPoints: {},
    constructionCSys: {},
    materials: {},
    units: 'mm',
    precision: 4,
    angleUnits: 'degrees',
    metadata: {
      name: 'Demo Bracket',
      description: 'A sample parametric part with extrude, hole, and fillet features',
      author: 'CAD Editor',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      version: 1,
    },
  }
}
