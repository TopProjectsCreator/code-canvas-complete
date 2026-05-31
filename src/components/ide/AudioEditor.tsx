import { useState, useRef, useEffect } from 'react';
import { FileNode } from '@/types/ide';
import {
  Music, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Gauge, Scissors, RotateCcw,
  Download, Info, Upload, Keyboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

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

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const samples = buffer.length;
  const dataSize = samples * numChannels * (bitDepth / 8);
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

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
  const [dragOver, setDragOver] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

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
    const ctx = audioCtxRef.current;
    if (!a) return;
    if (playing) { a.pause(); }
    else {
      if (ctx?.state === 'suspended') ctx.resume();
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

  const changeRate = (rate: string) => {
    const r = parseFloat(rate);
    if (!audioRef.current) return;
    audioRef.current.playbackRate = r;
    setPlaybackRate(r);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  };

  const exportTrimmed = async () => {
    if (!audioSrc || !duration) return;
    try {
      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(trimStart * sampleRate);
      const endSample = Math.floor(Math.min(trimEnd, duration) * sampleRate);
      const length = endSample - startSample;
      if (length <= 0) return;
      const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, length, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0, trimStart, trimEnd - trimStart);
      const rendered = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.\w+$/, '_trimmed.wav');
      a.click();
      URL.revokeObjectURL(url);
      audioCtx.close();
    } catch (err) {
      console.warn('Export failed:', err);
    }
  };

  const downloadOriginal = () => {
    const a = document.createElement('a');
    a.href = audioSrc;
    a.download = file.name;
    a.click();
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Web Audio API setup (one-time)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (!audioCtxRef.current) {
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioSrc]);

  // Real-time canvas waveform drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser || !audioSrc) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fill area under waveform
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.closePath();
      ctx.fillStyle = 'hsla(var(--primary), 0.15)';
      ctx.fill();

      // Stroke waveform line
      ctx.beginPath();
      x = 0;
      ctx.moveTo(0, canvas.height / 2);
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      observer.disconnect();
    };
  }, [audioSrc]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
        analyserRef.current = null;
      }
    };
  }, []);

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

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-white">{file.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={downloadOriginal}>
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
            </TooltipTrigger><TooltipContent>Download original</TooltipContent></Tooltip>
            {trimStart > 0 || trimEnd < duration ? (
              <Tooltip><TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10" onClick={exportTrimmed}>
                  <Scissors className="w-3.5 h-3.5" /> Export Trimmed
                </Button>
              </TooltipTrigger><TooltipContent>Export trimmed audio as WAV</TooltipContent></Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10">
                  <Keyboard className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Space</kbd> Play / Pause</p>
                  <p><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">←</kbd> Back 5s</p>
                  <p><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">→</kbd> Forward 5s</p>
                  <p><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">M</kbd> Toggle mute</p>
                </div>
              </TooltipContent>
            </Tooltip>
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

        {/* Timeline with canvas waveform */}
        <div className="bg-[#1a1a1a] border-t border-[#333]">
          <div
            ref={timelineRef}
            className="relative h-16 mx-3 mt-2 rounded overflow-hidden cursor-pointer group"
            onClick={handleTimelineClick}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />

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
              <Select value={String(playbackRate)} onValueChange={changeRate}>
                <SelectTrigger className="h-7 w-16 text-[11px] bg-transparent border-white/10 text-white/70 hover:bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['0.5', '0.75', '1', '1.25', '1.5', '2'].map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-xs">
                      {rate}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
