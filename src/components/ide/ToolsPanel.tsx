import { useEffect, useMemo, useState } from 'react';
import { Calculator, Palette, Link2, QrCode, ScanLine, CheckSquare2, Copy, Trash2, Plus, RefreshCw, Download } from 'lucide-react';

type HabitLog = Record<string, boolean>;

interface Habit {
  id: string;
  name: string;
  color: string;
  goalPerWeek: number;
  createdAt: string;
  logs: HabitLog;
}

interface ShortLink {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
}

const TOOL_STORAGE_KEYS = {
  habits: 'ide-tools-habits-v1',
  links: 'ide-tools-links-v1',
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const base62Chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const toBase62 = (num: number) => {
  if (num === 0) return '0';
  let n = Math.abs(num);
  let out = '';
  while (n > 0) {
    out = base62Chars[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out;
};

const getStreak = (logs: HabitLog) => {
  let streak = 0;
  const date = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = date.toISOString().slice(0, 10);
    if (!logs[key]) break;
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
};

const getLast7DaysProgress = (logs: HabitLog) => {
  let done = 0;
  const date = new Date();
  for (let i = 0; i < 7; i += 1) {
    const key = date.toISOString().slice(0, 10);
    if (logs[key]) done += 1;
    date.setDate(date.getDate() - 1);
  }
  return done;
};

export const ToolsPanel = () => {
  const [activeSection, setActiveSection] = useState<'calculator' | 'css' | 'habit' | 'shortener' | 'qr' | 'converter'>('calculator');

  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState<string>('0');

  const [hex, setHex] = useState('#6366f1');
  const [savedColors, setSavedColors] = useState<string[]>([]);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitName, setHabitName] = useState('');
  const [habitGoal, setHabitGoal] = useState(4);
  const [habitColor, setHabitColor] = useState('#22c55e');

  const [longUrl, setLongUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [expandedCode, setExpandedCode] = useState('');

  const [qrText, setQrText] = useState('https://example.com');
  const [scanResult, setScanResult] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanPreview, setScanPreview] = useState('');

  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertFormat, setConvertFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [convertQuality, setConvertQuality] = useState(0.92);
  const [convertError, setConvertError] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');
  const [convertedName, setConvertedName] = useState('');

  useEffect(() => {
    try {
      const rawHabits = localStorage.getItem(TOOL_STORAGE_KEYS.habits);
      const parsedHabits = rawHabits ? (JSON.parse(rawHabits) as Habit[]) : [];
      setHabits(Array.isArray(parsedHabits) ? parsedHabits : []);

      const rawLinks = localStorage.getItem(TOOL_STORAGE_KEYS.links);
      const parsedLinks = rawLinks ? (JSON.parse(rawLinks) as ShortLink[]) : [];
      setLinks(Array.isArray(parsedLinks) ? parsedLinks : []);
    } catch {
      setHabits([]);
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TOOL_STORAGE_KEYS.habits, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem(TOOL_STORAGE_KEYS.links, JSON.stringify(links));
  }, [links]);

  const rgb = useMemo(() => {
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    const bigint = Number.parseInt(full, 16);
    if (!Number.isFinite(bigint)) return { r: 99, g: 102, b: 241 };
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }, [hex]);

  const hsl = useMemo(() => {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = 60 * (((g - b) / d) % 6);
          break;
        case g:
          h = 60 * ((b - r) / d + 2);
          break;
        default:
          h = 60 * ((r - g) / d + 4);
          break;
      }
    }
    if (h < 0) h += 360;
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }, [rgb]);

  const evaluateExpression = () => {
    try {
      const safe = calcInput.replace(/[^0-9+\-*/().%\s]/g, '');
      if (!safe.trim()) {
        setCalcResult('0');
        return;
      }
      const result = Function(`"use strict"; return (${safe})`)();
      setCalcResult(String(result));
    } catch {
      setCalcResult('Invalid expression');
    }
  };

  const addHabit = () => {
    if (!habitName.trim()) return;
    setHabits(prev => [{
      id: crypto.randomUUID(),
      name: habitName.trim(),
      color: habitColor,
      goalPerWeek: Math.max(1, Math.min(7, habitGoal)),
      createdAt: new Date().toISOString(),
      logs: {},
    }, ...prev]);
    setHabitName('');
  };

  const toggleHabitToday = (id: string) => {
    const day = todayKey();
    setHabits(prev => prev.map(h => h.id !== id ? h : ({
      ...h,
      logs: {
        ...h.logs,
        [day]: !h.logs[day],
      },
    })));
  };

  const removeHabit = (id: string) => setHabits(prev => prev.filter(h => h.id !== id));

  const createShortLink = () => {
    try {
      const parsed = new URL(longUrl.trim());
      const nextCode = (customCode.trim() || toBase62(Date.now()).slice(-6)).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!nextCode) return;
      if (links.some(l => l.code === nextCode)) return;
      const item: ShortLink = {
        code: nextCode,
        url: parsed.toString(),
        createdAt: new Date().toISOString(),
        clicks: 0,
      };
      setLinks(prev => [item, ...prev]);
      setExpandedCode(nextCode);
      setLongUrl('');
      setCustomCode('');
    } catch {
      // noop
    }
  };

  const openShortLink = (code: string) => {
    const match = links.find(link => link.code === code);
    if (!match) return;
    setLinks(prev => prev.map(link => link.code === code ? { ...link, clicks: link.clicks + 1 } : link));
    window.open(match.url, '_blank', 'noopener,noreferrer');
  };

  const scanQrFromFile = async (file: File) => {
    setScanError('');
    setScanResult('');
    const imageUrl = URL.createObjectURL(file);
    setScanPreview(imageUrl);

    try {
      if (!('BarcodeDetector' in window)) {
        setScanError('BarcodeDetector is not supported in this browser.');
        return;
      }
      const detector = new (window as typeof window & { BarcodeDetector: new (options?: { formats: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const barcodes = await detector.detect(bitmap);
      setScanResult(barcodes[0]?.rawValue || 'No QR code found in this image.');
    } catch {
      setScanError('Could not scan the selected image. Try a sharper QR screenshot.');
    }
  };

  const qrImage = `https://quickchart.io/qr?text=${encodeURIComponent(qrText || ' ')}`;

  const runImageConversion = async () => {
    if (!convertFile) {
      setConvertError('Choose an image file to convert first.');
      return;
    }

    setConvertError('');
    setConvertedUrl('');
    setConvertedName('');

    try {
      const sourceUrl = URL.createObjectURL(convertFile);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode this image file.'));
        img.src = sourceUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        setConvertError('Canvas is not available in this browser.');
        URL.revokeObjectURL(sourceUrl);
        return;
      }

      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(sourceUrl);

      const mimeType = `image/${convertFormat}`;
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), mimeType, convertQuality);
      });

      if (!blob) {
        setConvertError('Conversion failed. Try a different source file or format.');
        return;
      }

      const nextUrl = URL.createObjectURL(blob);
      const baseName = convertFile.name.replace(/\.[^.]+$/, '');
      setConvertedUrl(nextUrl);
      setConvertedName(`${baseName}.${convertFormat === 'jpeg' ? 'jpg' : convertFormat}`);
    } catch {
      setConvertError('Could not convert this file. Try PNG, JPG, or WEBP images.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-9 px-3 border-b border-border flex items-center text-xs uppercase tracking-wide text-muted-foreground font-medium">
        Tools
      </div>

      <div className="grid grid-cols-6 border-b border-border">
        {[
          { id: 'calculator', icon: Calculator, label: 'Calc' },
          { id: 'css', icon: Palette, label: 'CSS' },
          { id: 'habit', icon: CheckSquare2, label: 'Habits' },
          { id: 'shortener', icon: Link2, label: 'URL' },
          { id: 'qr', icon: QrCode, label: 'QR' },
          { id: 'converter', icon: RefreshCw, label: 'Convert' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={`py-2 text-[11px] flex flex-col items-center gap-1 border-r border-border last:border-r-0 ${activeSection === tab.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-xs">
        {activeSection === 'calculator' && (
          <div className="space-y-2">
            <p className="text-muted-foreground">Scientific-style expression calculator (supports +, -, *, /, %, parentheses).</p>
            <input
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              placeholder="(12 + 5) * 3 / 2"
              className="w-full bg-input border border-border rounded px-2 py-1.5"
            />
            <button onClick={evaluateExpression} className="w-full py-1.5 rounded bg-primary text-primary-foreground">Calculate</button>
            <div className="bg-muted rounded p-2">
              <div className="text-muted-foreground">Result</div>
              <div className="font-mono text-sm text-foreground break-all">{calcResult}</div>
            </div>
          </div>
        )}

        {activeSection === 'css' && (
          <div className="space-y-2">
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-full h-10 rounded border border-border bg-transparent" />
            <input value={hex} onChange={(e) => setHex(e.target.value)} className="w-full bg-input border border-border rounded px-2 py-1.5 font-mono" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigator.clipboard.writeText(hex)} className="py-1.5 rounded bg-accent">Copy HEX</button>
              <button onClick={() => navigator.clipboard.writeText(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)} className="py-1.5 rounded bg-accent">Copy RGB</button>
              <button onClick={() => navigator.clipboard.writeText(`hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`)} className="py-1.5 rounded bg-accent">Copy HSL</button>
              <button onClick={() => setSavedColors(prev => [hex, ...prev.filter(c => c !== hex)].slice(0, 8))} className="py-1.5 rounded bg-accent">Save Color</button>
            </div>
            <div className="rounded border border-border overflow-hidden">
              <div className="h-10" style={{ backgroundColor: hex }} />
              <div className="p-2 space-y-1 font-mono text-[11px]">
                <div>hex: {hex}</div>
                <div>rgb: {rgb.r}, {rgb.g}, {rgb.b}</div>
                <div>hsl: {hsl.h} {hsl.s}% {hsl.l}%</div>
              </div>
            </div>
            {savedColors.length > 0 && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Saved palette</div>
                <div className="grid grid-cols-8 gap-1">
                  {savedColors.map((color) => (
                    <button key={color} title={color} onClick={() => setHex(color)} className="h-6 rounded border border-border" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'habit' && (
          <div className="space-y-3">
            <div className="space-y-2 rounded border border-border p-2">
              <input value={habitName} onChange={(e) => setHabitName(e.target.value)} placeholder="New habit name" className="w-full bg-input border border-border rounded px-2 py-1.5" />
              <div className="flex gap-2">
                <input type="color" value={habitColor} onChange={(e) => setHabitColor(e.target.value)} className="w-10 h-8 rounded border border-border" />
                <input type="number" min={1} max={7} value={habitGoal} onChange={(e) => setHabitGoal(Number(e.target.value))} className="w-20 bg-input border border-border rounded px-2 py-1.5" />
                <button onClick={addHabit} className="flex-1 rounded bg-primary text-primary-foreground flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> Add</button>
              </div>
            </div>
            {habits.map(habit => {
              const streak = getStreak(habit.logs);
              const progress = getLast7DaysProgress(habit.logs);
              const complete = Boolean(habit.logs[todayKey()]);
              return (
                <div key={habit.id} className="rounded border border-border p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
                    <div className="font-medium text-foreground flex-1 truncate">{habit.name}</div>
                    <button onClick={() => removeHabit(habit.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="text-muted-foreground">Streak: {streak} day(s) • Last 7d: {progress}/{habit.goalPerWeek}</div>
                  <button onClick={() => toggleHabitToday(habit.id)} className={`w-full py-1 rounded ${complete ? 'bg-green-600 text-white' : 'bg-accent text-foreground'}`}>
                    {complete ? 'Completed today' : 'Mark today as done'}
                  </button>
                </div>
              );
            })}
            {habits.length === 0 && <div className="text-muted-foreground text-center py-3">No habits yet. Add your first one above.</div>}
          </div>
        )}

        {activeSection === 'shortener' && (
          <div className="space-y-2">
            <input value={longUrl} onChange={(e) => setLongUrl(e.target.value)} placeholder="https://your-long-url.com/path" className="w-full bg-input border border-border rounded px-2 py-1.5" />
            <input value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="Custom alias (optional)" className="w-full bg-input border border-border rounded px-2 py-1.5" />
            <button onClick={createShortLink} className="w-full py-1.5 rounded bg-primary text-primary-foreground">Create short URL</button>
            {links.map((link) => {
              const shortPath = `${location.origin}/s/${link.code}`;
              const isExpanded = expandedCode === link.code;
              return (
                <div key={link.code} className="rounded border border-border p-2 space-y-1">
                  <div className="font-mono text-foreground">/s/{link.code}</div>
                  <div className="text-muted-foreground truncate">{link.url}</div>
                  <div className="text-muted-foreground">Clicks: {link.clicks}</div>
                  <div className="flex gap-1">
                    <button className="flex-1 rounded bg-accent py-1" onClick={() => navigator.clipboard.writeText(shortPath)}><Copy className="w-3 h-3 inline mr-1" />Copy</button>
                    <button className="flex-1 rounded bg-accent py-1" onClick={() => setExpandedCode(link.code)}>Expand</button>
                    <button className="flex-1 rounded bg-accent py-1" onClick={() => openShortLink(link.code)}>Open</button>
                  </div>
                  {isExpanded && <div className="text-[11px] font-mono break-all bg-muted rounded p-1.5">{link.url}</div>}
                </div>
              );
            })}
          </div>
        )}

        {activeSection === 'qr' && (
          <div className="space-y-2">
            <div className="font-medium text-foreground">QR Generator</div>
            <input value={qrText} onChange={(e) => setQrText(e.target.value)} placeholder="Enter URL or text" className="w-full bg-input border border-border rounded px-2 py-1.5" />
            <div className="rounded border border-border p-2 bg-white">
              <img src={qrImage} alt="Generated QR code" className="w-full max-w-[180px] mx-auto" />
            </div>
            <button onClick={() => navigator.clipboard.writeText(qrText)} className="w-full py-1.5 rounded bg-accent">Copy encoded text</button>
            <div className="pt-2 border-t border-border" />
            <div className="font-medium text-foreground flex items-center gap-1"><ScanLine className="w-3.5 h-3.5" /> QR Scanner</div>
            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void scanQrFromFile(file); }} className="w-full text-[11px]" />
            {scanPreview && <img src={scanPreview} alt="Selected for scanning" className="w-full rounded border border-border" />}
            {scanResult && <div className="bg-muted rounded p-2 break-all">{scanResult}</div>}
            {scanError && <div className="text-destructive">{scanError}</div>}
          </div>
        )}

        {activeSection === 'converter' && (
          <div className="space-y-2">
            <p className="text-muted-foreground">Convert image files between PNG, JPG, and WEBP (for example: <span className="font-mono">jpeg → png</span>).</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setConvertFile(file);
                setConvertError('');
                setConvertedUrl('');
                setConvertedName('');
              }}
              className="w-full text-[11px]"
            />
            <select value={convertFormat} onChange={(event) => setConvertFormat(event.target.value as typeof convertFormat)} className="w-full bg-input border border-border rounded px-2 py-1.5">
              <option value="png">PNG</option>
              <option value="jpeg">JPG</option>
              <option value="webp">WEBP</option>
            </select>
            <label className="block space-y-1">
              <span className="text-muted-foreground">Quality (for JPG/WEBP): {Math.round(convertQuality * 100)}%</span>
              <input type="range" min={0.1} max={1} step={0.01} value={convertQuality} onChange={(event) => setConvertQuality(Number(event.target.value))} className="w-full" />
            </label>
            <button onClick={() => void runImageConversion()} className="w-full py-1.5 rounded bg-primary text-primary-foreground">Convert file</button>
            {convertFile && <div className="text-muted-foreground">Source: {convertFile.name}</div>}
            {convertedUrl && (
              <a href={convertedUrl} download={convertedName} className="w-full py-1.5 rounded bg-accent text-foreground inline-flex justify-center items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Download {convertedName}
              </a>
            )}
            {convertError && <div className="text-destructive">{convertError}</div>}
            <div className="rounded border border-border p-2 text-muted-foreground">
              Need <span className="font-mono">.m3u8 → .mp3</span>? Use ffmpeg in Terminal: <span className="font-mono">ffmpeg -i input.m3u8 -vn -c:a libmp3lame output.mp3</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
