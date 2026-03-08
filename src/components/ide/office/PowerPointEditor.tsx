import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { FileNode } from '@/types/ide';
import {
  Presentation, Save, Plus, Trash2, Copy, ChevronUp, ChevronDown,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Type, Square, Circle, Image, Play, Undo, Redo, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { decodeDataUrl, encodeDataUrl, parseXml, xmlEncode, buildNewPptx } from './officeUtils';

interface SlideData {
  texts: string[];
}

interface PowerPointEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

export const PowerPointEditor = ({ file, onContentChange }: PowerPointEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [editingText, setEditingText] = useState<number | null>(null);

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
          const texts: string[] = [];
          for (const sp of spNodes) {
            const tNodes = Array.from(sp.getElementsByTagNameNS('*', 't'));
            const text = tNodes.map(n => n.textContent || '').join('');
            if (text) texts.push(text);
          }
          if (texts.length === 0) texts.push('');
          parsed.push({ texts });
        }
        if (parsed.length === 0) parsed.push({ texts: ['Click to add title', 'Click to add subtitle'] });
        setSlides(parsed);
        setActiveSlide(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open presentation');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [file.id, file.content, onContentChange]);

  const save = useCallback(async () => {
    const bytes = decodeDataUrl(file.content || '') || (await buildNewPptx());
    const zip = await JSZip.loadAsync(bytes);

    // Update content types and presentation rels for all slides
    const slideCount = slides.length;
    const overrides = slides.map((_, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    ).join('');
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${overrides}
</Types>`);

    const sldIdLst = slides.map((_, i) =>
      `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`
    ).join('');
    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${sldIdLst}</p:sldIdLst></p:presentation>`);

    const rels = slides.map((_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    ).join('');
    zip.folder('ppt')?.folder('_rels')?.file('presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);

    // Remove old slides
    const existingSlides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n));
    for (const f of existingSlides) zip.remove(f);

    slides.forEach((slide, idx) => {
      const shapes = slide.texts.map((text, ti) => {
        const y = ti === 0 ? 274638 : 1600200 + (ti - 1) * 600000;
        const fontSize = ti === 0 ? 4400 : 2400;
        const lines = text.split('\n').map(line =>
          `<a:p><a:r><a:rPr lang="en-US" sz="${fontSize}" dirty="0"/><a:t>${xmlEncode(line)}</a:t></a:r></a:p>`
        ).join('');
        return `<p:sp>
          <p:nvSpPr><p:cNvPr id="${ti + 2}" name="TextBox ${ti + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
          <p:spPr><a:xfrm><a:off x="457200" y="${y}"/><a:ext cx="8229600" cy="857250"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
          <p:txBody><a:bodyPr/><a:lstStyle/>${lines || '<a:p><a:endParaRPr lang="en-US"/></a:p>'}</p:txBody>
        </p:sp>`;
      }).join('');

      zip.file(`ppt/slides/slide${idx + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    ${shapes}
  </p:spTree></p:cSld>
</p:sld>`);
    });

    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', out));
  }, [file, slides, onContentChange]);

  const addSlide = () => {
    const newSlides = [...slides, { texts: ['Click to add title', 'Click to add subtitle'] }];
    setSlides(newSlides);
    setActiveSlide(newSlides.length - 1);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== idx);
    setSlides(newSlides);
    setActiveSlide(Math.min(activeSlide, newSlides.length - 1));
  };

  const duplicateSlide = (idx: number) => {
    const newSlides = [...slides];
    newSlides.splice(idx + 1, 0, { texts: [...slides[idx].texts] });
    setSlides(newSlides);
    setActiveSlide(idx + 1);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= slides.length) return;
    const newSlides = [...slides];
    [newSlides[idx], newSlides[newIdx]] = [newSlides[newIdx], newSlides[idx]];
    setSlides(newSlides);
    setActiveSlide(newIdx);
  };

  const updateText = (slideIdx: number, textIdx: number, value: string) => {
    setSlides(prev => prev.map((s, i) =>
      i === slideIdx ? { ...s, texts: s.texts.map((t, ti) => ti === textIdx ? value : t) } : s
    ));
  };

  const addTextBox = () => {
    setSlides(prev => prev.map((s, i) =>
      i === activeSlide ? { ...s, texts: [...s.texts, 'New text box'] } : s
    ));
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
        {/* Ribbon / Toolbar */}
        <div className="bg-background border-b border-border">
          {/* Title bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Presentation className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold">{file.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={save}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          </div>

          {/* Ribbon tabs */}
          <div className="flex items-center gap-1 px-2 py-0.5 text-xs border-b border-border/50">
            <span className="px-3 py-1 rounded-t bg-muted font-medium">Home</span>
            <span className="px-3 py-1 text-muted-foreground hover:bg-muted/50 rounded-t cursor-pointer">Insert</span>
            <span className="px-3 py-1 text-muted-foreground hover:bg-muted/50 rounded-t cursor-pointer">Design</span>
            <span className="px-3 py-1 text-muted-foreground hover:bg-muted/50 rounded-t cursor-pointer">Transitions</span>
            <span className="px-3 py-1 text-muted-foreground hover:bg-muted/50 rounded-t cursor-pointer">Animations</span>
            <span className="px-3 py-1 text-muted-foreground hover:bg-muted/50 rounded-t cursor-pointer">Slide Show</span>
          </div>

          {/* Ribbon content */}
          <div className="flex items-center gap-1 px-3 py-1.5">
            {/* Clipboard group */}
            <div className="flex items-center gap-0.5 pr-3 border-r border-border">
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Undo className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Redo className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
            </div>

            {/* Font group */}
            <div className="flex items-center gap-0.5 pr-3 border-r border-border">
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Bold className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Italic className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Underline className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
            </div>

            {/* Paragraph group */}
            <div className="flex items-center gap-0.5 pr-3 border-r border-border">
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><AlignLeft className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><AlignCenter className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><AlignRight className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
            </div>

            {/* Insert group */}
            <div className="flex items-center gap-0.5 pr-3 border-r border-border">
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={addTextBox}><Type className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Text Box</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Square className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Shape</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Image className="w-3.5 h-3.5" /></Button>
              </TooltipTrigger><TooltipContent>Image</TooltipContent></Tooltip>
            </div>

            {/* Slide Show */}
            <div className="flex items-center gap-0.5">
              <Tooltip><TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Play className="w-3.5 h-3.5" /> Present</Button>
              </TooltipTrigger><TooltipContent>Start Presentation</TooltipContent></Tooltip>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Slide thumbnails panel */}
          <div className="w-48 border-r border-border bg-background flex flex-col">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Slides</span>
              <div className="flex gap-0.5">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSlide}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </TooltipTrigger><TooltipContent>New Slide</TooltipContent></Tooltip>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {slides.map((slide, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "group relative cursor-pointer rounded border-2 transition-all",
                      idx === activeSlide
                        ? "border-primary shadow-sm"
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                    onClick={() => setActiveSlide(idx)}
                  >
                    {/* Slide number */}
                    <div className="absolute -left-0.5 top-0 text-[10px] text-muted-foreground font-mono">
                      {idx + 1}
                    </div>
                    {/* Thumbnail */}
                    <div className="ml-3 aspect-[16/9] bg-white dark:bg-[#2d2d2d] rounded-sm p-2 overflow-hidden">
                      {slide.texts.map((text, ti) => (
                        <p
                          key={ti}
                          className={cn(
                            "truncate",
                            ti === 0
                              ? "text-[8px] font-bold text-foreground/80"
                              : "text-[6px] text-muted-foreground"
                          )}
                        >
                          {text || (ti === 0 ? 'Title' : 'Content')}
                        </p>
                      ))}
                    </div>
                    {/* Actions on hover */}
                    <div className="absolute top-0 right-0 hidden group-hover:flex bg-background/90 rounded-bl border-l border-b border-border">
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); duplicateSlide(idx); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); deleteSlide(idx); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Slide canvas */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[#e8e8e8] dark:bg-[#1a1a1a]">
            <div
              className="relative bg-white dark:bg-[#2d2d2d] shadow-xl rounded-sm"
              style={{ width: 720, height: 405, minWidth: 720 }}
            >
              {currentSlide?.texts.map((text, ti) => (
                <div
                  key={ti}
                  className={cn(
                    "absolute left-8 right-8 cursor-text rounded transition-all",
                    ti === 0 ? "top-8" : `top-[${100 + (ti - 1) * 60}px]`,
                    editingText === ti
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:ring-1 hover:ring-muted-foreground/30"
                  )}
                  style={{ top: ti === 0 ? 32 : 100 + (ti - 1) * 70 }}
                  onClick={() => setEditingText(ti)}
                >
                  {editingText === ti ? (
                    <textarea
                      className="w-full bg-transparent outline-none resize-none p-2"
                      style={{
                        fontSize: ti === 0 ? 28 : 16,
                        fontWeight: ti === 0 ? 700 : 400,
                        minHeight: ti === 0 ? 40 : 30,
                        color: 'inherit',
                      }}
                      value={text}
                      autoFocus
                      onChange={(e) => updateText(activeSlide, ti, e.target.value)}
                      onBlur={() => setEditingText(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingText(null);
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        "p-2 whitespace-pre-wrap",
                        !text && "text-muted-foreground/40 italic"
                      )}
                      style={{
                        fontSize: ti === 0 ? 28 : 16,
                        fontWeight: ti === 0 ? 700 : 400,
                      }}
                    >
                      {text || (ti === 0 ? 'Click to add title' : 'Click to add text')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-background border-t border-border text-xs text-muted-foreground">
          <span>Slide {activeSlide + 1} of {slides.length}</span>
          <span>{file.name}</span>
        </div>
      </div>
    </TooltipProvider>
  );
};
