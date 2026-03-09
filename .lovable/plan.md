
## Plan: Add Starter Shapes + Text-to-3D Generation for CAD Editor

### Summary
1. Add a "Start with Shape" menu with built-in primitives (cube, sphere, cylinder, cone, torus)
2. Add Text-to-3D generation that calls external providers (Meshy, Stability AI) when users provide an API key

---

### 1. Add Starter Shape Primitives

**File: `src/components/ide/CADEditor.tsx`**

- Add a dropdown/button group in the empty state overlay with primitive shape options
- Options: Cube, Sphere, Cylinder, Cone, Torus
- When selected, generate procedural geometry using Three.js built-in geometries
- Store as a special marker in file content (e.g., `primitive:cube`) so it persists
- Update parsing logic to detect `primitive:*` and generate corresponding BufferGeometry

**UI Flow:**
```text
┌─────────────────────────────────────────┐
│  Drag & drop a .stl or .obj file        │
│                                         │
│  [Browse Files]                         │
│                                         │
│  ── or start with a shape ──            │
│                                         │
│  [⬡Cube] [◯Sphere] [⬡Cylinder]          │
│  [▲Cone] [◎Torus]                       │
│                                         │
│  ── or generate from text ──            │
│  [✨ Text to 3D]                        │
└─────────────────────────────────────────┘
```

---

### 2. Text-to-3D Generation

**New Provider in `useApiKeys.ts`:**
- Add `meshy` provider (Meshy.ai is a leading text-to-3D API)
- Include in `PROVIDER_INFO` and `PROVIDER_MODELS`

**New Edge Function: `supabase/functions/generate-3d/index.ts`**
- Accept prompt text and provider choice
- Call Meshy API (`POST https://api.meshy.ai/openapi/v1/text-to-3d`)
- Return a GLB/OBJ URL or base64 model data
- Support polling for async generation (Meshy uses task IDs)

**CADEditor UI additions:**
- Add "Text to 3D" button that opens a dialog/input
- User enters prompt (e.g., "a wooden chair")
- If no Meshy API key configured, show prompt to add key via API Keys dialog
- On submit: call edge function, show loading state, load result into viewer
- Support GLB format parsing (add `parseGLB` or use `@react-three/drei` GLTFLoader)

---

### 3. Files to Modify

| File | Changes |
|------|---------|
| `src/components/ide/CADEditor.tsx` | Add starter shape buttons, Text-to-3D dialog, primitive geometry generation, GLB loading |
| `src/hooks/useApiKeys.ts` | Add `meshy` provider to `AIProvider` type, `PROVIDER_INFO`, `PROVIDER_MODELS` |
| `src/components/ide/ApiKeysDialog.tsx` | Add `meshy` to providers list |
| `supabase/functions/validate-api-key/index.ts` | Add Meshy validation endpoint |
| `supabase/functions/generate-3d/index.ts` | **New** - Edge function for text-to-3D generation |

---

### 4. Technical Details

**Primitive geometry generation (Three.js):**
```typescript
function createPrimitiveGeometry(type: string): THREE.BufferGeometry {
  switch (type) {
    case 'cube': return new THREE.BoxGeometry(2, 2, 2);
    case 'sphere': return new THREE.SphereGeometry(1.2, 32, 32);
    case 'cylinder': return new THREE.CylinderGeometry(1, 1, 2, 32);
    case 'cone': return new THREE.ConeGeometry(1, 2, 32);
    case 'torus': return new THREE.TorusGeometry(1, 0.4, 16, 48);
    default: return new THREE.BoxGeometry(2, 2, 2);
  }
}
```

**Meshy API flow:**
1. POST `/v1/text-to-3d` with `{ mode: "preview", prompt, art_style }` → returns `task_id`
2. Poll `GET /v1/text-to-3d/{task_id}` until status = `SUCCEEDED`
3. Download GLB from `model_urls.glb`
4. Load into viewer using GLTFLoader

---

### 5. Implementation Order
1. Add starter shape primitives (no external dependencies)
2. Add Meshy provider to API keys system
3. Create generate-3d edge function
4. Add Text-to-3D UI in CADEditor
5. Add GLB/GLTF loading support
