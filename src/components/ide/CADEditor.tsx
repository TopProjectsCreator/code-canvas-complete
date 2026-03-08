import { useState, useRef, useCallback, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport, Center, Html } from '@react-three/drei';
import * as THREE from 'three';
import { FileNode } from '@/types/ide';
import {
  Box, RotateCcw, ZoomIn, ZoomOut, Eye, Layers, Sun, Moon,
  Maximize, Info, Download, Grid3X3, Move, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CADEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
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

  const geometry = useMemo(() => {
    const content = file.content || '';
    if (!content.trim()) return null;

    try {
      setLoading(true);
      setError(null);
      const ext = file.name.split('.').pop()?.toLowerCase();

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

      setError(`Unsupported format: .${ext}`);
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse 3D file');
      return null;
    } finally {
      setLoading(false);
    }
  }, [file.content, file.name]);

  const colors = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#64748b'];

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-white">{file.name}</span>
            {loading && <Loader2 className="w-3.5 h-3.5 text-white/50 animate-spin" />}
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

            {/* Color picker */}
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
          </div>
        </div>

        {/* Info bar */}
        {showInfo && geometry && (
          <div className="px-4 py-1.5 bg-[#1a1a1a] border-b border-[#333]">
            <SceneInfo geometry={geometry} />
          </div>
        )}

        {/* 3D Viewport */}
        <div className="flex-1 relative" style={{ background: darkBg ? '#111' : '#e5e7eb' }}>
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
              {geometry ? (
                <Model geometry={geometry} wireframe={wireframe} color={modelColor} />
              ) : (
                <DemoCube />
              )}

              {showGrid && (
                <Grid
                  infiniteGrid
                  cellSize={1}
                  sectionSize={5}
                  cellColor={darkBg ? '#333' : '#bbb'}
                  sectionColor={darkBg ? '#555' : '#888'}
                  fadeDistance={30}
                />
              )}

              <Environment preset={darkBg ? 'night' : 'city'} />
            </Suspense>

            <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
            </GizmoHelper>
          </Canvas>

          {/* Viewport overlay hints */}
          {!geometry && !error && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white/70 text-sm px-4 py-2 rounded-lg">
              Upload a <strong>.stl</strong> or <strong>.obj</strong> file to view it here
            </div>
          )}

          {/* Controls hint */}
          <div className="absolute bottom-3 right-3 text-[10px] text-white/30 space-y-0.5 text-right">
            <div>LMB: Rotate</div>
            <div>RMB: Pan</div>
            <div>Scroll: Zoom</div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
