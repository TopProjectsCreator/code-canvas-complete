import { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import { parse as opentypeParse, Font } from 'opentype.js';
import { decodeDataUrl, encodeDataUrl } from './office/officeUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Info, Grid3X3, Type, Eye, Loader2, AlertCircle,
  Save, Download, Search, FileText, SlidersHorizontal,
} from 'lucide-react';

const FONT_METADATA_KEYS = [
  { key: 'fontFamily', label: 'Font Family' },
  { key: 'fontSubfamily', label: 'Subfamily' },
  { key: 'version', label: 'Version' },
  { key: 'copyright', label: 'Copyright' },
  { key: 'designer', label: 'Designer' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'description', label: 'Description' },
  { key: 'license', label: 'License' },
  { key: 'licenseURL', label: 'License URL' },
  { key: 'trademark', label: 'Trademark' },
];

function fontToBase64(font: Font): string {
  const buffer = font.toArrayBuffer();
  const bytes = new Uint8Array(buffer);
  return encodeDataUrl('application/x-font-ttf', bytes);
}

function extractMetadata(font: Font): Record<string, string> {
  const names = (font as any).names;
  if (!names) return {};
  const platforms = [names.windows, names.macintosh, names.unicode].filter(Boolean);
  const result: Record<string, string> = {};
  for (const { key } of FONT_METADATA_KEYS) {
    for (const p of platforms) {
      const v = p[key];
      if (v) {
        result[key] = v.en || v['en-US'] || v['en-GB'] || Object.values(v)[0] || '';
        break;
      }
    }
  }
  return result;
}

function applyMetadata(font: Font, metadata: Record<string, string>) {
  const names = (font as any).names;
  if (!names) return;
  const platforms = ['windows', 'macintosh', 'unicode'];
  for (const platform of platforms) {
    if (!names[platform]) continue;
    for (const { key } of FONT_METADATA_KEYS) {
      if (metadata[key] !== undefined && names[platform][key]) {
        names[platform][key].en = metadata[key];
      }
    }
  }
}

function GlyphPreview({ font, glyphIndex, size }: { font: Font; glyphIndex: number; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    try {
      const glyph = font.glyphs.get(glyphIndex);
      if (!glyph) return;
      glyph.draw(ctx, 0, size * 0.85, size * 0.75);
    } catch {}
  }, [font, glyphIndex, size]);
  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

function GlyphDetailView({ font, glyphIndex }: { font: Font; glyphIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glyph = font.glyphs.get(glyphIndex);
  useEffect(() => {
    if (!glyph) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'hsl(var(--editor))';
    ctx.fillRect(0, 0, w, h);
    try {
      const fontSize = Math.min(w, h) * 0.6;
      const glyphPath = glyph.getPath(0, 0, fontSize);
      const bb = glyphPath.getBoundingBox();
      const gW = bb.x2 - bb.x1;
      const gH = bb.y2 - bb.y1;
      const ox = (w - gW) / 2 - bb.x1;
      const oy = (h - gH) / 2 - bb.y1;
      ctx.strokeStyle = 'hsl(var(--foreground))';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'hsl(var(--foreground))';
      glyph.draw(ctx, ox, oy, fontSize);
      ctx.strokeStyle = 'hsl(var(--primary) / 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(ox + bb.x1, oy + bb.y1, gW, gH);
      ctx.setLineDash([]);
    } catch {}
  }, [font, glyphIndex, glyph]);
  if (!glyph) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Glyph not found</div>;
  }
  const unicodes = glyph.unicodes || (glyph.unicode !== undefined ? [glyph.unicode] : []);
  const commands = glyph.path?.commands || [];
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-4 p-3 border-b border-border bg-editor flex-wrap text-sm">
        <div><span className="text-muted-foreground">Index:</span> <span className="font-mono">{glyph.index}</span></div>
        <div><span className="text-muted-foreground">Name:</span> <span className="font-mono">{glyph.name || '—'}</span></div>
        <div><span className="text-muted-foreground">Unicode:</span>
          <span className="font-mono">
            {unicodes.length > 0
              ? unicodes.map(u => `U+${u.toString(16).toUpperCase().padStart(4, '0')} (${String.fromCodePoint(u)})`).join(', ')
              : '—'}
          </span>
        </div>
        {glyph.numberOfContours !== undefined && (
          <div><span className="text-muted-foreground">Contours:</span> <span className="font-mono">{glyph.numberOfContours}</span></div>
        )}
        <div><span className="text-muted-foreground">Advance Width:</span> <span className="font-mono">{glyph.advanceWidth}</span></div>
      </div>
      <div className="flex-1 relative" ref={el => { if (el) { const c = canvasRef.current; if (c) { c.style.width = '100%'; c.style.height = '100%'; } } }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
      <ScrollArea className="max-h-48 border-t border-border">
        <div className="p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Path Commands ({commands.length})</div>
          <pre className="text-xs font-mono text-muted-foreground/80 leading-relaxed">
            {commands.map((cmd: any, i: number) => {
              if (cmd.type === 'M') return `M ${cmd.x} ${cmd.y}`;
              if (cmd.type === 'L') return `L ${cmd.x} ${cmd.y}`;
              if (cmd.type === 'C') return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
              if (cmd.type === 'Q') return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
              if (cmd.type === 'Z') return 'Z';
              return JSON.stringify(cmd);
            }).join('\n')}
          </pre>
        </div>
      </ScrollArea>
    </div>
  );
}

