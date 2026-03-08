import { useState, useRef, useCallback, useEffect } from 'react';
import { FileNode } from '@/types/ide';
import {
  Music, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Gauge, Scissors, RotateCcw,
  Download, Info, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AudioEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};

export const AudioEditor = ({ file, onContentChange }: AudioEditorProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
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
  const [showInfo, setShowInfo] = useState(false);
  const [audioSrc, setAudioSrc] = useState('');
  const [waveform, setWaveform] = useState<number[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Build audio source
  useEffect(() => {
    const content = file.content || '';
    if (!content.trim()) { setAudioSrc(''); return; }
    const isDataUrl = content.startsWith('data:');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
      flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
    };
    setAudioSrc(isDataUrl ? content : `data:${mimeTypes[ext || 'mp3'] || 'audio/mpeg'};base64,${content}`);
  }, [file.content, file.name]);

  // Generate waveform from audio
  const generateWaveform = useCallback(async () => {
    if (!audioSrc) return;
    try {
      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      const samples = 200;
      const blockSize = Math.floor(rawData.length / samples);
      const bars: number[] = [];
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        bars.push(sum / blockSize);
      }
      const max = Math.max(...bars, 0.01);
      setWaveform(bars.map(b => b / max));
      audioCtx.close();
    } catch {
      setWaveform([]);
    }
  }, [audioSrc]);

  useEffect(() => { generateWaveform(); }, [generateWaveform]);

  const handleLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    setDuration(a.duration);
    setTrimEnd(a.duration);
  };

  const handleTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    if (a.currentTime >= trimEnd) { a.pause(); setPlaying(false); }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); }
    else {
      if (a.currentTime < trimStart || a.currentTime >= trimEnd) a.currentTime = trimStart;
      a.play();
    }
    setPlaying(!playing);
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const skipBack = () => seek(Math.max(0, currentTime - 5));
  const skipForward = () => seek(Math.min(duration, currentTime + 5));

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !muted;
    setMuted(!muted);
  };

  const changeVolume = (val: number[]) => {
    if (!audioRef.current) return;
    const v = val[0];
    audioRef.current.volume = v;
    setVolume(v);
    if (v === 0) setMuted(true);
    else if (muted) { setMuted(false); audioRef.current.muted = false; }
  };

  const changeRate = (rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  };

  const loadAudioFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => onContentChange(file.id, reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/aac,.mp3,.wav,.ogg,.flac,.aac,.m4a';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) loadAudioFile(f);
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('audio/')) loadAudioFile(f);
  };

  const trimPct = duration > 0
    ? { start: (trimStart / duration) * 100, end: (trimEnd / duration) * 100 }
    : { start: 0, end: 100 };
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioSrc) {
    return (
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4 transition-colors",
          dragOver && "bg-primary/10 ring-2 ring-primary ring-inset"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Music className={cn("w-16 h-16 opacity-50 transition-transform", dragOver && "scale-110 opacity-80")} />
        <div className="text-center">
          <p className="text-lg font-medium mb-1">Audio Editor</p>
          <p className="text-sm">{file.name}</p>
          <p className="text-xs mt-2 text-muted-foreground/70">
            {dragOver ? 'Drop audio file here' : 'Drag & drop an audio file or click below'}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleFileUpload}>
          <Upload className="w-4 h-4" /> Upload Audio
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-[#111] overflow-hidden">
        <audio
          ref={audioRef}
          src={audioSrc}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-white">{file.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setShowInfo(!showInfo)}>
                <Info className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Audio Info</TooltipContent></Tooltip>
          </div>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div className="px-4 py-2 bg-[#1a1a1a] border-b border-[#333] text-xs text-white/60 flex gap-6 flex-wrap">
            <span>Duration: {formatTime(duration)}</span>
            <span>Format: {file.name.split('.').pop()?.toUpperCase()}</span>
            <span>Playback: {playbackRate}×</span>
            {trimStart > 0 || trimEnd < duration ? (
              <span className="text-primary">Trim: {formatTime(trimStart)} → {formatTime(trimEnd)}</span>
            ) : null}
          </div>
        )}

        {/* Waveform + Album art area */}
        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] min-h-0 overflow-hidden p-8">
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-white/10 shadow-lg">
              <Music className={cn("w-14 h-14 text-primary transition-transform", playing && "animate-pulse")} />
            </div>
            <p className="text-lg font-medium text-white">{file.name}</p>
          </div>
        </div>

        {/* Timeline with waveform */}
        <div className="bg-[#1a1a1a] border-t border-[#333]">
          <div
            ref={timelineRef}
            className="relative h-16 mx-3 mt-2 rounded overflow-hidden cursor-pointer group"
            onClick={handleTimelineClick}
          >
            {/* Waveform bars */}
            <div className="absolute inset-0 flex items-end gap-px">
              {waveform.length > 0 ? waveform.map((v, i) => {
                const pct = (i / waveform.length) * 100;
                const inTrim = pct >= trimPct.start && pct <= trimPct.end;
                const isPast = pct <= progressPct;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-colors"
                    style={{
                      height: `${Math.max(4, v * 100)}%`,
                      backgroundColor: isPast
                        ? 'hsl(var(--primary))'
                        : inTrim
                          ? 'rgba(255,255,255,0.3)'
                          : 'rgba(255,255,255,0.1)',
                    }}
                  />
                );
              }) : (
                <div className="w-full h-full bg-[#222] rounded" />
              )}
            </div>

            {/* Trim overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 h-full bg-black/50" style={{ width: `${trimPct.start}%` }} />
              <div className="absolute top-0 right-0 h-full bg-black/50" style={{ width: `${100 - trimPct.end}%` }} />
            </div>

            {/* Trim handles */}
            {[
              { pct: trimPct.start, setter: setTrimStart, startVal: trimStart, min: 0, max: trimEnd - 0.1 },
              { pct: trimPct.end, setter: setTrimEnd, startVal: trimEnd, min: trimStart + 0.1, max: duration },
            ].map((handle, idx) => (
              <div
                key={idx}
                className="absolute top-0 h-full w-1 bg-primary cursor-col-resize z-10 hover:w-1.5"
                style={{ left: `${handle.pct}%` }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startVal = handle.startVal;
                  const rect = timelineRef.current!.getBoundingClientRect();
                  const onMove = (ev: MouseEvent) => {
                    const delta = (ev.clientX - startX) / rect.width * duration;
                    handle.setter(Math.max(handle.min, Math.min(handle.max, startVal + delta)));
                  };
                  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
              />
            ))}

            {/* Playhead */}
            <div className="absolute top-0 h-full w-0.5 bg-white z-20 pointer-events-none" style={{ left: `${progressPct}%` }}>
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

            <Button size="icon" variant="ghost" className="h-10 w-10 text-white hover:bg-white/10 rounded-full" onClick={togglePlay}>
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
                <Scissors className="w-3.5 h-3.5" /> In
              </Button>
            </TooltipTrigger><TooltipContent>Set trim start</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => setTrimEnd(currentTime)}>
                <Scissors className="w-3.5 h-3.5" /> Out
              </Button>
            </TooltipTrigger><TooltipContent>Set trim end</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => { setTrimStart(0); setTrimEnd(duration); }}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </TooltipTrigger><TooltipContent>Reset trim</TooltipContent></Tooltip>

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

          {/* Right: volume */}
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
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
