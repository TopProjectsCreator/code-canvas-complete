import { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import {
  ChevronLeft, ChevronRight, FileText, Loader2,
  BookOpen, Download, Sun, Moon, Search, X,
  List, Minus, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';
import { Book, Rendition } from 'epubjs';
import { decodeDataUrl } from './office/officeUtils';

interface EpubViewerProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

const DEFAULT_FONT_SIZE = 100;
const THEME_STORAGE_KEY = 'epub-viewer-theme';

export const EpubViewer = ({ file, onContentChange }: EpubViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  });
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [totalLocations, setTotalLocations] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const initEpub = async () => {
      setLoading(true);
      setError(null);
      try {
        const bytes = decodeDataUrl(file.content || '');
        if (!bytes) throw new Error('Could not decode EPUB data');

        const zip = await JSZip.loadAsync(bytes);
        const files = new Map<string, { data: ArrayBuffer; type: string }>();

        const entries = Object.entries(zip.files);
        for (const [path, entry] of entries) {
          if (!entry.dir) {
            const arrBuf = await entry.async('arraybuffer');
            const ext = path.split('.').pop()?.toLowerCase() || '';
            const mimeMap: Record<string, string> = {
              html: 'text/html', xhtml: 'application/xhtml+xml',
              xml: 'application/xml', opf: 'application/oebps-package+xml',
              ncx: 'application/x-dtbncx+xml', css: 'text/css',
              png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
              gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
              woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
              otf: 'font/otf', mp4: 'video/mp4', webm: 'video/webm',
              mp3: 'audio/mpeg', ogg: 'audio/ogg', js: 'application/javascript',
            };
            files.set(path, {
              data: arrBuf,
              type: mimeMap[ext] || 'application/octet-stream'
            });
          }
        }

        const containerXmlEntry = zip.file('META-INF/container.xml');
        if (!containerXmlEntry) throw new Error('Invalid EPUB: missing META-INF/container.xml');
        const containerText = await containerXmlEntry.async('text');
        const containerDoc = new DOMParser().parseFromString(containerText, 'application/xml');
        const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
        if (!opfPath) throw new Error('Invalid EPUB: cannot find OPF path');

        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1) || '';

        const opfEntry = zip.file(opfPath);
        if (!opfEntry) throw new Error('Invalid EPUB: OPF file not found');

        const book = new Book();
        bookRef.current = book;

        const isXmlType = (ext: string) => ['xml', 'opf', 'ncx'].includes(ext);
        const getExt = (url: string) => url.split('.').pop()?.toLowerCase() || '';
        const parseXml = (text: string, mime: string) => {
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          return new DOMParser().parseFromString(text, mime);
        };

        book.request = async (url: string, type: string) => {
          let normalizedUrl = url;
          try {
            normalizedUrl = new URL(url).pathname.replace(/^\//, '');
          } catch {}
          const relPath = normalizedUrl.startsWith(opfDir) ? normalizedUrl.slice(opfDir.length) : normalizedUrl;
          const fileKey = files.has(relPath) ? relPath : files.has(normalizedUrl) ? normalizedUrl : null;

          if (!fileKey) throw new Error(`Resource not found: ${url}`);
          const entry = files.get(fileKey)!;
          const ext = type || getExt(fileKey);

          if (isXmlType(ext) || ext === 'xhtml' || ext === 'html' || ext === 'htm') {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(entry.data);
            const mimeMap: Record<string, string> = {
              xml: 'application/xml', opf: 'application/xml',
              ncx: 'application/xml', xhtml: 'application/xhtml+xml',
              html: 'text/html', htm: 'text/html',
            };
            return parseXml(text, mimeMap[ext] || 'text/html');
          }

          return entry.data;
        };

        book.url = opfDir;
        await book.open(opfPath, 'opf');

        setToc(buildToc(book.toc));

        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        const rendition = new Rendition(book, {
          flow: 'paginated',
          width,
          height,
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;

        rendition.attachTo(container);

        rendition.display();

        rendition.on('relocated', (loc: any) => {
          if (loc && loc.start) {
            setCurrentLocation(loc.start.cfi || '');
            setTotalLocations(loc.end?.displayed?.total || 0);
          }
        });

        if (isDark) {
          applyTheme(rendition, true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load EPUB');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initEpub();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [file.content, file.id]);

  const cleanup = useCallback(() => {
    if (renditionRef.current) {
      try { renditionRef.current.destroy(); } catch {}
      renditionRef.current = null;
    }
    bookRef.current = null;
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
  }, []);

  const applyTheme = (rendition: Rendition, dark: boolean) => {
    if (!rendition || !rendition.themes) return;
    if (dark) {
      rendition.themes.register('dark', {
        body: {
          background: '#1a1a2e',
          color: '#e0e0e0',
        },
      });
      rendition.themes.select('dark');
    } else {
      rendition.themes.select('default');
    }
  };

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      if (renditionRef.current) {
        applyTheme(renditionRef.current, next);
      }
      return next;
    });
  }, []);

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.max(60, Math.min(200, prev + delta));
      if (renditionRef.current && renditionRef.current.themes) {
        renditionRef.current.themes.fontSize(`${next}%`);
      }
      return next;
    });
  }, []);

  const handlePrev = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  const handleNext = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const handleTocClick = useCallback((href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  }, []);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = file.content || '';
    a.download = file.name;
    a.click();
  }, [file]);

  const handleSearch = useCallback((query: string) => {
    if (!renditionRef.current || !query.trim()) return;
    renditionRef.current.display(`/search?q=${encodeURIComponent(query)}`);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (renditionRef.current && width > 0 && height > 0) {
          renditionRef.current.resize(width, height);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-editor">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading EPUB…</p>
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
      {showToc && toc.length > 0 && (
        <div className="w-64 border-r border-border flex flex-col bg-background shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Contents</span>
            <button onClick={() => setShowToc(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            {toc.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => handleTocClick(item.href)}
                  className="w-full text-left rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
                >
                  {item.label}
                </button>
                {item.subitems?.map((sub, j) => (
                  <button
                    key={`${i}-${j}`}
                    onClick={() => handleTocClick(sub.href)}
                    className="w-full text-left rounded pl-6 pr-2 py-1 text-xs hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 shrink-0">
          {toc.length > 0 && (
            <button
              onClick={() => setShowToc((v) => !v)}
              className={cn('p-1 rounded hover:bg-muted', showToc && 'text-primary')}
            >
              <List className="w-4 h-4" />
            </button>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous page</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next page</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="mx-1 h-5 w-px bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFontSizeChange(-10)}>
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Decrease font size</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-xs tabular-nums text-muted-foreground w-8 text-center">{fontSize}%</span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFontSizeChange(10)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Increase font size</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="mx-1 h-5 w-px bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleTheme}>
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="ml-auto flex items-center gap-2">
            {totalLocations > 0 && (
              <span className="text-xs text-muted-foreground">
                {currentLocation ? `${totalLocations} pages` : ''}
              </span>
            )}
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

        <div ref={containerRef} className="flex-1 overflow-hidden bg-editor" />
      </div>
    </div>
  );
};

function buildToc(navItems: any[]): TocItem[] {
  if (!navItems || !Array.isArray(navItems)) return [];
  return navItems.map((item: any) => ({
    label: item.label || '',
    href: item.href || '',
    subitems: item.children ? buildToc(item.children) : undefined,
  }));
}
