import { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff, Cloud } from 'lucide-react';
import { isOnline, onOnlineStatusChange, getDirtyProjects } from '@/services/offlineStorage';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(isOnline());
  const [dirtyCount, setDirtyCount] = useState(0);

  useEffect(() => {
    const cleanup = onOnlineStatusChange(setOnline);
    const checkDirty = () => getDirtyProjects().then((p) => setDirtyCount(p.length));
    checkDirty();
    const interval = setInterval(checkDirty, 5000);
    const handleSync = () => checkDirty();
    window.addEventListener('offline-sync-complete', handleSync);
    return () => {
      cleanup();
      clearInterval(interval);
      window.removeEventListener('offline-sync-complete', handleSync);
    };
  }, []);

  if (online && dirtyCount === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 text-xs">
          {online ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-primary" />
              {dirtyCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {dirtyCount} pending
                </Badge>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-muted-foreground">Offline</span>
              {dirtyCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {dirtyCount} saved locally
                </Badge>
              )}
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {online
          ? dirtyCount > 0
            ? `${dirtyCount} project(s) syncing to your account…`
            : 'Connected'
          : `You're offline. Changes are saved locally and will sync when you reconnect.`}
      </TooltipContent>
    </Tooltip>
  );
};
