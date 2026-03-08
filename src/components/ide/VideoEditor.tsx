import { useState, useRef, useCallback, useEffect } from 'react';
import { FileNode } from '@/types/ide';
import {
  Video, Save, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize, Scissors, RotateCcw,
  Clock, Gauge, Minus, Plus, Upload, Download, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VideoEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};

export const VideoEditor = ({ file, onContentChange }: VideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; duration: number } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [videoSrc, setVideoSrc] = useState('');

  // Build video source URL
  useEffect(() => {
    const content = file.content || '';
    if (!content.trim()) {
      setVideoSrc('');
      return;
    }
    const isDataUrl = content.startsWith('data:');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg',
      mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    };
    setVideoSrc(isDataUrl ? content : `data:${mimeTypes[ext || 'mp4'] || 'video/mp4'};base64,${content}`);
  }, [file.content, file.name]);

  // Generate timeline thumbnails
  const generateThumbnails = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.duration || video.duration === Infinity) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const count = Math.min(20, Math.max(8, Math.floor(video.duration / 2)));
    const thumbs: string[] = [];
    canvas.width = 120;
    canvas.height = 68;

    for (let i = 0; i < count; i++) {
      const time = (video.duration / count) * i;
      video.currentTime = time;
      await new Promise<void>((resolve) => {
        const handler = () => { resolve(); video.removeEventListener('seeked', handler); };
        video.addEventListener('seeked', handler);
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
    }

    setThumbnails(thumbs);
    video.currentTime = 0;
  }, []);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration;
    setDuration(dur);
    setTrimEnd(dur);
    setVideoInfo({ width: v.videoWidth, height: v.videoHeight, duration: dur });
    generateThumbnails();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    // Auto-stop at trim end
    if (v.currentTime >= trimEnd) {
      v.pause();
      setPlaying(false);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      v.play();
    }
    setPlaying(!playing);
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const skipBack = () => seek(Math.max(0, currentTime - 5));
  const skipForward = () => seek(Math.min(duration, currentTime + 5));

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const changeVolume = (val: number[]) => {
    if (!videoRef.current) return;
    const v = val[0];
    videoRef.current.volume = v;
    setVolume(v);
    if (v === 0) setMuted(true);
    else if (muted) { setMuted(false); videoRef.current.muted = false; }
  };

  const changeRate = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const link = document.createElement('a');
    link.download = `${file.name}-frame-${formatTime(currentTime).replace(/[:.]/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const toggleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const trimPct = duration > 0 ? { start: (trimStart / duration) * 100, end: (trimEnd / duration) * 100 } : { start: 0, end: 100 };
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!videoSrc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
        <Video className="w-16 h-16 opacity-50" />
        <div className="text-center">
          <p className="text-lg font-medium mb-1">Video Editor</p>
          <p className="text-sm">{file.name}</p>
          <p className="text-xs mt-2 text-muted-foreground/70">No video data available</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-[#111] overflow-hidden">
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-white">{file.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setShowInfo(!showInfo)}>
                <Info className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Video Info</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={captureFrame}>
                <Download className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Capture Frame</TooltipContent></Tooltip>
          </div>
        </div>

        {/* Info panel */}
        {showInfo && videoInfo && (
          <div className="px-4 py-2 bg-[#1a1a1a] border-b border-[#333] text-xs text-white/60 flex gap-6 flex-wrap">
            <span>Resolution: {videoInfo.width}×{videoInfo.height}</span>
            <span>Duration: {formatTime(videoInfo.duration)}</span>
            <span>Format: {file.name.split('.').pop()?.toUpperCase()}</span>
            <span>Playback: {playbackRate}×</span>
            {trimStart > 0 || trimEnd < duration ? (
              <span className="text-primary">Trim: {formatTime(trimStart)} → {formatTime(trimEnd)}</span>
            ) : null}
          </div>
        )}

        {/* Video viewport */}
        <div className="flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden relative">
          <video
            ref={videoRef}
            src={videoSrc}
            className="max-w-full max-h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
            onClick={togglePlay}
            style={{ cursor: 'pointer' }}
          />
          {!playing && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-[#1a1a1a] border-t border-[#333]">
          {/* Thumbnail strip */}
          <div
            ref={timelineRef}
            className="relative h-14 mx-3 mt-2 rounded overflow-hidden cursor-pointer group"
            onClick={handleTimelineClick}
          >
            {/* Thumbnails background */}
            <div className="absolute inset-0 flex">
              {thumbnails.length > 0 ? thumbnails.map((thumb, i) => (
                <img key={i} src={thumb} alt="" className="h-full object-cover" style={{ width: `${100 / thumbnails.length}%` }} />
              )) : (
                <div className="w-full h-full bg-[#222]" />
              )}
            </div>

            {/* Trim overlay - dim outside regions */}
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 h-full bg-black/60" style={{ width: `${trimPct.start}%` }} />
              <div className="absolute top-0 right-0 h-full bg-black/60" style={{ width: `${100 - trimPct.end}%` }} />
            </div>

            {/* Trim handles */}
            <div
              className="absolute top-0 h-full w-1 bg-primary cursor-col-resize z-10 hover:w-1.5"
              style={{ left: `${trimPct.start}%` }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startVal = trimStart;
                const rect = timelineRef.current!.getBoundingClientRect();
                const onMove = (ev: MouseEvent) => {
                  const delta = (ev.clientX - startX) / rect.width * duration;
                  setTrimStart(Math.max(0, Math.min(trimEnd - 0.1, startVal + delta)));
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            />
            <div
              className="absolute top-0 h-full w-1 bg-primary cursor-col-resize z-10 hover:w-1.5"
              style={{ left: `${trimPct.end}%` }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startVal = trimEnd;
                const rect = timelineRef.current!.getBoundingClientRect();
                const onMove = (ev: MouseEvent) => {
                  const delta = (ev.clientX - startX) / rect.width * duration;
                  setTrimEnd(Math.min(duration, Math.max(trimStart + 0.1, startVal + delta)));
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            />

            {/* Playhead */}
            <div
              className="absolute top-0 h-full w-0.5 bg-white z-20 pointer-events-none"
              style={{ left: `${progressPct}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow" />
            </div>
          </div>

          {/* Time display */}
          <div className="flex items-center justify-between px-3 mt-1 text-[11px] text-white/50 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-t border-[#333]">
          {/* Left: playback */}
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={skipBack}>
                <SkipBack className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Back 5s</TooltipContent></Tooltip>

            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-white hover:bg-white/10 rounded-full"
              onClick={togglePlay}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={skipForward}>
                <SkipForward className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Forward 5s</TooltipContent></Tooltip>
          </div>

          {/* Center: trim + speed */}
          <div className="flex items-center gap-3">
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => setTrimStart(currentTime)}>
                <Scissors className="w-3.5 h-3.5" /> Set In
              </Button>
            </TooltipTrigger><TooltipContent>Set trim start to current time</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => setTrimEnd(currentTime)}>
                <Scissors className="w-3.5 h-3.5" /> Set Out
              </Button>
            </TooltipTrigger><TooltipContent>Set trim end to current time</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => { setTrimStart(0); setTrimEnd(duration); }}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </TooltipTrigger><TooltipContent>Reset trim points</TooltipContent></Tooltip>

            <div className="flex items-center gap-1 pl-2 border-l border-[#333]">
              <Gauge className="w-3.5 h-3.5 text-white/50" />
              {[0.5, 1, 1.5, 2].map(rate => (
                <Button
                  key={rate}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-6 px-1.5 text-[11px] hover:bg-white/10",
                    playbackRate === rate ? "text-primary bg-white/5" : "text-white/50"
                  )}
                  onClick={() => changeRate(rate)}
                >
                  {rate}×
                </Button>
              ))}
            </div>
          </div>

          {/* Right: volume + fullscreen */}
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={changeVolume}
              className="w-20"
            />
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={toggleFullscreen}>
                <Maximize className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Fullscreen</TooltipContent></Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
