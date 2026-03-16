import { useState, useRef, useCallback, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Center, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FileNode } from '@/types/ide';
import {
  Box, Layers, Sun, Moon, Info, Download, Grid3X3, Loader2, Upload,
  Circle, Triangle, Cylinder, Hexagon, Sparkles, FileDown, Pencil,
  Combine, Cuboid, Bolt, Ruler, ScanFace, PanelLeft, PanelRight, Grip
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useApiKeys } from '@/hooks/useApiKeys';

interface CADEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

// Primitive shape types
type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus';

const PRIMITIVES: { type: PrimitiveType; label: string; icon: React.ReactNode }[] = [
  { type: 'cube', label: 'Cube', icon: <Box className="w-4 h-4" /> },
  { type: 'sphere', label: 'Sphere', icon: <Circle className="w-4 h-4" /> },
  { type: 'cylinder', label: 'Cylinder', icon: <Cylinder className="w-4 h-4" /> },
  { type: 'cone', label: 'Cone', icon: <Triangle className="w-4 h-4" /> },
  { type: 'torus', label: 'Torus', icon: <Hexagon className="w-4 h-4" /> },
];

/**
 * Create procedural geometry for primitive shapes
 */
function createPrimitiveGeometry(type: PrimitiveType): THREE.BufferGeometry {
  switch (type) {
    case 'cube':
      return new THREE.BoxGeometry(2, 2, 2);
    case 'sphere':
      return new THREE.SphereGeometry(1.2, 32, 32);
    case 'cylinder':
      return new THREE.CylinderGeometry(1, 1, 2, 32);
    case 'cone':
      return new THREE.ConeGeometry(1, 2, 32);
    case 'torus':
      return new THREE.TorusGeometry(1, 0.4, 16, 48);
    default:
      return new THREE.BoxGeometry(2, 2, 2);
  }
}

/**
 * Export BufferGeometry to binary STL format
 */
function exportToSTL(geometry: THREE.BufferGeometry, filename: string): void {
  const positions = geometry.getAttribute('position');
  if (!positions) return;

  // Handle indexed geometry
  const indices = geometry.index;
  let triangleCount: number;
  
  if (indices) {
    triangleCount = indices.count / 3;
  } else {
    triangleCount = positions.count / 3;
  }

  // STL binary format: 80 byte header + 4 byte triangle count + 50 bytes per triangle
  const bufferSize = 84 + triangleCount * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Write header (80 bytes, can be anything)
  const header = 'Exported from Lovable IDE CAD Editor';
  for (let i = 0; i < 80; i++) {
    uint8[i] = i < header.length ? header.charCodeAt(i) : 0;
  }

  // Write triangle count
  view.setUint32(80, triangleCount, true);

  // Compute normals if not present
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');

  let offset = 84;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < triangleCount; i++) {
    // Get vertex indices
    const i0 = indices ? indices.getX(i * 3) : i * 3;
    const i1 = indices ? indices.getX(i * 3 + 1) : i * 3 + 1;
    const i2 = indices ? indices.getX(i * 3 + 2) : i * 3 + 2;

    // Compute face normal (average of vertex normals)
    n.set(0, 0, 0);
    if (normals) {
      n.x = (normals.getX(i0) + normals.getX(i1) + normals.getX(i2)) / 3;
      n.y = (normals.getY(i0) + normals.getY(i1) + normals.getY(i2)) / 3;
      n.z = (normals.getZ(i0) + normals.getZ(i1) + normals.getZ(i2)) / 3;
      n.normalize();
    }

    // Write normal
    view.setFloat32(offset, n.x, true); offset += 4;
    view.setFloat32(offset, n.y, true); offset += 4;
    view.setFloat32(offset, n.z, true); offset += 4;

    // Write vertices
    for (const idx of [i0, i1, i2]) {
      view.setFloat32(offset, positions.getX(idx), true); offset += 4;
      view.setFloat32(offset, positions.getY(idx), true); offset += 4;
      view.setFloat32(offset, positions.getZ(idx), true); offset += 4;
    }

    // Attribute byte count (unused)
    view.setUint16(offset, 0, true); offset += 2;
  }

  // Trigger download
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, '') + '.stl';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export BufferGeometry to OBJ format
 */
