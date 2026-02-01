import { useState } from 'react';
import { 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Monitor, 
  Tablet,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewProps {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  isRunning: boolean;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

export const Preview = ({ htmlContent, cssContent, jsContent, isRunning }: PreviewProps) => {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile':
        return 'max-w-[375px]';
      case 'tablet':
        return 'max-w-[768px]';
      default:
        return 'w-full';
    }
  };

  const createPreviewDocument = () => {
    // Inject CSS and JS into the HTML
    let processedHtml = htmlContent;
    
    // Add CSS
    if (cssContent) {
      const styleTag = `<style>${cssContent}</style>`;
      if (processedHtml.includes('</head>')) {
        processedHtml = processedHtml.replace('</head>', `${styleTag}</head>`);
      } else {
        processedHtml = styleTag + processedHtml;
      }
    }
    
    // Add JS
    if (jsContent) {
      const scriptTag = `<script>${jsContent}</script>`;
      if (processedHtml.includes('</body>')) {
        processedHtml = processedHtml.replace('</body>', `${scriptTag}</body>`);
      } else {
        processedHtml = processedHtml + scriptTag;
      }
    }
    
    return processedHtml;
  };

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  const devices = [
    { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
    { id: 'tablet' as const, icon: Tablet, label: 'Tablet' },
    { id: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
  ];

  return (
    <div className={cn(
      'flex flex-col bg-background h-full',
      isFullscreen && 'fixed inset-0 z-50'
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Webview</span>
          <div className="flex items-center gap-1 ml-4">
            {devices.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setDevice(id)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  device === id
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* URL bar */}
      <div className="px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-input rounded-md">
          <span className="text-xs text-success">🔒</span>
          <span className="text-sm text-muted-foreground flex-1 truncate">
            https://my-repl.replit.app
          </span>
        </div>
      </div>

      {/* Preview frame */}
      <div className="flex-1 flex items-start justify-center p-4 bg-muted/50 overflow-auto">
        {isRunning ? (
          <div className={cn(
            'bg-white rounded-lg shadow-xl overflow-hidden transition-all h-full',
            getDeviceWidth()
          )}>
            <iframe
              key={key}
              srcDoc={createPreviewDocument()}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-modals"
              title="Preview"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">Click Run to see your app</p>
              <p className="text-sm">Press the green Run button to start your Repl</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
