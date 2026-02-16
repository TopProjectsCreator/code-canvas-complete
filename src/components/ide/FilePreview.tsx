import { FileNode } from '@/types/ide';
import { Image, FileText, Code2, AlertCircle, Video, Music, Table } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMemo } from 'react';

interface FilePreviewProps {
  file: FileNode;
  previewType: 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv';
}

// Parse CSV content into rows and columns
const parseCSV = (content: string): string[][] => {
  const lines = content.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
};

export const FilePreview = ({ file, previewType }: FilePreviewProps) => {
  const content = file.content || '';

  // Parse CSV data
  const csvData = useMemo(() => {
    if (previewType !== 'csv') return [];
    return parseCSV(content);
  }, [content, previewType]);

  if (previewType === 'image') {
    const isDataUrl = content.startsWith('data:');
    const isValidBase64 = isDataUrl || /^[A-Za-z0-9+/=\s]+$/.test(content.trim());
    const hasContent = content.trim().length > 0;
    const imageSrc = isDataUrl ? content : `data:image/${file.name.split('.').pop()};base64,${content}`;

    // Show placeholder if no content or content isn't valid image data
    if (!hasContent || !isValidBase64) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Image className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Image Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">
              {hasContent ? 'Image data cannot be previewed inline' : 'No image data available'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div className="relative max-w-full max-h-full">
            <img 
              src={imageSrc} 
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="w-12 h-12" />
              <p>Failed to load image</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Image Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'video') {
    const isDataUrl = content.startsWith('data:');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      ogv: 'video/ogg',
    };
    const videoSrc = isDataUrl ? content : `data:${mimeTypes[ext || 'mp4'] || 'video/mp4'};base64,${content}`;

    if (!content.trim()) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Video className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Video Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">No video data available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <video 
            src={videoSrc}
            controls
            className="max-w-full max-h-[70vh] rounded-lg shadow-lg border border-border"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Video Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'audio') {
    const isDataUrl = content.startsWith('data:');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      aac: 'audio/aac',
      m4a: 'audio/mp4',
    };
    const audioSrc = isDataUrl ? content : `data:${mimeTypes[ext || 'mp3'] || 'audio/mpeg'};base64,${content}`;

    if (!content.trim()) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Music className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Audio Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">No audio data available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-border">
            <Music className="w-16 h-16 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground">{file.name}</p>
          <audio 
            src={audioSrc}
            controls
            className="w-full max-w-md"
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Audio Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'csv') {
    if (!content.trim() || csvData.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Table className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">CSV Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">No data available</p>
          </div>
        </div>
      );
    }

    const headers = csvData[0] || [];
    const rows = csvData.slice(1);

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {headers.map((header, i) => (
                      <th key={i} className="px-4 py-3 text-left font-semibold text-foreground border-b border-border whitespace-nowrap">
                        {header || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                      {headers.map((_, colIndex) => (
                        <td key={colIndex} className="px-4 py-2 text-muted-foreground border-b border-border/50">
                          {row[colIndex] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {rows.length} rows × {headers.length} columns
            </p>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>CSV Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'svg') {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
          <div 
            className="max-w-full max-h-[70vh] p-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>SVG Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'markdown') {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium text-foreground mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="text-muted-foreground mb-4 leading-relaxed">{children}</p>,
                a: ({ href, children }) => <a href={href} className="text-primary hover:underline">{children}</a>,
                code: ({ className, children }) => {
                  const isInline = !className;
                  if (isInline) {
                    return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>;
                  }
                  return (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                      <code className="text-sm font-mono text-foreground">{children}</code>
                    </pre>
                  );
                },
                ul: ({ children }) => <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-muted-foreground mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">{children}</blockquote>,
                hr: () => <hr className="border-border my-6" />,
                table: ({ children }) => <table className="w-full border-collapse my-4">{children}</table>,
                th: ({ children }) => <th className="border border-border px-4 py-2 bg-muted text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Markdown Preview</span>
        </div>
      </div>
    );
  }

  return null;
};