function exportToOBJ(geometry: THREE.BufferGeometry, filename: string): void {
  const positions = geometry.getAttribute('position');
  if (!positions) return;

  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const indices = geometry.index;

  let obj = '# Exported from Lovable IDE CAD Editor\n';
  obj += `# Vertices: ${positions.count}\n\n`;

  // Write vertices
  for (let i = 0; i < positions.count; i++) {
    obj += `v ${positions.getX(i).toFixed(6)} ${positions.getY(i).toFixed(6)} ${positions.getZ(i).toFixed(6)}\n`;
  }
  obj += '\n';

  // Write normals
  if (normals) {
    for (let i = 0; i < normals.count; i++) {
      obj += `vn ${normals.getX(i).toFixed(6)} ${normals.getY(i).toFixed(6)} ${normals.getZ(i).toFixed(6)}\n`;
    }
    obj += '\n';
  }

  // Write faces
  if (indices) {
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i) + 1;
      const b = indices.getX(i + 1) + 1;
      const c = indices.getX(i + 2) + 1;
      if (normals) {
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      } else {
        obj += `f ${a} ${b} ${c}\n`;
      }
    }
  } else {
    for (let i = 0; i < positions.count; i += 3) {
      const a = i + 1;
      const b = i + 2;
      const c = i + 3;
      if (normals) {
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      } else {
        obj += `f ${a} ${b} ${c}\n`;
      }
    }
  }

  // Trigger download
  const blob = new Blob([obj], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, '') + '.obj';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse GLB/GLTF binary data into BufferGeometry
 */
function parseGLB(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(buffer, '', (gltf) => {
      let geometry: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !geometry) {
          geometry = (child as THREE.Mesh).geometry;
        }
      });
      if (geometry) {
        resolve(geometry);
      } else {
        reject(new Error('No mesh found in GLB file'));
      }
    }, (err) => reject(err));
  });
}

/**
 * Parse a binary/ASCII STL file content (base64 data URL) into a BufferGeometry
 */
function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  // Check if ASCII STL
  const text = new TextDecoder().decode(buffer.slice(0, 80));
  if (text.startsWith('solid') && !isBinarySTL(buffer)) {
    return parseASCIISTL(new TextDecoder().decode(buffer));
  }

  // Binary STL
  const view = new DataView(buffer);
  const numTriangles = view.getUint32(80, true);
  const vertices = new Float32Array(numTriangles * 9);
  const normals = new Float32Array(numTriangles * 9);

  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);

    for (let j = 0; j < 3; j++) {
      const vOffset = offset + 12 + j * 12;
      vertices[i * 9 + j * 3] = view.getFloat32(vOffset, true);
      vertices[i * 9 + j * 3 + 1] = view.getFloat32(vOffset + 4, true);
      vertices[i * 9 + j * 3 + 2] = view.getFloat32(vOffset + 8, true);
      normals[i * 9 + j * 3] = nx;
      normals[i * 9 + j * 3 + 1] = ny;
      normals[i * 9 + j * 3 + 2] = nz;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

function isBinarySTL(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  const numTriangles = view.getUint32(80, true);
  const expectedSize = 84 + numTriangles * 50;
  return buffer.byteLength === expectedSize || buffer.byteLength === expectedSize + 2;
}

function parseASCIISTL(text: string): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const normals: number[] = [];
  const lines = text.split('\n');
  let currentNormal = [0, 0, 1];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('facet normal')) {
      const parts = trimmed.split(/\s+/);
      currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
    } else if (trimmed.startsWith('vertex')) {
      const parts = trimmed.split(/\s+/);
      vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      normals.push(...currentNormal);
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

/**
 * Parse a simple OBJ file into BufferGeometry
 */
function parseOBJ(text: string): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const verts: number[][] = [];
  const norms: number[][] = [];
  const finalVerts: number[] = [];
  const finalNorms: number[] = [];

  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === 'vn') {
      norms.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === 'f') {
      // Triangulate faces (fan triangulation)
      const faceVerts: { v: number; n: number }[] = [];
      for (let i = 1; i < parts.length; i++) {
        const indices = parts[i].split('/');
        faceVerts.push({
          v: parseInt(indices[0]) - 1,
          n: indices[2] ? parseInt(indices[2]) - 1 : -1,
        });
      }
      for (let i = 1; i < faceVerts.length - 1; i++) {
        for (const idx of [faceVerts[0], faceVerts[i], faceVerts[i + 1]]) {
          const v = verts[idx.v] || [0, 0, 0];
          finalVerts.push(...v);
          const n = idx.n >= 0 && norms[idx.n] ? norms[idx.n] : [0, 1, 0];
          finalNorms.push(...n);
        }
      }
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(finalVerts), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(finalNorms), 3));
  if (finalNorms.every(n => n === 0)) geometry.computeVertexNormals();
  return geometry;
}