export const FontEditor = ({ file, onContentChange }: { file: FileNode; onContentChange: (fileId: string, content: string) => void }) => {
  const [font, setFont] = useState<Font | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [selectedGlyphIndex, setSelectedGlyphIndex] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog\n0123456789');
  const [previewSize, setPreviewSize] = useState(48);
  const [previewColor, setPreviewColor] = useState('#ffffff');
  const [previewBg, setPreviewBg] = useState('#1a1a2e');
  const [showMetrics, setShowMetrics] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [glyphSearch, setGlyphSearch] = useState('');

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file.content) {
      setFont(null);
      setError('No font data available');
      return;
    }
    setError(null);
    setFont(null);
    try {
      const bytes = decodeDataUrl(file.content);
      if (!bytes) {
        setError('Could not decode font data');
        return;
      }
      const parsedFont = opentypeParse(bytes.buffer as ArrayBuffer);
      setFont(parsedFont);
      setMetadata(extractMetadata(parsedFont));
      setHasChanges(false);
    } catch (e: any) {
      setFont(null);
      if (e?.message?.includes('WOFF2')) {
        setError('WOFF2 fonts are not supported yet. Please use TTF, OTF, or WOFF format.');
      } else {
        setError(`Failed to load font: ${e?.message || 'Unknown error'}`);
      }
    }
  }, [file.content]);

  useEffect(() => {
    if (!font || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = previewBg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = previewColor;
    ctx.textBaseline = 'top';
    try {
      font.draw(ctx, previewText, 20, 20, previewSize);
      if (showMetrics) {
        font.drawMetrics(ctx, previewText, 20, 20, previewSize);
      }
    } catch {}
  }, [font, previewText, previewSize, previewColor, previewBg, showMetrics]);

  const handleSave = useCallback(() => {
    if (!font) return;
    try {
      applyMetadata(font, metadata);
      const base64 = fontToBase64(font);
      onContentChange(file.id, base64);
      setHasChanges(false);
    } catch (e: any) {
      setError(`Failed to save: ${e?.message || 'Unknown error'}`);
    }
  }, [font, metadata, file.id, onContentChange]);

  const handleMetadataChange = (key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleDownload = useCallback(() => {
    if (!font) return;
    try {
      applyMetadata(font, metadata);
      const base64 = fontToBase64(font);
      const a = document.createElement('a');
      a.href = base64;
      a.download = file.name.replace(/\.(woff|woff2)$/, '.ttf');
      a.click();
    } catch {}
  }, [font, metadata, file.name]);

  const glyphs = font ? (() => {
    const items: { index: number; unicode: number | undefined; name: string | null }[] = [];
    for (let i = 0; i < font.glyphs.length; i++) {
      const g = font.glyphs.get(i);
      items.push({ index: i, unicode: g.unicode, name: g.name });
    }
    return items;
  })() : [];

  const filteredGlyphs = glyphSearch
    ? glyphs.filter(g => {
        const q = glyphSearch.toLowerCase();
        return (
          (g.name && g.name.toLowerCase().includes(q)) ||
          g.index.toString().includes(q) ||
          g.index.toString(16).includes(q.toLowerCase()) ||
          (g.unicode !== undefined && String.fromCodePoint(g.unicode).toLowerCase() === q) ||
          (g.unicode !== undefined && `U+${g.unicode.toString(16).toUpperCase().padStart(4, '0')}`.includes(q.toUpperCase()))
        );
      })
    : glyphs;

  return (
    <div className="flex-1 flex flex-col bg-editor">
      {error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <p className="text-destructive font-medium text-lg">Failed to Load Font</p>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        </div>
      )}

      {!font && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading font...</p>
          </div>
        </div>
      )}

      {font && !error && (
        <>
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-editor shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{metadata.fontFamily || file.name}</span>
              {metadata.fontSubfamily && (
                <span className="text-xs text-muted-foreground hidden sm:inline">{metadata.fontSubfamily}</span>
              )}
              <span className="text-xs text-muted-foreground hidden md:inline">· {font.glyphs.length} glyphs</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={!hasChanges}>
                <Save className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5 mr-1" />
                Download
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 border-b border-border shrink-0">
              <TabsList>
                <TabsTrigger value="preview">
                  <Type className="w-3.5 h-3.5 mr-1.5" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="glyphs">
                  <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />
                  Glyphs
                </TabsTrigger>
                <TabsTrigger value="info">
                  <Info className="w-3.5 h-3.5 mr-1.5" />
                  Info
                </TabsTrigger>
                <TabsTrigger value="details">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 flex flex-col m-0 data-[state=active]:flex min-h-0">
              <div className="flex items-center gap-2 p-2 border-b border-border bg-editor flex-wrap shrink-0">
                <div className="flex-1 min-w-[150px]">
                  <Input
                    value={previewText}
                    onChange={e => setPreviewText(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Type text to preview..."
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Size:</Label>
                  <Input
                    type="number"
                    value={previewSize}
                    onChange={e => setPreviewSize(Math.max(8, Math.min(200, Number(e.target.value) || 48)))}
                    className="w-16 h-8 text-sm"
                    min={8}
                    max={200}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">A:</Label>
                  <input
                    type="color"
                    value={previewColor}
                    onChange={e => setPreviewColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-border p-0.5"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Bg:</Label>
                  <input
                    type="color"
                    value={previewBg}
                    onChange={e => setPreviewBg(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-border p-0.5"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMetrics(!showMetrics)}
                  className={cn(showMetrics && "bg-accent", "h-8")}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                  Metrics
                </Button>
              </div>
              <div className="flex-1 relative overflow-auto min-h-0">
                <canvas ref={previewCanvasRef} className="absolute inset-0 w-full h-full" />
              </div>
            </TabsContent>

            <TabsContent value="glyphs" className="flex-1 flex flex-col m-0 data-[state=active]:flex min-h-0">
              <div className="p-2 border-b border-border bg-editor shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={glyphSearch}
                    onChange={e => setGlyphSearch(e.target.value)}
                    placeholder="Search by name, index, or codepoint..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {filteredGlyphs.length} / {glyphs.length} glyphs
                </div>
              </div>
              <ScrollArea className="flex-1">
                {filteredGlyphs.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    No glyphs match your search
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1 p-2">
                    {filteredGlyphs.map(g => (
                      <button
                        key={g.index}
                        onClick={() => { setSelectedGlyphIndex(g.index); setActiveTab('details'); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-1.5 rounded border transition-colors cursor-pointer",
                          "hover:bg-accent hover:text-accent-foreground",
                          selectedGlyphIndex === g.index
                            ? "border-primary bg-primary/10"
                            : "border-transparent"
                        )}
                      >
                        <GlyphPreview font={font} glyphIndex={g.index} size={36} />
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-0.5 leading-tight">
                          {g.name || `g${g.index}`}
                        </span>
                        {g.unicode !== undefined && (
                          <span className="text-[9px] text-muted-foreground/60 truncate w-full text-center">
                            U+{g.unicode.toString(16).toUpperCase().padStart(4, '0')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="info" className="flex-1 flex flex-col m-0 data-[state=active]:flex min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-4 max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FONT_METADATA_KEYS.map(({ key, label }) => (
                      <div key={key} className={key === 'description' || key === 'license' || key === 'licenseURL' ? 'md:col-span-2' : ''}>
                        <Label htmlFor={`meta-${key}`} className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                        <Input
                          id={`meta-${key}`}
                          value={metadata[key] || ''}
                          onChange={e => handleMetadataChange(key, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                      Technical Details
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                      {[
                        ['Units Per Em', font.unitsPerEm],
                        ['Ascender', font.ascender],
                        ['Descender', font.descender],
                        ['Number of Glyphs', font.glyphs.length],
                        ['Outlines Format', font.outlinesFormat],
                        ['Supported', font.supported ? 'Yes' : 'No'],
                        ['Created', font.createdTimestamp ? new Date(font.createdTimestamp * 1000).toLocaleDateString() : 'Unknown'],
                      ].map(([label, value]) => (
                        <div key={label as string} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{label as string}</span>
                          <span className="font-mono text-xs">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="details" className="flex-1 flex flex-col m-0 data-[state=active]:flex min-h-0">
              {selectedGlyphIndex !== null && font ? (
                <GlyphDetailView font={font} glyphIndex={selectedGlyphIndex} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Eye className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Select a glyph from the <span className="font-medium">Glyphs</span> tab</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};
