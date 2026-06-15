import { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  FileText, Loader2, Maximize, Minimize, Download,
  PanelLeftClose, PanelLeft,
  Search, X, ChevronUp, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { decodeDataUrl } from './office/officeUtils';

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

interface PDFEditorProps {
  file: FileNode;
}

interface SearchMatch {
  page: number;
  itemIndex: number;
}

export const PDFEditor = ({ file }: PDFEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [computedZoom, setComputedZoom] = useState(100);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'none'>('width');
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      pdfDocRef.current = null;
      try {
        const bytes = decodeDataUrl(file.content || '');
        if (!bytes) throw new Error('Could not decode PDF data');
        const pdf = await getDocument({ data: bytes }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setPageInputValue('1');
        const thumbs: string[] = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
          const page = await pdf.getPage(i);
          const scale = 0.3;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await (page.render as any)({ canvasContext: ctx, viewport }).promise;
            thumbs.push(canvas.toDataURL());
          }
        }
        if (!cancelled) setThumbnails(thumbs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [file.content, file.id]);

  const renderCurrentPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    if (!pdf || !canvas) return;

    try {
      const page = await pdf.getPage(currentPage);
      const context = canvas.getContext('2d');
      if (!context) return;

      const container = containerRef.current;
      let scale = zoom / 100;

      if (fitMode === 'width' && container) {
        const pageViewport = page.getViewport({ scale: 1 });
        scale = (container.clientWidth - 48) / pageViewport.width;
      }

      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      setComputedZoom(Math.round(scale * 100));
      await (page.render as any)({ canvasContext: context, viewport }).promise;

      if (textLayer) {
        const textContent = await page.getTextContent();
        textLayer.innerHTML = '';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        const currentMatchData = currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length
          ? searchMatches[currentMatchIndex]
          : null;

        textContent.items.forEach((item: any, idx: number) => {
          const tx = pdfjsPageToPixel(item.transform, viewport);
          const el = document.createElement('span');
          el.textContent = item.str;
          el.style.left = `${tx[4]}px`;
          el.style.top = `${tx[5]}px`;
          el.style.fontSize = `${tx[0] * scale}px`;
          el.style.fontFamily = 'sans-serif';
          el.style.position = 'absolute';
          el.style.color = 'transparent';
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'text';
          el.style.whiteSpace = 'pre';

          if (searchQuery && item.str.toLowerCase().includes(searchQuery.toLowerCase())) {
            const isCurrent = currentMatchData && currentMatchData.page === currentPage && currentMatchData.itemIndex === idx;
            el.style.backgroundColor = isCurrent ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 0, 0.3)';
            el.style.borderRadius = '2px';
            if (isCurrent) {
              el.dataset.currentMatch = 'true';
            }
          }

          textLayer.appendChild(el);
        });

        if (currentMatchData && currentMatchData.page === currentPage) {
          const matchEl = textLayer.querySelector('[data-current-match="true"]') as HTMLElement;
          if (matchEl) {
            setTimeout(() => {
              matchEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 50);
          }
        }
      }
    } catch (err) {
      console.warn('PDF render error:', err);
    }
  }, [currentPage, zoom, fitMode, searchQuery, currentMatchIndex, searchMatches]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  useEffect(() => {
    if (fitMode === 'none') return;
    const onResize = () => { renderCurrentPage(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitMode, renderCurrentPage]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    let cancelled = false;
    const pdf = pdfDocRef.current;
    if (!pdf) return;

    const q = searchQuery.toLowerCase();
    const matches: SearchMatch[] = [];

    const doSearch = async () => {
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        textContent.items.forEach((item: any, idx: number) => {
          if (item.str.toLowerCase().includes(q)) {
            matches.push({ page: p, itemIndex: idx });
          }
        });
      }
      if (!cancelled) {
        setSearchMatches(matches);
        setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
      }
    };

    doSearch();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, numPages));
    setCurrentPage(p);
    setPageInputValue(String(p));
  }, [numPages]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const p = parseInt(pageInputValue, 10);
      if (!isNaN(p)) goToPage(p);
    }
  };

  const navigateMatch = useCallback((direction: 'prev' | 'next') => {
    if (searchMatches.length === 0) return;
    let nextIdx = direction === 'next' ? currentMatchIndex + 1 : currentMatchIndex - 1;
    if (nextIdx < 0) nextIdx = searchMatches.length - 1;
    if (nextIdx >= searchMatches.length) nextIdx = 0;
    setCurrentMatchIndex(nextIdx);
    goToPage(searchMatches[nextIdx].page);
  }, [searchMatches, currentMatchIndex, goToPage]);

  const zoomIn = () => setZoom((z) => Math.min(z + 10, 300));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 25));
  const toggleFitMode = () => {
    setFitMode((m) => (m === 'width' ? 'none' : 'width'));
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = file.content || '';
    a.download = file.name;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-editor">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading PDF…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-editor">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FileText className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-editor">
      {showThumbnails && thumbnails.length > 0 && (
        <div className="w-48 border-r border-border flex flex-col bg-background shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Pages</span>
            <button onClick={() => setShowThumbnails(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {thumbnails.map((dataUrl, i) => {
              const pageNum = i + 1;
              const matchCount = searchQuery ? searchMatches.filter(m => m.page === pageNum).length : 0;
              return (
                <button
                  key={i}
                  onClick={() => goToPage(pageNum)}
                  className={cn(
                    'w-full rounded border overflow-hidden transition-colors relative',
                    currentPage === pageNum ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <img src={dataUrl} alt={`Page ${pageNum}`} className="w-full h-auto" />
                  {matchCount > 0 && (
                    <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[10px] font-medium min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none shadow-sm">
                      {matchCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 shrink-0">
          {!showThumbnails && thumbnails.length > 0 && (
            <button onClick={() => setShowThumbnails(true)} className="p-1 text-muted-foreground hover:text-foreground mr-1">
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="relative flex-1 max-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="h-7 pl-7 pr-7 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {searchQuery && searchMatches.length > 0 && (
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {currentMatchIndex + 1}/{searchMatches.length}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMatch('prev')} disabled={searchMatches.length <= 1}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous match</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMatch('next')} disabled={searchMatches.length <= 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next match</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {searchQuery && searchMatches.length === 0 && (
            <span className="text-xs text-muted-foreground">No matches</span>
          )}

          <div className="mx-2 h-5 w-px bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous page</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-1">
            <Input
              className="h-7 w-12 text-center text-xs"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
            />
            <span className="text-xs text-muted-foreground">/ {numPages}</span>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next page</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="mx-2 h-5 w-px bg-border" />

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoom <= 25}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="w-14 text-center text-xs tabular-nums text-muted-foreground">{fitMode === 'width' ? computedZoom : zoom}%</span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoom >= 300}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', fitMode === 'width' && 'text-primary')}
                    onClick={toggleFitMode}
                  >
                    {fitMode === 'width' ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{fitMode === 'width' ? 'Fit to width' : 'Actual size'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="ml-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div ref={containerRef} className="flex flex-1 items-start justify-center overflow-auto bg-editor p-6">
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="shadow-xl rounded-sm" />
            <div ref={textLayerRef} className="absolute top-0 left-0 pointer-events-none" style={{ mixBlendMode: 'multiply' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

function pdfjsPageToPixel(transform: number[], viewport: any): number[] {
  const [a, b, c, d, e, f] = transform;
  return [a * viewport.scale, b * viewport.scale, c * viewport.scale, d * viewport.scale, e * viewport.scale, (viewport.height - f) * viewport.scale];
}
