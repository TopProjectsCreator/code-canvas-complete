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
  placeholderType?: 'shape' | 'table' | 'link' | 'video';
  linkUrl?: string;
  tableRows?: string[][];
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
  color?: string;
}

interface SlideData {
  elements: SlideElement[];
  transition?: 'none' | 'fade' | 'push';
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
const toPptxColor = (value?: string) => (value || '#1A1A1A').replace('#', '').toUpperCase();
const normalizeImageDataForPptx = (value: string) => {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return value;
  return `${match[1]};base64,${match[2]}`;
};

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
  const [presenting, setPresenting] = useState(false);
  const [presentSlideIndex, setPresentSlideIndex] = useState(0);
  const [presentAnimating, setPresentAnimating] = useState(false);
  const lastSavedBytesRef = useRef<Uint8Array | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let bytes = decodeDataUrl(file.content || '');
        if (!bytes) {
          bytes = await buildNewPptx();
          lastSavedBytesRef.current = bytes;
      onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes));
        }
        lastSavedBytesRef.current = bytes;
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
                color: '#1A1A1A',
              });
            }
          }
          if (elements.length === 0) {
            elements.push(
              { id: newId(), type: 'text', x: 30, y: 30, width: 660, height: 60, content: 'Click to add title', fontSize: 28, fontWeight: 700, color: '#1A1A1A' },
              { id: newId(), type: 'text', x: 30, y: 120, width: 660, height: 50, content: 'Click to add subtitle', fontSize: 16, fontWeight: 400, color: '#1A1A1A' },
            );
          }
          parsed.push({ elements, transition: 'none' });
        }
        if (parsed.length === 0) {
          parsed.push({
            transition: 'none',
            elements: [
              { id: newId(), type: 'text', x: 30, y: 30, width: 660, height: 60, content: 'Click to add title', fontSize: 28, fontWeight: 700, color: '#1A1A1A' },
              { id: newId(), type: 'text', x: 30, y: 120, width: 660, height: 50, content: 'Click to add subtitle', fontSize: 16, fontWeight: 400, color: '#1A1A1A' },
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
        slide.background = { color: themeTone === 'dark' ? '1F2937' : 'FFFFFF' };
        const transition = slideData.transition || 'none';
        if (transition !== 'none') {
          (slide as unknown as { transition?: { type: string; duration: number } }).transition = {
            type: transition,
            duration: 1,
          };
        }

        slideData.elements.forEach((el) => {
          const x = toSlideX(el.x);
          const y = toSlideY(el.y);
          const w = toSlideW(el.width);
          const h = toSlideH(el.height);

          if (el.placeholderType === 'shape') {
            slide.addShape(pptx.ShapeType.rect, {
              x,
              y,
              w,
              h,
              fill: { color: 'E5E7EB', transparency: 25 },
              line: { color: '6B7280', pt: 1 },
              rectRadius: 0.04,
            });
            if (el.content) {
              slide.addText(el.content, {
                x,
                y: y + Math.max(0.05, h / 3),
                w,
                h: Math.max(0.2, h / 3),
                fontSize: Math.max(10, el.fontSize || 14),
                align: 'center',
                color: toPptxColor(el.color),
              });
            }
            return;
          }

          if (el.placeholderType === 'table' && el.tableRows?.length) {
            slide.addTable(el.tableRows.map((row: string[]) => row.map((cell) => ({ text: String(cell ?? '') }))), {
              x,
              y,
              w,
              h,
              border: { type: 'solid', color: '6B7280', pt: 1 },
              color: toPptxColor(el.color),
              fontSize: Math.max(10, el.fontSize || 12),
              valign: 'middle',
            });
            return;
          }

          if (el.type === 'image' && el.content?.startsWith('data:image/')) {
            try {
              slide.addImage({ data: normalizeImageDataForPptx(el.content), x, y, w, h });
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
            italic: el.fontStyle === 'italic',
            underline: el.textDecoration === 'underline' ? { style: 'sng' } : undefined,
            align: el.textAlign || 'left',
            valign: 'top',
            breakLine: true,
            color: toPptxColor(el.color),
            hyperlink: el.placeholderType === 'link' && el.linkUrl ? { url: el.linkUrl } : undefined,
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
      lastSavedBytesRef.current = bytes;
      onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save presentation');
    }
  }, [file.id, slides, onContentChange, themeTone]);

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
        transition: 'none' as const,
        elements: [
          { id: newId(), type: 'text' as const, x: 30, y: 30, width: 660, height: 60, content: 'Click to add title', fontSize: 28, fontWeight: 700, color: '#1A1A1A' },
          { id: newId(), type: 'text' as const, x: 30, y: 120, width: 660, height: 50, content: 'Click to add subtitle', fontSize: 16, fontWeight: 400, color: '#1A1A1A' },
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
    const el: SlideElement = { id: newId(), type: 'text', x: 100, y: 200, width: 400, height: 50, content: 'New text box', fontSize: 16, fontWeight: 400, color: '#1A1A1A' };
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
    const normalized = label.toLowerCase();
    const placeholderType: SlideElement['placeholderType'] =
      normalized === 'shape' ? 'shape'
        : normalized === 'table' ? 'table'
          : normalized === 'link' ? 'link'
            : normalized === 'video' ? 'video'
              : undefined;

    const linkUrl = (placeholderType === 'link' || placeholderType === 'video')
      ? prompt(`Enter ${label} URL:`)?.trim() || undefined
      : undefined;

    const baseContent = placeholderType === 'link'
      ? (linkUrl ? `Open link: ${linkUrl}` : 'Link')
      : placeholderType === 'video'
        ? (linkUrl ? `Play video: ${linkUrl}` : 'Video')
        : label;

    const el: SlideElement = {
      id: newId(),
      type: 'text',
      placeholderType,
      linkUrl,
      tableRows: placeholderType === 'table'
        ? [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Row 1', 'Value', 'Value'],
          ['Row 2', 'Value', 'Value'],
        ]
        : undefined,
      x: 100,
      y: 180,
      width: 520,
      height: 44,
      content: baseContent,
      fontSize: 16,
      fontWeight: 500,
      fontStyle: 'italic',
      color: '#1A1A1A',
    };
    commitSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, elements: [...s.elements, el] } : s));
    setSelectedElement(el.id);
  };



  const moveSelectedElementLayer = (direction: 'forward' | 'backward') => {
    if (!selectedElement) return;
    commitSlides(prev => prev.map((slide, idx) => {
      if (idx !== activeSlide) return slide;
      const elements = [...slide.elements];
      const currentIndex = elements.findIndex((entry) => entry.id === selectedElement);
      if (currentIndex < 0) return slide;
      const targetIndex = direction === 'forward'
        ? Math.min(elements.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
      if (targetIndex === currentIndex) return slide;
      const [entry] = elements.splice(currentIndex, 1);
      elements.splice(targetIndex, 0, entry);
      return { ...slide, elements };
    }));
  };

  const updateTableCell = (elId: string, rowIndex: number, colIndex: number, value: string) => {
    commitSlides(prev => prev.map((slide, idx) => (
      idx === activeSlide
        ? {
          ...slide,
          elements: slide.elements.map((el) => {
            if (el.id !== elId) return el;
            const tableRows = (el.tableRows && el.tableRows.length ? el.tableRows : [['']]).map((row) => [...row]);
            while (tableRows.length <= rowIndex) tableRows.push(new Array(tableRows[0]?.length || 1).fill(''));
            while ((tableRows[rowIndex]?.length || 0) <= colIndex) {
              tableRows.forEach((row) => row.push(''));
            }
            tableRows[rowIndex][colIndex] = value;
            return { ...el, tableRows };
          }),
        }
        : slide
    )));
  };

  const appendTableRow = (elId: string) => {
    commitSlides(prev => prev.map((slide, idx) => (
      idx === activeSlide
        ? {
          ...slide,
          elements: slide.elements.map((el) => {
            if (el.id !== elId) return el;
            const existing = (el.tableRows && el.tableRows.length ? el.tableRows : [['']]).map((row) => [...row]);
            const width = Math.max(1, ...existing.map((row) => row.length));
            existing.push(new Array(width).fill(''));
            return { ...el, tableRows: existing };
          }),
        }
        : slide
    )));
  };

  const appendTableColumn = (elId: string) => {
    commitSlides(prev => prev.map((slide, idx) => (
      idx === activeSlide
        ? {
          ...slide,
          elements: slide.elements.map((el) => {
            if (el.id !== elId) return el;
            const existing = (el.tableRows && el.tableRows.length ? el.tableRows : [['']]).map((row) => [...row]);
            existing.forEach((row) => row.push(''));
            return { ...el, tableRows: existing };
          }),
        }
        : slide
    )));
  };


  const setActiveSlideTransition = (value: 'none' | 'fade' | 'push') => {
    setTransitionType(value);
    commitSlides(prev => prev.map((slide, idx) => idx === activeSlide ? { ...slide, transition: value } : slide));
  };

  const exportPresentation = async () => {
    await save();
    const bytes = lastSavedBytesRef.current || decodeDataUrl(file.content || '');
    if (!bytes) return;
    const blob = new Blob([new Uint8Array(bytes).slice().buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.toLowerCase().endsWith('.pptx') ? file.name : `${file.name}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setTransitionType(slides[activeSlide]?.transition || 'none');
  }, [activeSlide, slides]);

  useEffect(() => {
    if (!presenting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresenting(false);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setPresentSlideIndex((idx) => Math.min(slides.length - 1, idx + 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPresentSlideIndex((idx) => Math.max(0, idx - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presenting, slides.length]);

  useEffect(() => {
    if (!presenting) return;
    setPresentAnimating(true);
    const timer = setTimeout(() => setPresentAnimating(false), 360);
    return () => clearTimeout(timer);
  }, [presenting, presentSlideIndex]);

  const startPresenting = (fromBeginning = false) => {
    setPresentSlideIndex(fromBeginning ? 0 : activeSlide);
    setPresenting(true);
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
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={save}><Save className="w-4 h-4 mr-1" /> Save</Button>
              <Button size="sm" variant="outline" onClick={exportPresentation}>Export .pptx</Button>
            </div>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="h-7 px-2 rounded hover:bg-muted/50 flex items-center cursor-pointer" title="Text Color">
                        <span className="text-[11px] mr-1">A</span>
                        <input
                          type="color"
                          className="h-4 w-4 border-0 p-0 bg-transparent cursor-pointer"
                          value={(currentSlide?.elements.find(e => e.id === selectedElement && e.type === 'text') as SlideElement | undefined)?.color || '#1A1A1A'}
                          onChange={(e) => updateSelectedTextElement(el => ({ ...el, color: e.target.value }))}
                        />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>Text Color</TooltipContent>
                  </Tooltip>
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
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setActiveSlideTransition('none')}><RotateCcw className="w-3.5 h-3.5" /> None</Button></TooltipTrigger><TooltipContent>No Transition</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setActiveSlideTransition('fade')}><Wand2 className="w-3.5 h-3.5" /> Fade</Button></TooltipTrigger><TooltipContent>Fade</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setActiveSlideTransition('push')}><Zap className="w-3.5 h-3.5" /> Push</Button></TooltipTrigger><TooltipContent>Push</TooltipContent></Tooltip>
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
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => startPresenting(true)}><Play className="w-3.5 h-3.5" /> From Beginning</Button></TooltipTrigger><TooltipContent>Start from Beginning</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => startPresenting(false)}><Play className="w-3.5 h-3.5" /> From Current</Button></TooltipTrigger><TooltipContent>Start from Current Slide</TooltipContent></Tooltip>
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
                            style={{ fontSize: el.fontSize, fontWeight: el.fontWeight, color: el.color || '#1A1A1A' }}
                            value={el.content}
                            autoFocus
                            onChange={(e) => updateElementContent(el.id, e.target.value)}
                            onBlur={() => setEditingElement(null)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingElement(null); }}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="w-full h-full p-1 whitespace-pre-wrap overflow-hidden" style={{ fontSize: el.fontSize, fontWeight: el.fontWeight, fontStyle: el.fontStyle || 'normal', textDecoration: el.textDecoration || 'none', textAlign: el.textAlign || 'left', color: el.color || '#1A1A1A' }}>
                            {el.placeholderType === 'table' && el.tableRows?.length ? (
                              <div className="h-full border border-dashed border-muted-foreground/50 rounded-sm p-1 text-[11px] leading-tight">
                                {el.tableRows.map((row, idx) => (
                                  <div key={idx} className="truncate">
                                    {row.join(' | ')}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              el.content || <span className="text-muted-foreground/40 italic">Click to add text</span>
                            )}
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
                  <span className="text-muted-foreground font-medium">
                    {el.type === 'image' ? 'Image' : (el.placeholderType ? `${el.placeholderType[0].toUpperCase()}${el.placeholderType.slice(1)}` : 'Text Box')}
                  </span>
                  <span className="text-muted-foreground">X: {Math.round(el.x)}</span>
                  <span className="text-muted-foreground">Y: {Math.round(el.y)}</span>
                  <span className="text-muted-foreground">W: {Math.round(el.width)}</span>
                  <span className="text-muted-foreground">H: {Math.round(el.height)}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => moveSelectedElementLayer('backward')}>
                      Send Back
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => moveSelectedElementLayer('forward')}>
                      Bring Front
                    </Button>
                  </div>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => deleteElement(selectedElement)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              );
            })()}

            {selectedElement && (() => {
              const el = currentSlide?.elements.find(e => e.id === selectedElement);
              if (!el || el.placeholderType !== 'table') return null;
              const tableRows = el.tableRows && el.tableRows.length ? el.tableRows : [['']];
              return (
                <div className="px-3 py-2 border-t border-border bg-background/95 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Table editor</p>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => appendTableColumn(el.id)}>+ Column</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => appendTableRow(el.id)}>+ Row</Button>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {tableRows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                              <td key={`${rowIndex}-${colIndex}`} className="border border-border p-0">
                                <input
                                  className="w-full bg-background px-2 py-1 outline-none"
                                  value={cell}
                                  onChange={(e) => updateTableCell(el.id, rowIndex, colIndex, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
      {presenting && (
        <div className="fixed inset-0 z-[100] bg-black text-white">
          <div
            className={cn(
              "w-full h-full flex items-center justify-center transition-all duration-300",
              presentAnimating && "opacity-0 scale-[0.985]"
            )}
          >
            <div
              className="relative bg-white text-black shadow-2xl overflow-hidden"
              style={{ width: 'min(92vw, 1280px)', aspectRatio: '16/9' }}
            >
              {(slides[presentSlideIndex]?.elements || []).map((el) => (
                <div
                  key={el.id}
                  className="absolute"
                  style={{
                    left: `${(el.x / CANVAS_W) * 100}%`,
                    top: `${(el.y / CANVAS_H) * 100}%`,
                    width: `${(el.width / CANVAS_W) * 100}%`,
                    height: `${(el.height / CANVAS_H) * 100}%`,
                    fontSize: `${(el.fontSize || 16) * (100 / 720)}vw`,
                    fontWeight: el.fontWeight,
                    fontStyle: el.fontStyle || 'normal',
                    textDecoration: el.textDecoration || 'none',
                    textAlign: el.textAlign || 'left',
                    color: el.color || '#1A1A1A',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {el.type === 'image' ? (
                    <img src={el.content} alt="" className="w-full h-full object-contain" />
                  ) : (
                    el.content
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/85 bg-black/50 px-3 py-1.5 rounded">
            {presentSlideIndex + 1} / {slides.length} · Esc to exit · ←/→ to navigate
          </div>
          <button
            className="absolute top-4 right-4 text-sm bg-white/15 hover:bg-white/25 px-3 py-1 rounded"
            onClick={() => setPresenting(false)}
          >
            Exit
          </button>
        </div>
      )}
    </TooltipProvider>
  );
};
