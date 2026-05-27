import { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  FileText, Loader2, Maximize, Minimize, Download,
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
  onContentChange: (fileId: string, content: string) => void;
}

export const PDFEditor = ({ file, onContentChange }: PDFEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [computedZoom, setComputedZoom] = useState(100);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'none'>('width');
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (err) {
      console.warn('PDF render error:', err);
    }
  }, [currentPage, zoom, fitMode]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  useEffect(() => {
    if (fitMode === 'none') return;
    const onResize = () => { renderCurrentPage(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitMode]);

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
    <div className="flex flex-1 flex-col bg-editor">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
        <div className="flex items-center gap-1">
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
        </div>

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
        <canvas ref={canvasRef} className="shadow-xl rounded-sm" />
      </div>
    </div>
  );
};