// 3D model component
function Model({ geometry, wireframe, color }: { geometry: THREE.BufferGeometry; wireframe: boolean; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <Center>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          wireframe={wireframe}
          metalness={0.3}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#444" wireframe wireframeLinewidth={1} transparent opacity={0.3} />
        </mesh>
      )}
    </Center>
  );
}

// Rotating model for empty state
function DemoCube() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.5;
      ref.current.rotation.y += delta * 0.7;
    }
  });
  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#6366f1" metalness={0.4} roughness={0.5} />
    </mesh>
  );
}

function SceneInfo({ geometry }: { geometry: THREE.BufferGeometry | null }) {
  if (!geometry) return null;
  const pos = geometry.getAttribute('position');
  const triangles = pos ? Math.floor(pos.count / 3) : 0;
  const vertices = pos?.count || 0;

  // Compute bounding box
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const size = bb ? new THREE.Vector3().subVectors(bb.max, bb.min) : new THREE.Vector3();

  return (
    <div className="text-[11px] text-white/60 flex gap-4 flex-wrap">
      <span>Vertices: {vertices.toLocaleString()}</span>
      <span>Triangles: {triangles.toLocaleString()}</span>
      <span>Size: {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)}</span>
    </div>
  );
}

export const CADEditor = ({ file, onContentChange }: CADEditorProps) => {
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [darkBg, setDarkBg] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [modelColor, setModelColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Text-to-3D state
  const [textTo3DOpen, setTextTo3DOpen] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState('');
  const [selected3DProvider, setSelected3DProvider] = useState<'meshy' | 'sloyd' | 'tripo' | 'modelslab' | 'fal' | 'neural4d'>('meshy');
  
  // GLB geometry state (for async loaded models)
  const [glbGeometry, setGlbGeometry] = useState<THREE.BufferGeometry | null>(null);
  
  const { hasCustomKey } = useApiKeys();

  const PROVIDERS_3D = [
    { id: 'meshy', label: 'Meshy AI', desc: 'Preview + refine workflow' },
    { id: 'sloyd', label: 'Sloyd AI', desc: 'Game-ready assets' },
    { id: 'tripo', label: 'Tripo AI', desc: 'Detailed models' },
    { id: 'modelslab', label: 'ModelsLab', desc: 'Customizable params' },
    { id: 'fal', label: 'Fal.ai', desc: 'Hyper3D Rodin / Trellis' },
    { id: 'neural4d', label: 'Neural4D', desc: 'Fast (<90s), STL export' },
  ] as const;

  const loadCADFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => onContentChange(file.id, reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleCADUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stl,.obj,.glb,.gltf';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) loadCADFile(f);
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadCADFile(f);
  };

  const handleSelectPrimitive = (type: PrimitiveType) => {
    // Store primitive marker in file content
    onContentChange(file.id, `primitive:${type}`);
    setGlbGeometry(null);
  };

  const handleTextTo3D = async () => {
    if (!textPrompt.trim()) return;
    
    setGenerating(true);
    setGenProgress('Starting generation...');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-3d', {
        body: { prompt: textPrompt.trim(), provider: selected3DProvider },
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.status === 'polling') {
        // Start polling for result
        setGenProgress('Generating 3D model...');
        await pollForResult(data.taskId);
      } else if (data?.glbUrl) {
        await loadGLBFromUrl(data.glbUrl);
        setTextTo3DOpen(false);
        setTextPrompt('');
      } else {
        throw new Error(data?.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text-to-3D failed');
    } finally {
      setGenerating(false);
      setGenProgress('');
    }
  };

  const pollForResult = async (taskId: string) => {
    const maxAttempts = 60; // 5 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
      
      const { data, error } = await supabase.functions.invoke('generate-3d', {
        body: { taskId, provider: selected3DProvider },
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.status === 'SUCCEEDED' && data?.glbUrl) {
        await loadGLBFromUrl(data.glbUrl);
        setTextTo3DOpen(false);
        setTextPrompt('');
        return;
      } else if (data?.status === 'FAILED') {
        throw new Error('3D generation failed');
      }
      
      setGenProgress(`Generating... ${Math.min(90, Math.round((i / maxAttempts) * 100))}%`);
    }
    throw new Error('Generation timed out');
  };

  const loadGLBFromUrl = async (url: string) => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const geometry = await parseGLB(buffer);
    setGlbGeometry(geometry);
    // Store as data URL for persistence
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    onContentChange(file.id, `data:model/gltf-binary;base64,${base64}`);
  };

  const geometry = useMemo(() => {
    const content = file.content || '';
    if (!content.trim()) return null;

    try {
      setLoading(true);
      setError(null);
      
      // Check for primitive marker
      if (content.startsWith('primitive:')) {
        const type = content.replace('primitive:', '') as PrimitiveType;
        return createPrimitiveGeometry(type);
      }
      
      const ext = file.name.split('.').pop()?.toLowerCase();

      // Check for GLB data URL
      if (content.startsWith('data:model/gltf-binary')) {
        // GLB needs async parsing, handle separately
        const b64 = content.split(',')[1] || '';
        const binary = atob(b64);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        parseGLB(buffer).then(setGlbGeometry).catch(e => setError(e.message));
        return null;
      }

      if (ext === 'stl') {
        // STL: decode base64 to ArrayBuffer
        const isDataUrl = content.startsWith('data:');
        let b64 = content;
        if (isDataUrl) {
          b64 = content.split(',')[1] || '';
        }
        const binary = atob(b64);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        return parseSTL(buffer);
      }

      if (ext === 'obj') {
        // OBJ is text
        const isDataUrl = content.startsWith('data:');
        let text = content;
        if (isDataUrl) {
          const b64 = content.split(',')[1] || '';
          text = atob(b64);
        }
        return parseOBJ(text);
      }
      
      if (ext === 'glb' || ext === 'gltf') {
        // GLB/GLTF: decode and parse async
        const isDataUrl = content.startsWith('data:');
        let b64 = content;
        if (isDataUrl) {
          b64 = content.split(',')[1] || '';
        }
        const binary = atob(b64);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        parseGLB(buffer).then(setGlbGeometry).catch(e => setError(e.message));
        return null;
      }

      setError(`Unsupported format: .${ext}`);
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse 3D file');
      return null;
    } finally {
      setLoading(false);
    }
  }, [file.content, file.name]);

  // Use glbGeometry if available (for async loaded GLB files)
  const displayGeometry = glbGeometry || geometry;

  const colors = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#64748b'];
  const featureTree = [
    'Top plane sketch',
    'Extrude 1',
    'Fillet edge set',
    'Shell body',
    'Mirror feature',
  ];
  const quickTools = [
    { label: 'Sketch', icon: <Pencil className="w-3.5 h-3.5" /> },
    { label: 'Extrude', icon: <Combine className="w-3.5 h-3.5" /> },
    { label: 'Revolve', icon: <Grip className="w-3.5 h-3.5" /> },
    { label: 'Loft', icon: <Cuboid className="w-3.5 h-3.5" /> },
    { label: 'Boolean', icon: <Bolt className="w-3.5 h-3.5" /> },
    { label: 'Measure', icon: <Ruler className="w-3.5 h-3.5" /> },
  ];

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] text-white">
        <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#2b313c]">
          <div className="flex items-center gap-2 min-w-0">
            <Box className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate">Part Studio · {file.name}</span>
            {loading && <Loader2 className="w-3.5 h-3.5 text-white/50 animate-spin" />}
          </div>
          <div className="flex items-center gap-1.5">
            {quickTools.map((tool) => (
              <Button key={tool.label} variant="ghost" size="sm" className="h-7 text-xs text-white/80 hover:text-white hover:bg-white/10 gap-1.5 px-2">
                {tool.icon}
                {tool.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={cn("h-7 w-7 hover:bg-white/10", wireframe ? "text-primary" : "text-white/70")} onClick={() => setWireframe(!wireframe)}>
                <Layers className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Wireframe</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={cn("h-7 w-7 hover:bg-white/10", showGrid ? "text-primary" : "text-white/70")} onClick={() => setShowGrid(!showGrid)}>
                <Grid3X3 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Grid</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setDarkBg(!darkBg)}>
                {darkBg ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger><TooltipContent>Toggle Background</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={cn("h-7 w-7 hover:bg-white/10", showInfo ? "text-primary" : "text-white/70")} onClick={() => setShowInfo(!showInfo)}>
                <Info className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Model Info</TooltipContent></Tooltip>

            <div className="flex items-center gap-0.5 pl-2 border-l border-[#333]">
              {colors.map(c => (
                <button
                  key={c}
                  className={cn("w-4 h-4 rounded-full border-2 transition-transform", modelColor === c ? "border-white scale-125" : "border-transparent hover:scale-110")}
                  style={{ backgroundColor: c }}
                  onClick={() => setModelColor(c)}
                />
              ))}
            </div>

            {displayGeometry && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 ml-1 border-l border-[#333] pl-2">
                        <FileDown className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Export Model</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToSTL(displayGeometry, file.name)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export as STL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToOBJ(displayGeometry, file.name)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export as OBJ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <aside className="w-64 bg-[#0f141b] border-r border-[#2b313c] p-3 space-y-3 overflow-auto">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/50 mb-2 flex items-center gap-1.5">
                <PanelLeft className="w-3 h-3" />
                Features
              </div>
              <div className="space-y-1.5">
                {featureTree.map((item, idx) => (
                  <div key={item} className="text-xs rounded bg-white/5 border border-white/10 px-2 py-1.5 flex items-center justify-between">
                    <span className="truncate">{item}</span>
                    <span className="text-[10px] text-white/40">{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="text-[11px] uppercase tracking-wide text-white/50 mb-2">Starter geometry</div>
              <div className="grid grid-cols-1 gap-1.5">
                {PRIMITIVES.map(p => (
                  <Button
                    key={p.type}
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 text-white/80 hover:text-white hover:bg-white/10 gap-2"
                    onClick={() => handleSelectPrimitive(p.type)}
                  >
                    {p.icon}
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            {showInfo && displayGeometry && (
              <div className="px-4 py-1.5 bg-[#161b22] border-b border-[#2b313c]">
                <SceneInfo geometry={displayGeometry} />
              </div>
            )}

            <div className="flex-1 relative" style={{ background: darkBg ? '#111827' : '#dbe4f0' }}>
              {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-destructive/90 text-white px-4 py-2 rounded-lg text-sm">{error}</div>
                </div>
              )}

              <Canvas
                shadows
                camera={{ position: [5, 5, 5], fov: 50 }}
                gl={{ antialias: true, alpha: true }}
              >
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                <directionalLight position={[-5, 5, -5]} intensity={0.3} />

                <Suspense fallback={
                  <Html center>
                    <div className="flex items-center gap-2 text-white/50 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading model…
                    </div>
                  </Html>
                }>
                  {displayGeometry ? (
                    <Model geometry={displayGeometry} wireframe={wireframe} color={modelColor} />
                  ) : (
                    <DemoCube />
                  )}

                  {showGrid && (
                    <Grid
                      infiniteGrid
                      cellSize={1}
                      sectionSize={5}
                      cellColor={darkBg ? '#26303c' : '#9ca9b8'}
                      sectionColor={darkBg ? '#3f4c5d' : '#6d7d90'}
                      fadeDistance={30}
                    />
                  )}

                  <hemisphereLight args={[darkBg ? '#1a1a2e' : '#87ceeb', darkBg ? '#111' : '#fff', 0.6]} />
                </Suspense>

                <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
                <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                  <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
                </GizmoHelper>
              </Canvas>

              {!displayGeometry && !error && (
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center z-10 transition-colors",
                    dragOver && "bg-primary/10 ring-2 ring-primary ring-inset"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="bg-black/65 backdrop-blur-sm text-white/70 text-sm px-6 py-5 rounded-lg flex flex-col items-center gap-4 max-w-xs">
                    <Upload className={cn("w-8 h-8 transition-transform", dragOver && "scale-110 text-primary")} />
                    <span>{dragOver ? 'Drop 3D file here' : 'Drag & drop a .stl, .obj, or .glb file'}</span>
                    <Button variant="outline" size="sm" className="gap-2 text-white/80 border-white/20 hover:bg-white/10" onClick={handleCADUpload}>
                      <Upload className="w-3.5 h-3.5" /> Browse Files
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-white/80 border-white/20 hover:bg-white/10"
                      onClick={() => setTextTo3DOpen(true)}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Generate from prompt
                    </Button>
                  </div>
                </div>
              )}

              <div className="absolute top-3 left-3 text-[11px] text-white/70 bg-black/45 rounded px-2 py-1">Perspective · Millimeters</div>
              <div className="absolute bottom-3 right-3 text-[10px] text-white/30 space-y-0.5 text-right">
                <div>LMB: Rotate</div>
                <div>RMB: Pan</div>
                <div>Scroll: Zoom</div>
              </div>
            </div>
          </div>

          <aside className="w-72 bg-[#0f141b] border-l border-[#2b313c] p-3 space-y-3 overflow-auto">
            <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1 flex items-center gap-1.5">
              <PanelRight className="w-3 h-3" />
              Properties
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2.5 space-y-2">
              <div className="text-xs text-white/80 font-medium">Active body</div>
              <div className="text-[11px] text-white/55">{displayGeometry ? 'Imported solid body' : 'No body selected'}</div>
              <div className="text-[11px] text-white/55 flex items-center gap-1.5"><ScanFace className="w-3 h-3" /> Appearance swatches</div>
              <div className="flex flex-wrap gap-1">
                {colors.map(c => (
                  <button
                    key={`prop-${c}`}
                    className={cn("w-5 h-5 rounded border transition-transform", modelColor === c ? "border-white scale-110" : "border-white/20")}
                    style={{ backgroundColor: c }}
                    onClick={() => setModelColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2.5 space-y-2">
              <div className="text-xs text-white/80 font-medium">Session helpers</div>
              <Button size="sm" variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={handleCADUpload}>
                <Upload className="w-3.5 h-3.5 mr-2" /> Import geometry
              </Button>
              <Button size="sm" variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={() => setTextTo3DOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-2" /> Text to 3D
              </Button>
            </div>
          </aside>
        </div>

        <div className="h-7 border-t border-[#2b313c] bg-[#161b22] px-3 text-[11px] text-white/60 flex items-center justify-between">
          <span>Part Studio 1 · Workspace main</span>
          <span className="flex items-center gap-1.5"><Move className="w-3 h-3" /> Precision snap enabled</span>
        </div>

        {/* Text to 3D Dialog */}
        <Dialog open={textTo3DOpen} onOpenChange={setTextTo3DOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Text to 3D
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  3D Generation Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS_3D.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelected3DProvider(p.id)}
                      disabled={generating}
                      className={cn(
                        "text-left p-2 rounded-lg border transition-colors",
                        selected3DProvider === p.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <div className="text-xs font-medium">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Describe the 3D model you want to create
                </label>
                <Input
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="e.g., a wooden chair, a red sports car, a medieval sword"
                  disabled={generating}
                />
              </div>

              {!hasCustomKey(selected3DProvider as 'meshy' | 'sloyd' | 'tripo' | 'modelslab' | 'fal' | 'neural4d') && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  <strong>API Key Required:</strong> Click your avatar (top right) → Settings → API Keys → add your {PROVIDERS_3D.find(p => p.id === selected3DProvider)?.label} key.
                </div>
              )}

              {genProgress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {genProgress}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTextTo3DOpen(false)} disabled={generating}>
                Cancel
              </Button>
              <Button
                onClick={handleTextTo3D}
                disabled={!textPrompt.trim() || generating || !hasCustomKey(selected3DProvider as 'meshy' | 'sloyd' | 'tripo' | 'modelslab' | 'fal' | 'neural4d')}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
