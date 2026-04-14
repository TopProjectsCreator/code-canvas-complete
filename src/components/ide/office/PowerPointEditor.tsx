import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { FileNode } from '@/types/ide';
import {
  Presentation, Save, Plus, Trash2, Copy, ChevronUp, ChevronDown,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Type, Square, Image, Play, Undo, Redo, Loader2,
  Table, Film, Link, Palette, Wand2, Zap, RotateCcw,
  Eye, SlidersHorizontal, Timer, Maximize, Move, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { decodeDataUrl, encodeDataUrl, parseXml, buildNewPptx } from './officeUtils';

interface SlideElement {
  id: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // text content or data URL for images
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
}

interface SlideData {
  elements: SlideElement[];
}

interface PowerPointEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

let elementIdCounter = 0;
const newId = () => `el-${Date.now()}-${elementIdCounter++}`;

const CANVAS_W = 720;
const CANVAS_H = 405;
const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625;

const toSlideX = (x: number) => (x / CANVAS_W) * SLIDE_W_IN;
const toSlideY = (y: number) => (y / CANVAS_H) * SLIDE_H_IN;
const toSlideW = (w: number) => (w / CANVAS_W) * SLIDE_W_IN;
const toSlideH = (h: number) => (h / CANVAS_H) * SLIDE_H_IN;

export const PowerPointEditor = ({ file, onContentChange }: PowerPointEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [ribbonTab, setRibbonTab] = useState<'home' | 'insert' | 'design' | 'transitions' | 'animations' | 'slideshow'>('home');
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; elW: number; elH: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<SlideData[][]>([]);
  const redoRef = useRef<SlideData[][]>([]);
  const [themeTone, setThemeTone] = useState<'light' | 'dark'>('light');
  const [slideScale, setSlideScale] = useState(100);
  const [transitionType, setTransitionType] = useState<'none' | 'fade' | 'push'>('none');
  const [animationType, setAnimationType] = useState<'none' | 'appear' | 'fly'>('none');
  const [previewMode, setPreviewMode] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let bytes = decodeDataUrl(file.content || '');
        if (!bytes) {
          bytes = await buildNewPptx();
          onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes));
        }
        const zip = await JSZip.loadAsync(bytes);
        const slideFiles = Object.keys(zip.files)
          .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const parsed: SlideData[] = [];
        for (const slideFile of slideFiles) {
          const xml = await zip.file(slideFile)?.async('string');
          if (!xml) continue;
          const doc = parseXml(xml);
          const spNodes = Array.from(doc.getElementsByTagNameNS('*', 'sp'));
          const elements: SlideElement[] = [];
          for (const sp of spNodes) {
            const tNodes = Array.from(sp.getElementsByTagNameNS('*', 't'));
            const text = tNodes.map(n => n.textContent || '').join('');
            if (text || tNodes.length > 0) {
              const isTitle = elements.length === 0;
              elements.push({
                id: newId(),
                type: 'text',
                x: 30,
                y: isTitle ? 30 : 100 + (elements.length - 1) * 70,
                width: 660,
                height: isTitle ? 60 : 50,
                content: text,
                fontSize: isTitle ? 28 : 16,
                fontWeight: isTitle ? 700 : 400,
              });
            }
          }
          if (elements.length === 0) {
            elements.push(
              { id: newId(), type: 'text', x: 30, y: 30, width: 660, height: 60, content: 'Click to add title', fontSize: 28, fontWeight: 700 },
              { id: newId(), type: 'text', x: 30, y: 120, width: 660, height: 50, content: 'Click to add subtitle', fontSize: 16, fontWeight: 400 },
            );
          }
          parsed.push({ elements });
        }
        if (parsed.length === 0) {
          parsed.push({
            elements: [
              { id: newId(), type: 'text', x: 30, y: 30, width: 660, height: 60, content: 'Click to add title', fontSize: 28, fontWeight: 700 },
              { id: newId(), type: 'text', x: 30, y: 120, width: 660, height: 50, content: 'Click to add subtitle', fontSize: 16, fontWeight: 400 },
            ]
          });
        }
        setSlides(parsed);
        setActiveSlide(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open presentation');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [file.id]); // Only reload when file ID changes, not content



  // Mouse move/up for drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        const dx = e.clientX - dragging.startX;
        const dy = e.clientY - dragging.startY;
        setSlides(prev => prev.map((s, i) =>
          i === activeSlide ? {
            ...s,
            elements: s.elements.map(el =>
              el.id === dragging.id ? { ...el, x: Math.max(0, dragging.elX + dx), y: Math.max(0, dragging.elY + dy) } : el
            )
          } : s
        ));
      }
      if (resizing) {
        const dx = e.clientX - resizing.startX;
        const dy = e.clientY - resizing.startY;
        setSlides(prev => prev.map((s, i) =>
          i === activeSlide ? {
            ...s,
            elements: s.elements.map(el =>
              el.id === resizing.id ? { ...el, width: Math.max(40, resizing.elW + dx), height: Math.max(20, resizing.elH + dy) } : el
            )
          } : s
        ));
      }
    };
    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, activeSlide]);

  const save = useCallback(async () => {
    try {
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'CANVAS_16_9', width: SLIDE_W_IN, height: SLIDE_H_IN });
      pptx.layout = 'CANVAS_16_9';

      slides.forEach((slideData) => {
        const slide = pptx.addSlide();

        slideData.elements.forEach((el) => {
          const x = toSlideX(el.x);
          const y = toSlideY(el.y);
          const w = toSlideW(el.width);
          const h = toSlideH(el.height);

          if (el.type === 'image' && el.content?.startsWith('data:image/')) {
            try {
              slide.addImage({ data: el.content, x, y, w, h });
            } catch {
              // Skip invalid image payloads instead of failing whole save
            }
            return;
          }

          slide.addText(el.content || '', {
            x,
            y,
            w,
            h,
            fontSize: el.fontSize || 16,
            bold: (el.fontWeight || 400) >= 600,
            valign: 'top',
            breakLine: true,
            color: '1A1A1A',
          });
        });
      });

      const out = await pptx.write({ outputType: 'arraybuffer' });
      let bytes: Uint8Array;
      if (out instanceof ArrayBuffer) {
        bytes = new Uint8Array(out);
      } else if (out instanceof Uint8Array) {
        bytes = out;
      } else if (out instanceof Blob) {
        bytes = new Uint8Array(await out.arrayBuffer());
      } else {
        bytes = new TextEncoder().encode(String(out));
      }
      onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save presentation');
    }
  }, [file.id, slides, onContentChange]);

  // Auto-save when slides change
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (loading || slides.length === 0) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    const timer = setTimeout(() => {
      save();
    }, 500);
    return () => clearTimeout(timer);
  }, [slides, loading, save]);


  const commitSlides = (updater: (prev: SlideData[]) => SlideData[]) => {
    setSlides(prev => {
      historyRef.current.push(JSON.parse(JSON.stringify(prev)));
      redoRef.current = [];
      return updater(prev);
    });
  };


  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push(JSON.parse(JSON.stringify(slides)));
    setSlides(prev);
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(JSON.parse(JSON.stringify(slides)));
    setSlides(next);
  };

  const addSlide = () => {
    let nextIndex = 0;
    commitSlides(prev => {
      const next = [...prev, {
        elements: [
          { id: newId(), type: 'text' as const, x: 30, y: 30, width: 660, height: 60, content: 'Click to add title', fontSize: 28, fontWeight: 700 },
          { id: newId(), type: 'text' as const, x: 30, y: 120, width: 660, height: 50, content: 'Click to add subtitle', fontSize: 16, fontWeight: 400 },
        ]
      }];
      nextIndex = next.length - 1;
      return next;
    });
    setActiveSlide(nextIndex);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    let nextLength = slides.length;
    commitSlides(prev => {
      const next = prev.filter((_, i) => i !== idx);
      nextLength = next.length;
      return next;
    });
    setActiveSlide(prev => Math.min(prev, nextLength - 1));
  };

  const duplicateSlide = (idx: number) => {
    commitSlides(prev => {
      const next = [...prev];
      const cloned: SlideData = { elements: prev[idx].elements.map(el => ({ ...el, id: newId() })) };
      next.splice(idx + 1, 0, cloned);
      return next;
    });
    setActiveSlide(idx + 1);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= slides.length) return;
    commitSlides(prev => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
    setActiveSlide(newIdx);
  };

  const updateElementContent = (elId: string, value: string) => {
    commitSlides(prev => prev.map((s, i) =>
      i === activeSlide ? { ...s, elements: s.elements.map(el => el.id === elId ? { ...el, content: value } : el) } : s
    ));
  };

  const addTextBox = () => {
    const el: SlideElement = { id: newId(), type: 'text', x: 100, y: 200, width: 400, height: 50, content: 'New text box', fontSize: 16, fontWeight: 400 };
    commitSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, elements: [...s.elements, el] } : s));
    setSelectedElement(el.id);
  };

  const addImage = (dataUrl: string) => {
    const img = new window.Image();
    img.onload = () => {
      const maxW = 400;
      const scale = Math.min(1, maxW / img.width);
      const el: SlideElement = {
        id: newId(), type: 'image',
        x: 160, y: 100,
        width: Math.round(img.width * scale),
        height: Math.round(img.height * scale),
        content: dataUrl,
      };
      commitSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, elements: [...s.elements, el] } : s));
      setSelectedElement(el.id);
    };
    img.src = dataUrl;
  };

  const handleImageUpload = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') addImage(reader.result);
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const deleteElement = (id: string) => {
    commitSlides(prev => prev.map((s, i) =>
      i === activeSlide ? { ...s, elements: s.elements.filter(el => el.id !== id) } : s
    ));
    setSelectedElement(null);
    setEditingElement(null);
  };

  const updateSelectedTextElement = (updater: (el: SlideElement) => SlideElement) => {
    if (!selectedElement) return;
    commitSlides(prev => prev.map((s, i) => i === activeSlide
      ? { ...s, elements: s.elements.map(el => (el.id === selectedElement && el.type === 'text') ? updater(el) : el) }
      : s));
  };

  const insertPlaceholder = (label: string) => {
    const el: SlideElement = {
      id: newId(),
      type: 'text',
      x: 100,
      y: 180,
      width: 520,
      height: 44,
      content: `${label}`,
      fontSize: 16,
      fontWeight: 500,
      fontStyle: 'italic',
    };
    commitSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, elements: [...s.elements, el] } : s));
    setSelectedElement(el.id);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Opening presentation…</span>
      </div>
    );
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>;
  }

  const currentSlide = slides[activeSlide];

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-[#f3f3f3] dark:bg-[#1e1e1e] overflow-hidden">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

        {/* Ribbon */}
        <div className="bg-background border-b border-border">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Presentation className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold">{file.name}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={save}><Save className="w-4 h-4 mr-1" /> Save</Button>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 text-xs border-b border-border/50">
            {(['home', 'insert', 'design', 'transitions', 'animations', 'slideshow'] as const).map(tab => (
              <span key={tab} className={cn("px-3 py-1 rounded-t cursor-pointer capitalize", ribbonTab === tab ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50")} onClick={() => setRibbonTab(tab)}>
                {tab === 'slideshow' ? 'Slide Show' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 min-h-[40px]">
            {ribbonTab === 'home' && (
              <>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={undo}><Undo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={redo}><Redo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSelectedTextElement(el => ({ ...el, fontWeight: (el.fontWeight || 400) >= 600 ? 400 : 700 }))}><Bold className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSelectedTextElement(el => ({ ...el, fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' }))}><Italic className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSelectedTextElement(el => ({ ...el, textDecoration: el.textDecoration === 'underline' ? 'none' : 'underline' }))}><Underline className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSelectedTextElement(el => ({ ...el, textAlign: 'left' }))}><AlignLeft className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSelectedTextElement(el => ({ ...el, textAlign: 'center' }))}><AlignCenter className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSelectedTextElement(el => ({ ...el, textAlign: 'right' }))}><AlignRight className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={addTextBox}><Type className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Text Box</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleImageUpload}><Image className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Insert Image</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => insertPlaceholder('Shape')}><Square className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Shape</TooltipContent></Tooltip>
                </div>
              </>
            )}
            {ribbonTab === 'insert' && (
              <>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={addTextBox}><Type className="w-3.5 h-3.5" /> Text Box</Button></TooltipTrigger><TooltipContent>Insert Text Box</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleImageUpload}><Image className="w-3.5 h-3.5" /> Picture</Button></TooltipTrigger><TooltipContent>Insert Picture</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => insertPlaceholder('Video')}><Film className="w-3.5 h-3.5" /> Video</Button></TooltipTrigger><TooltipContent>Insert Video</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => insertPlaceholder('Shape')}><Square className="w-3.5 h-3.5" /> Shape</Button></TooltipTrigger><TooltipContent>Insert Shape</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => insertPlaceholder('Table')}><Table className="w-3.5 h-3.5" /> Table</Button></TooltipTrigger><TooltipContent>Insert Table</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => insertPlaceholder('Link')}><Link className="w-3.5 h-3.5" /> Link</Button></TooltipTrigger><TooltipContent>Insert Link</TooltipContent></Tooltip>
                </div>
              </>
            )}
            {ribbonTab === 'design' && (
              <>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setThemeTone(t => t === 'light' ? 'dark' : 'light')}><Palette className="w-3.5 h-3.5" /> Themes</Button></TooltipTrigger><TooltipContent>Slide Themes</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setSlideScale(s => s === 100 ? 90 : 100)}><SlidersHorizontal className="w-3.5 h-3.5" /> Variants</Button></TooltipTrigger><TooltipContent>Theme Variants</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setSlideScale(s => s === 100 ? 110 : 100)}><Maximize className="w-3.5 h-3.5" /> Slide Size</Button></TooltipTrigger><TooltipContent>Slide Size</TooltipContent></Tooltip>
                </div>
              </>
            )}
            {ribbonTab === 'transitions' && (
              <>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setTransitionType('none')}><RotateCcw className="w-3.5 h-3.5" /> None</Button></TooltipTrigger><TooltipContent>No Transition</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setTransitionType('fade')}><Wand2 className="w-3.5 h-3.5" /> Fade</Button></TooltipTrigger><TooltipContent>Fade</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setTransitionType('push')}><Zap className="w-3.5 h-3.5" /> Push</Button></TooltipTrigger><TooltipContent>Push</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Duration:</span>
                  <span className="text-xs">1.00s</span>
                </div>
              </>
            )}
            {ribbonTab === 'animations' && (
              <>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAnimationType('none')}><RotateCcw className="w-3.5 h-3.5" /> None</Button></TooltipTrigger><TooltipContent>No Animation</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAnimationType('appear')}><Wand2 className="w-3.5 h-3.5" /> Appear</Button></TooltipTrigger><TooltipContent>Appear</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAnimationType('fly')}><Zap className="w-3.5 h-3.5" /> Fly In</Button></TooltipTrigger><TooltipContent>Fly In</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setPreviewMode(v => !v)}><Eye className="w-3.5 h-3.5" /> Preview</Button></TooltipTrigger><TooltipContent>Preview</TooltipContent></Tooltip>
                </div>
              </>
            )}
            {ribbonTab === 'slideshow' && (
              <>
                <div className="flex items-center gap-0.5 pr-3 border-r border-border">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setActiveSlide(0)}><Play className="w-3.5 h-3.5" /> From Beginning</Button></TooltipTrigger><TooltipContent>Start from Beginning</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setPreviewMode(true)}><Play className="w-3.5 h-3.5" /> From Current</Button></TooltipTrigger><TooltipContent>Start from Current Slide</TooltipContent></Tooltip>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setPreviewMode(true)}><Timer className="w-3.5 h-3.5" /> Rehearse</Button></TooltipTrigger><TooltipContent>Rehearse Timings</TooltipContent></Tooltip>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Slide thumbnails panel */}
          <div className="w-48 border-r border-border bg-background flex flex-col">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Slides</span>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSlide}><Plus className="w-3 h-3" /></Button>
              </TooltipTrigger><TooltipContent>New Slide</TooltipContent></Tooltip>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {slides.map((slide, idx) => (
                  <div
                    key={idx}
                    className={cn("group relative cursor-pointer rounded border-2 transition-all", idx === activeSlide ? "border-primary shadow-sm" : "border-transparent hover:border-muted-foreground/30")}
                    onClick={() => { setActiveSlide(idx); setSelectedElement(null); setEditingElement(null); }}
                  >
                    <div className="absolute -left-0.5 top-0 text-[10px] text-muted-foreground font-mono">{idx + 1}</div>
                    <div className="ml-3 aspect-[16/9] bg-white dark:bg-[#2d2d2d] rounded-sm p-1 overflow-hidden relative">
                      {slide.elements.map(el => (
                        el.type === 'text' ? (
                          <p key={el.id} className="truncate text-[6px] text-muted-foreground" style={{ position: 'absolute', left: el.x * 0.19, top: el.y * 0.19, fontSize: (el.fontSize || 16) * 0.19, fontWeight: el.fontWeight }}>
                            {el.content || 'Text'}
                          </p>
                        ) : (
                          <img key={el.id} src={el.content} className="object-cover" style={{ position: 'absolute', left: el.x * 0.19, top: el.y * 0.19, width: el.width * 0.19, height: el.height * 0.19 }} alt="" />
                        )
                      ))}
                    </div>
                    <div className="absolute top-0 right-0 hidden group-hover:flex bg-background/90 rounded-bl border-l border-b border-border">
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }}><ChevronUp className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }}><ChevronDown className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); duplicateSlide(idx); }}><Copy className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); deleteSlide(idx); }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Slide canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[#e8e8e8] dark:bg-[#1a1a1a]">
              <div
                ref={canvasRef}
                className="relative bg-white dark:bg-[#2d2d2d] shadow-xl rounded-sm select-none"
                style={{ width: Math.round(720 * (slideScale / 100)), height: Math.round(405 * (slideScale / 100)), minWidth: Math.round(720 * (slideScale / 100)), background: themeTone === 'dark' ? '#1f2937' : undefined }}
                onClick={(e) => {
                  if (e.target === canvasRef.current) {
                    setSelectedElement(null);
                    setEditingElement(null);
                  }
                }}
              >
                {currentSlide?.elements.map(el => {
                  const isSelected = selectedElement === el.id;
                  const isEditing = editingElement === el.id;

                  return (
                    <div
                      key={el.id}
                      className={cn(
                        "absolute cursor-move group/el",
                        isSelected && "ring-2 ring-primary",
                        !isSelected && "hover:ring-1 hover:ring-muted-foreground/30"
                      )}
                      style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
                      onClick={(e) => { e.stopPropagation(); setSelectedElement(el.id); }}
                      onDoubleClick={() => { if (el.type === 'text') setEditingElement(el.id); }}
                      onMouseDown={(e) => {
                        if (isEditing) return;
                        e.preventDefault();
                        setSelectedElement(el.id);
                        setDragging({ id: el.id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y });
                      }}
                    >
                      {el.type === 'text' ? (
                        isEditing ? (
                          <textarea
                            className="w-full h-full bg-transparent outline-none resize-none p-1"
                            style={{ fontSize: el.fontSize, fontWeight: el.fontWeight, color: 'inherit' }}
                            value={el.content}
                            autoFocus
                            onChange={(e) => updateElementContent(el.id, e.target.value)}
                            onBlur={() => setEditingElement(null)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingElement(null); }}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="w-full h-full p-1 whitespace-pre-wrap overflow-hidden" style={{ fontSize: el.fontSize, fontWeight: el.fontWeight, fontStyle: el.fontStyle || 'normal', textDecoration: el.textDecoration || 'none', textAlign: el.textAlign || 'left' }}>
                            {el.content || <span className="text-muted-foreground/40 italic">Click to add text</span>}
                          </div>
                        )
                      ) : (
                        <img src={el.content} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                      )}

                      {/* Resize handle */}
                      {isSelected && (
                        <>
                          <div
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-sm cursor-se-resize"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setResizing({ id: el.id, startX: e.clientX, startY: e.clientY, elW: el.width, elH: el.height });
                            }}
                          />
                          {/* Delete button */}
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute -top-3 -right-3 h-5 w-5 rounded-full opacity-0 group-hover/el:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Properties bar when element selected */}
            {selectedElement && (() => {
              const el = currentSlide?.elements.find(e => e.id === selectedElement);
              if (!el) return null;
              return (
                <div className="px-3 py-1.5 border-t border-border bg-background flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground font-medium">{el.type === 'text' ? 'Text Box' : 'Image'}</span>
                  <span className="text-muted-foreground">X: {Math.round(el.x)}</span>
                  <span className="text-muted-foreground">Y: {Math.round(el.y)}</span>
                  <span className="text-muted-foreground">W: {Math.round(el.width)}</span>
                  <span className="text-muted-foreground">H: {Math.round(el.height)}</span>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => deleteElement(selectedElement)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-background border-t border-border text-xs text-muted-foreground">
          <span>Slide {activeSlide + 1} of {slides.length}</span>
          <span>{file.name} · {transitionType} / {animationType}{previewMode ? ' · preview' : ''}</span>
        </div>
      </div>
    </TooltipProvider>
  );
};
