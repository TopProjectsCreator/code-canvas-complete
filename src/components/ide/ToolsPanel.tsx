import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Palette,
  Link2,
  QrCode,
  ScanLine,
  CheckSquare2,
  Copy,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  FunctionSquare,
  Sigma,
  CalendarDays,
  Sparkles,
  FileCog,
  WandSparkles,
} from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type HabitLog = Record<string, boolean>;

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type HabitFrequency = 'daily' | 'weekdays' | 'custom';
type CalculatorMode = 'basic' | 'scientific' | 'graph';
type ConverterMode = 'media' | 'image' | 'pdf-to-docx' | 'pdf-to-markdown' | 'json-to-csv' | 'csv-to-json' | 'text-to-base64' | 'base64-to-text' | 'url-encode' | 'url-decode';
type MediaOutputFormat = 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi' | 'mp3' | 'wav' | 'm4a' | 'aac' | 'ogg' | 'flac' | 'gif';

type ConverterResult = {
  kind: 'file' | 'text';
  content: string;
  fileName?: string;
  mimeType?: string;
};

type ConverterSource = {
  kind: 'file' | 'url';
  label: string;
  name: string;
  mimeType: string;
  url?: string;
  sizeText?: string;
};

interface Habit {
  id: string;
  name: string;
  color: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
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
  habits: 'ide-tools-habits-v2',
  links: 'ide-tools-links-v1',
};

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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

const getWeekDates = () => Array.from({ length: 7 }, (_, index) => {
  const offset = index - 6;
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return {
    key: date.toISOString().slice(0, 10),
    label: weekdayFormatter.format(date),
    shortLabel: `${date.getMonth() + 1}/${date.getDate()}`,
  };
});

const getWeekProgress = (logs: HabitLog) => {
  const weekDates = getWeekDates();
  return weekDates.reduce((count, day) => count + (logs[day.key] ? 1 : 0), 0);
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

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return 'Undefined';
  if (Math.abs(value) >= 1_000_000 || (Math.abs(value) > 0 && Math.abs(value) < 0.000001)) {
    return value.toExponential(6);
  }
  return Number(value.toFixed(10)).toString();
};

const extractIdentifiers = (expression: string) => expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];

const parseMathExpression = (expression: string, xValue = 0) => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: true as const, value: 0 };
  }

  const safeCharacters = /^[0-9A-Za-z_+\-*/%^().,\s]*$/;
  if (!safeCharacters.test(trimmed)) {
    return { ok: false as const, message: 'Use numbers, x, parentheses, and supported math functions only.' };
  }

  const normalized = trimmed.replace(/\^/g, '**');
  const allowedIdentifiers = new Set(['x', 'abs', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'pow', 'mod', 'pi', 'e']);
  const identifiers = extractIdentifiers(normalized);
  const invalidIdentifier = identifiers.find((identifier) => !allowedIdentifiers.has(identifier));

  if (invalidIdentifier) {
    return { ok: false as const, message: `Unsupported function: ${invalidIdentifier}` };
  }

  const scope = {
    x: xValue,
    abs: Math.abs,
    sqrt: Math.sqrt,
    sin: (value: number) => Math.sin(value),
    cos: (value: number) => Math.cos(value),
    tan: (value: number) => Math.tan(value),
    log: (value: number, base = 10) => Math.log(value) / Math.log(base),
    ln: (value: number) => Math.log(value),
    pow: (value: number, exponent: number) => Math.pow(value, exponent),
    mod: (value: number, divisor: number) => value % divisor,
    pi: Math.PI,
    e: Math.E,
  };

  try {
    const fn = Function(...Object.keys(scope), `return (${normalized});`) as (...args: number[]) => unknown;
    const value = fn(...Object.values(scope));
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false as const, message: 'Expression returned an invalid number.' };
    }
    return { ok: true as const, value };
  } catch {
    return { ok: false as const, message: 'Check the expression syntax and try again.' };
  }
};

const parseCsv = (input: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += character;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((nextRow) => nextRow.some((cell) => cell.trim().length > 0));
};

const toCsvValue = (value: unknown) => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (/[",\n]/.test(serialized)) {
    return `"${serialized.replace(/"/g, '""')}"`;
  }
  return serialized;
};

const convertJsonToCsv = (input: string) => {
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Provide a JSON array of objects to convert into CSV.');
  }

  const rows = parsed as Array<Record<string, unknown>>;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = keys.join(',');
  const body = rows
    .map((row) => keys.map((key) => toCsvValue(row[key] ?? '')).join(','))
    .join('\n');

  return `${header}\n${body}`;
};

const convertCsvToJson = (input: string) => {
  const rows = parseCsv(input);
  if (rows.length < 2) {
    throw new Error('CSV input needs a header row and at least one data row.');
  }

  const [header, ...dataRows] = rows;
  const records = dataRows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
  return JSON.stringify(records, null, 2);
};

const readFileAsText = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(new Error('Could not read the selected file.'));
  reader.readAsText(file);
});

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(new Error('Could not read the selected file.'));
  reader.readAsDataURL(file);
});

const getFileExtension = (fileName: string) => {
  const match = fileName.toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] ?? '';
};

const mediaInputExtensions = new Set(['m3u8', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'ts', 'm2ts', 'flv', '3gp', 'mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'aiff', 'opus', 'wma']);
const imageInputExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);
const pdfInputExtensions = new Set(['pdf']);
const textInputExtensions = new Set(['txt', 'md', 'json', 'csv', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'yaml', 'yml']);

const getMimeTypeFromExtension = (extension: string) => {
  const mimeMap: Record<string, string> = {
    m3u8: 'application/vnd.apple.mpegurl',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
    ts: 'video/mp2t',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    flac: 'audio/flac',
    aiff: 'audio/aiff',
    opus: 'audio/ogg',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
    csv: 'text/csv',
    txt: 'text/plain',
    md: 'text/markdown',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
  };

  return mimeMap[extension] ?? 'application/octet-stream';
};

const getSourceFromUrl = (value: string): ConverterSource | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed);
    const rawName = decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() ?? '');
    const extension = getFileExtension(rawName);

    return {
      kind: 'url',
      label: parsedUrl.toString(),
      name: rawName || `remote-source.${extension || 'bin'}`,
      mimeType: getMimeTypeFromExtension(extension),
      url: parsedUrl.toString(),
      sizeText: 'Remote link',
    };
  } catch {
    return null;
  }
};

const getSourceFromFile = (file: File | null): ConverterSource | null => {
  if (!file) return null;

  return {
    kind: 'file',
    label: file.name,
    name: file.name,
    mimeType: file.type || getMimeTypeFromExtension(getFileExtension(file.name)),
    sizeText: `${Math.max(1, Math.round(file.size / 1024))} KB`,
  };
};

const getSuggestedConverterModes = (source: ConverterSource): ConverterMode[] => {
  const extension = getFileExtension(source.name);
  const suggestions: ConverterMode[] = [];

  if (source.mimeType.startsWith('image/') || imageInputExtensions.has(extension)) {
    suggestions.push('image');
  }

  if (mediaInputExtensions.has(extension) || source.mimeType.startsWith('video/') || source.mimeType.startsWith('audio/')) {
    suggestions.push('media');
  }

  if (pdfInputExtensions.has(extension) || source.mimeType === 'application/pdf') {
    suggestions.push('pdf-to-docx', 'pdf-to-markdown');
  }

  if (extension === 'json') suggestions.push('json-to-csv');
  if (extension === 'csv') suggestions.push('csv-to-json');

  if (textInputExtensions.has(extension) || source.mimeType.startsWith('text/')) {
    suggestions.push('text-to-base64');
  }

  return Array.from(new Set(suggestions));
};

const getMediaOutputFormats = (source: ConverterSource | null): MediaOutputFormat[] => {
  if (!source) return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];

  const extension = getFileExtension(source.name);

  if (extension === 'm3u8') return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'aiff', 'opus', 'wma'].includes(extension) || source.mimeType.startsWith('audio/')) {
    return ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
  }

  return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'gif'];
};

const getFileAcceptForMode = (mode: ConverterMode) => {
  switch (mode) {
    case 'image':
      return 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml';
    case 'media':
      return '.m3u8,video/*,audio/*,.mkv,.avi,.mov,.mp4,.webm,.mp3,.wav,.ogg,.m4a,.aac';
    case 'json-to-csv':
      return '.json,application/json,text/json';
    case 'csv-to-json':
      return '.csv,text/csv';
    case 'pdf-to-docx':
    case 'pdf-to-markdown':
      return '.pdf,application/pdf';
    case 'text-to-base64':
    case 'base64-to-text':
      return '.txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.tsx,.jsx,.yaml,.yml,text/*';
    default:
      return undefined;
  }
};

const calculatorButtons: Array<Array<{ label: string; value?: string; action?: 'clear' | 'backspace' | 'evaluate' | 'wrap-abs' | 'insert-log' | 'insert-ln' | 'insert-mod' | 'insert-x' }>> = [
  [
    { label: 'AC', action: 'clear' },
    { label: '⌫', action: 'backspace' },
    { label: 'abs', action: 'wrap-abs' },
    { label: 'mod', action: 'insert-mod' },
  ],
  [
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '÷', value: '/' },
  ],
  [
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '×', value: '*' },
  ],
  [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '−', value: '-' },
  ],
  [
    { label: '0', value: '0' },
    { label: '.', value: '.' },
    { label: '(', value: '(' },
    { label: ')', value: ')' },
  ],
  [
    { label: 'log', action: 'insert-log' },
    { label: 'ln', action: 'insert-ln' },
    { label: 'x', action: 'insert-x' },
    { label: '=', action: 'evaluate' },
  ],
];

export const ToolsPanel = () => {
  const [activeSection, setActiveSection] = useState<'calculator' | 'css' | 'habit' | 'shortener' | 'qr' | 'converter'>('calculator');

  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>('scientific');
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState<string>('0');
  const [calcHint, setCalcHint] = useState('Ready');
  const [graphExpression, setGraphExpression] = useState('sin(x)');
  const [graphRange, setGraphRange] = useState(10);

  const [hex, setHex] = useState('#6366f1');
  const [savedColors, setSavedColors] = useState<string[]>([]);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitName, setHabitName] = useState('');
  const [habitFrequency, setHabitFrequency] = useState<HabitFrequency>('daily');
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

  const [converterMode, setConverterMode] = useState<ConverterMode>('image');
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertSourceUrlInput, setConvertSourceUrlInput] = useState('');
  const [convertSourceUrl, setConvertSourceUrl] = useState('');
  const [convertFormat, setConvertFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [mediaOutputFormat, setMediaOutputFormat] = useState<MediaOutputFormat>('mp4');
  const [convertQuality, setConvertQuality] = useState(0.92);
  const [converterInput, setConverterInput] = useState('');
  const [converterError, setConverterError] = useState('');
  const [converterResult, setConverterResult] = useState<ConverterResult | null>(null);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState('');

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

  useEffect(() => () => {
    if (scanPreview) {
      URL.revokeObjectURL(scanPreview);
    }
    if (converterResult?.kind === 'file' && converterResult.content.startsWith('blob:')) {
      URL.revokeObjectURL(converterResult.content);
    }
  }, [scanPreview, converterResult]);

  const rgb = useMemo(() => {
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map((character) => character + character).join('') : c;
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

  const calculatorExamples = useMemo(() => ([
    'abs(-14)',
    'mod(29, 6)',
    'log(1000)',
    'sqrt(81) + 5',
    'sin(pi / 2)',
    'x^2 - 4',
  ]), []);

  const graphPoints = useMemo(() => {
    const safeRange = Math.max(2, graphRange);
    return Array.from({ length: 121 }, (_, index) => {
      const x = -safeRange + (index * (safeRange * 2)) / 120;
      const evaluation = parseMathExpression(graphExpression, x);
      return {
        x: Number(x.toFixed(2)),
        y: evaluation.ok && Number.isFinite(evaluation.value) ? Number(evaluation.value.toFixed(4)) : null,
      };
    });
  }, [graphExpression, graphRange]);

  const graphStatus = useMemo(() => {
    const sample = parseMathExpression(graphExpression, 1);
    if (!graphExpression.trim()) return 'Enter an expression that uses x to graph it.';
    return sample.ok ? 'Graph ready' : sample.message;
  }, [graphExpression]);

  const insertCalcValue = (value: string) => {
    setCalcInput((current) => `${current}${value}`);
  };

  const evaluateExpression = (expression = calcInput) => {
    const result = parseMathExpression(expression);
    if (!result.ok) {
      setCalcResult('Error');
      setCalcHint(result.message);
      return;
    }
    setCalcResult(formatNumber(result.value));
    setCalcHint('Calculated successfully');
  };

  const handleCalculatorButton = (button: { value?: string; action?: 'clear' | 'backspace' | 'evaluate' | 'wrap-abs' | 'insert-log' | 'insert-ln' | 'insert-mod' | 'insert-x' }) => {
    if (button.value) {
      insertCalcValue(button.value);
      return;
    }

    switch (button.action) {
      case 'clear':
        setCalcInput('');
        setCalcResult('0');
        setCalcHint('Ready');
        break;
      case 'backspace':
        setCalcInput((current) => current.slice(0, -1));
        break;
      case 'evaluate':
        evaluateExpression();
        break;
      case 'wrap-abs':
        setCalcInput((current) => current.trim() ? `abs(${current})` : 'abs()');
        break;
      case 'insert-log':
        insertCalcValue('log(');
        break;
      case 'insert-ln':
        insertCalcValue('ln(');
        break;
      case 'insert-mod':
        insertCalcValue('mod(');
        break;
      case 'insert-x':
        insertCalcValue('x');
        break;
      default:
        break;
    }
  };

  const nextHabitTarget = useMemo(() => {
    if (habitFrequency === 'daily') return 7;
    if (habitFrequency === 'weekdays') return 5;
    return Math.max(1, Math.min(7, habitGoal));
  }, [habitFrequency, habitGoal]);

  const addHabit = () => {
    if (!habitName.trim()) return;
    setHabits((previous) => [{
      id: crypto.randomUUID(),
      name: habitName.trim(),
      color: habitColor,
      frequency: habitFrequency,
      targetPerWeek: nextHabitTarget,
      createdAt: new Date().toISOString(),
      logs: {},
    }, ...previous]);
    setHabitName('');
  };

  const toggleHabitDay = (id: string, dateKey: string) => {
    setHabits((previous) => previous.map((habit) => habit.id !== id ? habit : ({
      ...habit,
      logs: {
        ...habit.logs,
        [dateKey]: !habit.logs[dateKey],
      },
    })));
  };

  const removeHabit = (id: string) => setHabits((previous) => previous.filter((habit) => habit.id !== id));

  const createShortLink = () => {
    try {
      const parsed = new URL(longUrl.trim());
      const nextCode = (customCode.trim() || toBase62(Date.now()).slice(-6)).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!nextCode || links.some((link) => link.code === nextCode)) return;
      const item: ShortLink = {
        code: nextCode,
        url: parsed.toString(),
        createdAt: new Date().toISOString(),
        clicks: 0,
      };
      setLinks((previous) => [item, ...previous]);
      setExpandedCode(nextCode);
      setLongUrl('');
      setCustomCode('');
    } catch {
      // noop
    }
  };

  const openShortLink = (code: string) => {
    const match = links.find((link) => link.code === code);
    if (!match) return;
    setLinks((previous) => previous.map((link) => link.code === code ? { ...link, clicks: link.clicks + 1 } : link));
    window.open(match.url, '_blank', 'noopener,noreferrer');
  };

  const scanQrFromFile = async (file: File) => {
    setScanError('');
    setScanResult('');
    if (scanPreview) {
      URL.revokeObjectURL(scanPreview);
    }
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

  const selectedSource = useMemo(
    () => getSourceFromFile(convertFile) ?? getSourceFromUrl(convertSourceUrl),
    [convertFile, convertSourceUrl],
  );

  const applyConverterSource = (source: ConverterSource | null) => {
    if (!source) return;
    const nextModes = getSuggestedConverterModes(source);
    setConverterMode(nextModes[0] ?? 'text-to-base64');
    setMediaOutputFormat(getMediaOutputFormats(source)[0]);
    resetConverterOutput();
  };

  const readTextFromSelectedSource = async () => {
    if (convertFile) {
      return readFileAsText(convertFile);
    }

    if (selectedSource?.kind === 'url' && selectedSource.url) {
      const response = await fetch(selectedSource.url);
      if (!response.ok) {
        throw new Error(`Could not fetch ${selectedSource.url}.`);
      }
      return response.text();
    }

    return converterInput;
  };

  const loadRemoteBlob = async () => {
    if (selectedSource?.kind !== 'url' || !selectedSource.url) {
      throw new Error('Paste a direct file link or upload a file first.');
    }

    const response = await fetch(selectedSource.url);
    if (!response.ok) {
      throw new Error(`Could not fetch ${selectedSource.url}.`);
    }

    return response.blob();
  };

  const loadBinaryFromSelectedSource = async () => {
    if (convertFile) {
      return new Uint8Array(await convertFile.arrayBuffer());
    }

    return new Uint8Array(await (await loadRemoteBlob()).arrayBuffer());
  };

  const extractPdfPages = async () => {
    if (!selectedSource) {
      throw new Error('Choose a PDF file or paste a direct PDF link first.');
    }

    const pdfData = await loadBinaryFromSelectedSource();
    const pdf = await getDocument({ data: pdfData }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push(pageText || `(Page ${pageNumber} contained no extractable text.)`);
    }

    return pages;
  };

  const runPdfToMarkdownConversion = async () => {
    const pages = await extractPdfPages();
    const markdown = pages
      .map((pageText, index) => `# Page ${index + 1}\n\n${pageText}`)
      .join('\n\n');
    const baseName = (selectedSource?.name ?? 'converted').replace(/\.[^.]+$/, '');

    return {
      kind: 'text' as const,
      content: markdown,
      fileName: `${baseName}.md`,
      mimeType: 'text/markdown',
    };
  };

  const runPdfToDocxConversion = async () => {
    const pages = await extractPdfPages();
    const baseName = (selectedSource?.name ?? 'converted').replace(/\.[^.]+$/, '');
    const document = new Document({
      sections: [{
        properties: {},
        children: pages.flatMap((pageText, index) => ([
          new Paragraph({
            heading: 'Heading1',
            children: [new TextRun(`Page ${index + 1}`)],
          }),
          ...pageText.split(/\n{2,}/).filter(Boolean).map((paragraph) => new Paragraph({
            children: [new TextRun(paragraph.trim())],
            spacing: { after: 200 },
          })),
        ])),
      }],
    });

    const blob = await Packer.toBlob(document);
    return {
      kind: 'file' as const,
      content: URL.createObjectURL(blob),
      fileName: `${baseName}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  };

  const resetConverterOutput = () => {
    setConverterError('');
    setConverterResult((current) => {
      if (current?.kind === 'file' && current.content.startsWith('blob:')) {
        URL.revokeObjectURL(current.content);
      }
      return null;
    });
  };

  const loadFfmpeg = async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;

    setFfmpegLoading(true);
    setFfmpegStatus('Loading browser media engine...');

    try {
      const ffmpeg = ffmpegRef.current ?? new FFmpeg();
      ffmpegRef.current = ffmpeg;

      if (!ffmpeg.loaded) {
        const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      return ffmpeg;
    } catch {
      throw new Error('Could not load the in-browser media converter. Check your connection and try again.');
    } finally {
      setFfmpegLoading(false);
    }
  };

  const runMediaConversion = async () => {
    if (!selectedSource) {
      throw new Error('Choose a media file or paste a direct media link first.');
    }

    const ffmpeg = await loadFfmpeg();
    const safeInputName = selectedSource.name.replace(/[^a-zA-Z0-9._-]/g, '-') || `input.${getFileExtension(selectedSource.name) || 'bin'}`;
    const inputTarget = selectedSource.kind === 'file' ? safeInputName : selectedSource.url ?? safeInputName;
    const baseName = safeInputName.replace(/\.[^.]+$/, '') || 'converted';
    const outputName = `${baseName}.${mediaOutputFormat}`;

    setFfmpegStatus(`Converting ${selectedSource.label} → ${outputName}...`);
    if (selectedSource.kind === 'file' && convertFile) {
      await ffmpeg.writeFile(safeInputName, await fetchFile(convertFile));
    }

    const baseInputArgs = ['-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data', '-i', inputTarget];
    const args = mediaOutputFormat === 'mp4'
      ? [...baseInputArgs, '-c:v', 'libx264', '-c:a', 'aac', outputName]
      : mediaOutputFormat === 'webm'
        ? [...baseInputArgs, '-c:v', 'libvpx-vp9', '-c:a', 'libopus', outputName]
        : mediaOutputFormat === 'mov'
          ? [...baseInputArgs, '-c:v', 'libx264', '-c:a', 'aac', outputName]
          : mediaOutputFormat === 'mkv'
            ? [...baseInputArgs, '-c:v', 'libx264', '-c:a', 'aac', outputName]
            : mediaOutputFormat === 'avi'
              ? [...baseInputArgs, '-c:v', 'mpeg4', '-c:a', 'mp3', outputName]
              : mediaOutputFormat === 'mp3'
                ? [...baseInputArgs, '-vn', '-c:a', 'libmp3lame', outputName]
                : mediaOutputFormat === 'wav'
                  ? [...baseInputArgs, '-vn', '-c:a', 'pcm_s16le', outputName]
                  : mediaOutputFormat === 'm4a'
                    ? [...baseInputArgs, '-vn', '-c:a', 'aac', outputName]
                    : mediaOutputFormat === 'aac'
                      ? [...baseInputArgs, '-vn', '-c:a', 'aac', '-f', 'adts', outputName]
                      : mediaOutputFormat === 'ogg'
                        ? [...baseInputArgs, '-vn', '-c:a', 'libvorbis', outputName]
                        : mediaOutputFormat === 'flac'
                          ? [...baseInputArgs, '-vn', '-c:a', 'flac', outputName]
                          : [...baseInputArgs, '-vf', 'fps=10,scale=640:-1:flags=lanczos', outputName];

    const exitCode = await ffmpeg.exec(args, 120_000);
    if (exitCode !== 0) {
      throw new Error('Media conversion failed. If this is a remote .m3u8 playlist, make sure the link is public, the segments are reachable, and CORS is allowed.');
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const mimeType = mediaOutputFormat === 'mp4'
      ? 'video/mp4'
      : mediaOutputFormat === 'webm'
        ? 'video/webm'
        : mediaOutputFormat === 'mov'
          ? 'video/quicktime'
          : mediaOutputFormat === 'mkv'
            ? 'video/x-matroska'
            : mediaOutputFormat === 'avi'
              ? 'video/x-msvideo'
        : mediaOutputFormat === 'mp3'
          ? 'audio/mpeg'
        : mediaOutputFormat === 'wav'
          ? 'audio/wav'
          : mediaOutputFormat === 'm4a'
            ? 'audio/mp4'
            : mediaOutputFormat === 'aac'
              ? 'audio/aac'
              : mediaOutputFormat === 'ogg'
                ? 'audio/ogg'
                : mediaOutputFormat === 'flac'
                  ? 'audio/flac'
                  : 'image/gif';

    if (selectedSource.kind === 'file') {
      await ffmpeg.deleteFile(safeInputName).catch(() => undefined);
    }
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    setFfmpegStatus(`Ready: ${outputName}`);

    return {
      kind: 'file' as const,
      content: URL.createObjectURL(new Blob([bytes], { type: mimeType })),
      fileName: outputName,
      mimeType,
    };
  };

  const runImageConversion = async () => {
    if (!selectedSource) {
      throw new Error('Choose an image file or paste a direct image link first.');
    }

    const sourceFile = convertFile ?? new File(
      [await loadRemoteBlob()],
      selectedSource.name,
      { type: selectedSource.mimeType },
    );

    const sourceUrl = URL.createObjectURL(sourceFile);
    try {
      const isSvg = sourceFile.type === 'image/svg+xml' || sourceFile.name.toLowerCase().endsWith('.svg');
      const imageSource = isSvg ? await readFileAsDataUrl(sourceFile) : sourceUrl;
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode this image file.'));
        img.src = imageSource;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas is not available in this browser.');
      }

      context.drawImage(image, 0, 0);

      const mimeType = `image/${convertFormat}`;
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), mimeType, convertQuality);
      });

      if (!blob) {
        throw new Error('Conversion failed. Try a different source file or format.');
      }

      const nextUrl = URL.createObjectURL(blob);
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
      return {
        kind: 'file' as const,
        content: nextUrl,
        fileName: `${baseName}.${convertFormat === 'jpeg' ? 'jpg' : convertFormat}`,
        mimeType,
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const runConverter = async () => {
    resetConverterOutput();

    try {
      let result: ConverterResult;
      switch (converterMode) {
        case 'media':
          result = await runMediaConversion();
          break;
        case 'image':
          result = await runImageConversion();
          break;
        case 'pdf-to-docx':
          result = await runPdfToDocxConversion();
          break;
        case 'pdf-to-markdown':
          result = await runPdfToMarkdownConversion();
          break;
        case 'json-to-csv': {
          const source = await readTextFromSelectedSource();
          result = {
            kind: 'text',
            content: convertJsonToCsv(source),
            fileName: 'converted.csv',
            mimeType: 'text/csv',
          };
          break;
        }
        case 'csv-to-json': {
          const source = await readTextFromSelectedSource();
          result = {
            kind: 'text',
            content: convertCsvToJson(source),
            fileName: 'converted.json',
            mimeType: 'application/json',
          };
          break;
        }
        case 'text-to-base64': {
          const source = await readTextFromSelectedSource();
          result = {
            kind: 'text',
            content: btoa(unescape(encodeURIComponent(source))),
          };
          break;
        }
        case 'base64-to-text': {
          const source = (await readTextFromSelectedSource()).trim();
          result = {
            kind: 'text',
            content: decodeURIComponent(escape(atob(source))),
          };
          break;
        }
        case 'url-encode':
          result = { kind: 'text', content: encodeURIComponent(converterInput) };
          break;
        case 'url-decode':
          result = { kind: 'text', content: decodeURIComponent(converterInput) };
          break;
        default:
          result = { kind: 'text', content: '' };
      }
      setConverterResult(result);
    } catch (error) {
      setConverterError(error instanceof Error ? error.message : 'Conversion failed.');
    }
  };

  const weekDates = useMemo(() => getWeekDates(), []);

  const converterModeMeta: Record<ConverterMode, { title: string; description: string; acceptsFile: boolean; inputLabel: string }> = {
    media: {
      title: 'Media converter',
      description: 'Convert video, audio, and HLS playlists in the browser from files or direct links, with many export targets including .m3u8 → .mp4.',
      acceptsFile: true,
      inputLabel: 'Upload a video, audio file, or .m3u8 playlist — or paste a direct media link',
    },
    image: {
      title: 'Image converter',
      description: 'Convert PNG, JPG, WEBP, GIF, BMP, or SVG files directly in the browser.',
      acceptsFile: true,
      inputLabel: 'Select an image file',
    },
    'pdf-to-docx': {
      title: 'PDF → DOCX',
      description: 'Extract readable PDF text into a .docx document. Best for text-based PDFs rather than scanned pages.',
      acceptsFile: true,
      inputLabel: 'Upload a PDF or paste a direct PDF link',
    },
    'pdf-to-markdown': {
      title: 'PDF → Markdown',
      description: 'Turn PDF text into page-sectioned Markdown that is easy to edit in the IDE.',
      acceptsFile: true,
      inputLabel: 'Upload a PDF or paste a direct PDF link',
    },
    'json-to-csv': {
      title: 'JSON → CSV',
      description: 'Turn arrays of objects into spreadsheet-ready CSV without using the terminal.',
      acceptsFile: true,
      inputLabel: 'Paste JSON or upload a .json file',
    },
    'csv-to-json': {
      title: 'CSV → JSON',
      description: 'Convert CSV headers and rows into structured JSON records.',
      acceptsFile: true,
      inputLabel: 'Paste CSV or upload a .csv file',
    },
    'text-to-base64': {
      title: 'Text → Base64',
      description: 'Encode pasted text or text files into Base64.',
      acceptsFile: true,
      inputLabel: 'Paste text or upload a text file',
    },
    'base64-to-text': {
      title: 'Base64 → Text',
      description: 'Decode Base64 back into readable text.',
      acceptsFile: true,
      inputLabel: 'Paste Base64 or upload a text file',
    },
    'url-encode': {
      title: 'URL encode',
      description: 'Encode unsafe characters for query strings and URLs.',
      acceptsFile: false,
      inputLabel: 'Paste text to encode',
    },
    'url-decode': {
      title: 'URL decode',
      description: 'Decode percent-encoded URLs back into plain text.',
      acceptsFile: false,
      inputLabel: 'Paste encoded text to decode',
    },
  };

  const activeConverterMeta = converterModeMeta[converterMode];
  const suggestedConverterModes = selectedSource ? getSuggestedConverterModes(selectedSource) : [];
  const availableMediaOutputFormats = getMediaOutputFormats(selectedSource);
  const todayHabits = habits.filter((habit) => habit.logs[todayKey()]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-11 items-center justify-between border-b border-border px-3 text-xs uppercase tracking-[0.22em] text-muted-foreground font-medium">
        <span>Tools</span>
        <span className="rounded-full bg-accent px-2 py-1 text-[10px] text-foreground">Studio utilities</span>
      </div>

      <div className="grid grid-cols-6 border-b border-border bg-muted/20">
        {[
          { id: 'calculator', icon: Calculator, label: 'Calc' },
          { id: 'css', icon: Palette, label: 'CSS' },
          { id: 'habit', icon: CheckSquare2, label: 'Habits' },
          { id: 'shortener', icon: Link2, label: 'URL' },
          { id: 'qr', icon: QrCode, label: 'QR' },
          { id: 'converter', icon: RefreshCw, label: 'Convert' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={`border-r border-border px-2 py-2 text-[11px] last:border-r-0 ${activeSection === tab.id ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
          >
            <div className="flex flex-col items-center gap-1">
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 text-xs">
        {activeSection === 'calculator' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-3 text-slate-50 shadow-lg shadow-slate-950/30">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Calculator</div>
                  <div className="text-sm font-semibold">Scientific + graphing</div>
                </div>
                <div className="flex gap-1 rounded-full bg-white/5 p-1">
                  {([
                    ['basic', 'Basic'],
                    ['scientific', 'Scientific'],
                    ['graph', 'Graph'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setCalculatorMode(mode)}
                      className={`rounded-full px-2.5 py-1 text-[11px] ${calculatorMode === mode ? 'bg-primary text-primary-foreground' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-right text-[11px] text-slate-400 break-all">{calcInput || '0'}</div>
                <div className="mt-2 text-right text-3xl font-semibold tracking-tight break-all">{calcResult}</div>
                <div className="mt-1 text-right text-[11px] text-emerald-300">{calcHint}</div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {calculatorButtons
                  .filter((_, rowIndex) => calculatorMode !== 'basic' || rowIndex < 5)
                  .flat()
                  .map((button) => (
                    <button
                      key={`${button.label}-${button.value ?? button.action}`}
                      onClick={() => handleCalculatorButton(button)}
                      className={`rounded-xl px-3 py-3 text-sm font-medium transition ${button.action === 'evaluate' ? 'bg-primary text-primary-foreground hover:opacity-90' : button.action === 'clear' ? 'bg-rose-500/20 text-rose-100 hover:bg-rose-500/30' : 'bg-white/8 text-white hover:bg-white/15'}`}
                    >
                      {button.label}
                    </button>
                  ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {calculatorExamples.map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setCalcInput(example);
                      evaluateExpression(example);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FunctionSquare className="h-4 w-4 text-primary" /> Expression lab
                </div>
                <input
                  value={calcInput}
                  onChange={(event) => setCalcInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      evaluateExpression();
                    }
                  }}
                  placeholder="Try abs(-8) + log(100) or x^2 - 4"
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 font-mono text-sm"
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'π', value: 'pi' },
                    { label: 'e', value: 'e' },
                    { label: 'sqrt(', value: 'sqrt(' },
                    { label: '^', value: '^' },
                  ].map((shortcut) => (
                    <button key={shortcut.label} onClick={() => insertCalcValue(shortcut.value)} className="rounded-xl border border-border bg-accent px-3 py-2 text-foreground hover:bg-accent/80">
                      {shortcut.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-muted-foreground">
                  <div className="mb-2 font-medium text-foreground">Supported functions</div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {['abs(x)', 'mod(a,b)', 'log(x)', 'log(x, base)', 'ln(x)', 'sqrt(x)', 'sin(x)', 'cos(x)', 'tan(x)'].map((fn) => (
                      <span key={fn} className="rounded-full bg-background px-2 py-1 font-mono text-foreground">{fn}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sigma className="h-4 w-4 text-primary" /> Graphing mode
                </div>
                <input
                  value={graphExpression}
                  onChange={(event) => setGraphExpression(event.target.value)}
                  placeholder="sin(x), x^2, abs(x), log(x + 11)"
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 font-mono text-sm"
                />
                <label className="block space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Range</span>
                    <span className="font-mono text-foreground">±{graphRange}</span>
                  </div>
                  <input type="range" min={4} max={30} step={1} value={graphRange} onChange={(event) => setGraphRange(Number(event.target.value))} className="w-full" />
                </label>
                <div className="h-56 rounded-xl border border-border bg-muted/30 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} width={36} />
                      <Tooltip />
                      <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-xl px-3 py-2 ${graphStatus === 'Graph ready' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                  {graphStatus}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'css' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Color toolkit
              </div>
              <div className="grid gap-3">
                <input type="color" value={hex} onChange={(event) => setHex(event.target.value)} className="h-36 w-full rounded-2xl border border-border bg-transparent" />
                <div className="space-y-3">
                  <input value={hex} onChange={(event) => setHex(event.target.value)} className="w-full rounded-xl border border-border bg-input px-3 py-2 font-mono text-sm" />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button onClick={() => navigator.clipboard.writeText(hex)} className="rounded-xl bg-accent px-3 py-2 hover:bg-accent/80">Copy HEX</button>
                    <button onClick={() => navigator.clipboard.writeText(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)} className="rounded-xl bg-accent px-3 py-2 hover:bg-accent/80">Copy RGB</button>
                    <button onClick={() => navigator.clipboard.writeText(`hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`)} className="rounded-xl bg-accent px-3 py-2 hover:bg-accent/80">Copy HSL</button>
                    <button onClick={() => setSavedColors((previous) => [hex, ...previous.filter((color) => color !== hex)].slice(0, 8))} className="rounded-xl bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">Save</button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border">
                    <div className="h-16" style={{ backgroundColor: hex }} />
                    <div className="grid gap-1 bg-muted/30 p-3 font-mono text-[11px] text-foreground">
                      <div>hex: {hex}</div>
                      <div>rgb: {rgb.r}, {rgb.g}, {rgb.b}</div>
                      <div>hsl: {hsl.h} {hsl.s}% {hsl.l}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {savedColors.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="mb-2 text-sm font-semibold text-foreground">Saved palette</div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {savedColors.map((color) => (
                    <button key={color} title={color} onClick={() => setHex(color)} className="h-12 rounded-xl border border-border" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'habit' && (
          <div className="space-y-3">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" /> Habit planner
                </div>
                <div className="space-y-3">
                  <input value={habitName} onChange={(event) => setHabitName(event.target.value)} placeholder="Habit name" className="w-full rounded-xl border border-border bg-input px-3 py-2" />
                  <div className="grid grid-cols-[60px,1fr] gap-2">
                    <input type="color" value={habitColor} onChange={(event) => setHabitColor(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-transparent" />
                    <select value={habitFrequency} onChange={(event) => setHabitFrequency(event.target.value as HabitFrequency)} className="w-full rounded-xl border border-border bg-input px-3 py-2">
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="custom">Custom times per week</option>
                    </select>
                  </div>
                  {habitFrequency === 'custom' && (
                    <label className="block space-y-1">
                      <span className="text-muted-foreground">Target completions this week</span>
                      <input type="number" min={1} max={7} value={habitGoal} onChange={(event) => setHabitGoal(Number(event.target.value))} className="w-full rounded-xl border border-border bg-input px-3 py-2" />
                    </label>
                  )}
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-muted-foreground">
                    Goal: <span className="font-semibold text-foreground">{nextHabitTarget} day{nextHabitTarget === 1 ? '' : 's'} / week</span>
                  </div>
                  <button onClick={addHabit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">
                    <Plus className="h-4 w-4" /> Add habit
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Active habits</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{habits.length}</div>
                  <div className="mt-1 text-muted-foreground">Track routines with flexible weekly frequency.</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Done today</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{todayHabits.length}</div>
                  <div className="mt-1 text-muted-foreground">Checked off for {fullDateFormatter.format(new Date())}.</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Weekly hits</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{habits.reduce((count, habit) => count + getWeekProgress(habit.logs), 0)}</div>
                  <div className="mt-1 text-muted-foreground">Recent completions across all habits.</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">This week</div>
                  <div className="text-muted-foreground">Click the days you completed. No need to use the terminal for tracking.</div>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {weekDates.map((day) => (
                    <div key={day.key} className="w-12 text-center text-[10px] text-muted-foreground">
                      <div>{day.label}</div>
                      <div>{day.shortLabel}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {habits.map((habit) => {
                  const progress = getWeekProgress(habit.logs);
                  const streak = getStreak(habit.logs);
                  const completedToday = Boolean(habit.logs[todayKey()]);
                  const percent = Math.min(100, Math.round((progress / habit.targetPerWeek) * 100));

                  return (
                    <div key={habit.id} className="rounded-2xl border border-border bg-background p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">{habit.name}</div>
                            <div className="text-muted-foreground">
                              {habit.frequency === 'daily' ? 'Daily' : habit.frequency === 'weekdays' ? 'Weekdays' : `${habit.targetPerWeek}x / week`} • {progress}/{habit.targetPerWeek} this week • {streak} day streak
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleHabitDay(habit.id, todayKey())}
                            className={`rounded-xl px-3 py-2 ${completedToday ? 'bg-emerald-500 text-white' : 'bg-accent text-foreground hover:bg-accent/80'}`}
                          >
                            {completedToday ? 'Checked today' : 'Check off today'}
                          </button>
                          <button onClick={() => removeHabit(habit.id)} className="rounded-xl bg-accent px-3 py-2 text-foreground hover:bg-accent/80">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {weekDates.map((day) => {
                          const checked = Boolean(habit.logs[day.key]);
                          return (
                            <button
                              key={day.key}
                              onClick={() => toggleHabitDay(habit.id, day.key)}
                              className={`min-w-[58px] rounded-xl border px-2 py-3 text-center transition ${checked ? 'border-transparent text-white' : 'border-border bg-muted/30 text-foreground hover:bg-accent/60'}`}
                              style={checked ? { backgroundColor: habit.color } : undefined}
                            >
                              <div className="text-[10px] uppercase tracking-wide">{day.label}</div>
                              <div className="mt-1 text-xs">{day.shortLabel}</div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Weekly goal</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: habit.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {habits.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground">
                    No habits yet. Add one with a daily, weekday, or custom weekly frequency.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'shortener' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-foreground">URL shortener</div>
              <div className="space-y-2">
                <input value={longUrl} onChange={(event) => setLongUrl(event.target.value)} placeholder="https://your-long-url.com/path" className="w-full rounded-xl border border-border bg-input px-3 py-2" />
                <input value={customCode} onChange={(event) => setCustomCode(event.target.value)} placeholder="Custom alias (optional)" className="w-full rounded-xl border border-border bg-input px-3 py-2" />
                <button onClick={createShortLink} className="w-full rounded-xl bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">Create short URL</button>
              </div>
            </div>

            <div className="space-y-2">
              {links.map((link) => {
                const shortPath = `${location.origin}/s/${link.code}`;
                const isExpanded = expandedCode === link.code;
                return (
                  <div key={link.code} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                    <div className="font-mono text-sm text-foreground">/s/{link.code}</div>
                    <div className="mt-1 truncate text-muted-foreground">{link.url}</div>
                    <div className="mt-1 text-muted-foreground">Clicks: {link.clicks}</div>
                    <div className="mt-3 flex gap-2">
                      <button className="flex-1 rounded-xl bg-accent px-3 py-2 hover:bg-accent/80" onClick={() => navigator.clipboard.writeText(shortPath)}><Copy className="mr-1 inline h-3 w-3" />Copy</button>
                      <button className="flex-1 rounded-xl bg-accent px-3 py-2 hover:bg-accent/80" onClick={() => setExpandedCode(link.code)}>Expand</button>
                      <button className="flex-1 rounded-xl bg-accent px-3 py-2 hover:bg-accent/80" onClick={() => openShortLink(link.code)}>Open</button>
                    </div>
                    {isExpanded && <div className="mt-3 rounded-xl bg-muted p-2 font-mono text-[11px] break-all">{link.url}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSection === 'qr' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="text-sm font-semibold text-foreground">QR generator</div>
              <input value={qrText} onChange={(event) => setQrText(event.target.value)} placeholder="Enter URL or text" className="mt-3 w-full rounded-xl border border-border bg-input px-3 py-2" />
              <div className="mt-3 rounded-2xl border border-border bg-white p-3">
                <img src={qrImage} alt="Generated QR code" className="mx-auto w-full max-w-[220px]" />
              </div>
              <button onClick={() => navigator.clipboard.writeText(qrText)} className="mt-3 w-full rounded-xl bg-accent px-3 py-2 hover:bg-accent/80">Copy encoded text</button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ScanLine className="h-4 w-4 text-primary" /> QR scanner</div>
              <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanQrFromFile(file); }} className="mt-3 w-full text-[11px]" />
              {scanPreview && <img src={scanPreview} alt="Selected for scanning" className="mt-3 w-full rounded-2xl border border-border" />}
              {scanResult && <div className="mt-3 rounded-xl bg-muted p-3 break-all text-foreground">{scanResult}</div>}
              {scanError && <div className="mt-3 text-destructive">{scanError}</div>}
            </div>
          </div>
        )}

        {activeSection === 'converter' && (
          <div className="space-y-2">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileCog className="h-4 w-4 text-primary" /> Upload-first smart converter
              </div>
              <p className="mt-2 text-muted-foreground">
                Upload a file or paste a direct link first and the tool will surface the conversions that make sense for it — including remote media jobs like .m3u8 → .mp4.
              </p>

              <div className="mt-3 rounded-2xl border border-dashed border-primary/30 bg-background/70 p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Step 1</div>
                <div className="mt-1 text-sm font-medium text-foreground">Upload your source file or use a direct link</div>
                <p className="mt-1 text-muted-foreground">No terminal needed — choose a file or paste a URL like a public `.m3u8` playlist and we'll show the likely conversion paths.</p>
                <input
                  type="file"
                  accept={getFileAcceptForMode(converterMode)}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setConvertFile(nextFile);
                    setConvertSourceUrl('');
                    setConvertSourceUrlInput('');
                    if (nextFile) {
                      applyConverterSource(getSourceFromFile(nextFile));
                    }
                    resetConverterOutput();
                  }}
                  className="mt-3 w-full text-[11px]"
                />
                <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
                  <input
                    value={convertSourceUrlInput}
                    onChange={(event) => setConvertSourceUrlInput(event.target.value)}
                    placeholder="https://math-gpt.org/api/streams/.../master.m3u8"
                    className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => {
                      const nextSource = getSourceFromUrl(convertSourceUrlInput);
                      if (!nextSource) {
                        setConverterError('Paste a valid direct file URL first.');
                        return;
                      }
                      setConvertFile(null);
                      setConvertSourceUrl(nextSource.url ?? '');
                      setConvertSourceUrlInput(nextSource.url ?? '');
                      applyConverterSource(nextSource);
                    }}
                    className="rounded-xl bg-accent px-3 py-2 text-foreground hover:bg-accent/80"
                  >
                    Use link
                  </button>
                </div>
                {selectedSource ? (
                  <div className="mt-3 rounded-xl bg-muted/40 p-3 text-foreground">
                    <div className="font-medium">{selectedSource.name}</div>
                    <div className="mt-1 break-all text-[11px] text-muted-foreground">
                      {selectedSource.kind === 'url' ? selectedSource.url : selectedSource.mimeType || 'Unknown type'} · {selectedSource.sizeText}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl bg-muted/20 p-3 text-muted-foreground">Upload a file or paste a direct link to unlock recommended conversions below.</div>
                )}
              </div>

              <div className="mt-3 grid gap-2 xl:grid-cols-[1.45fr,1fr]">
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Step 2</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <WandSparkles className="h-4 w-4 text-primary" /> Possible conversions
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {selectedSource ? `Showing the best matches for ${selectedSource.name}.` : 'Choose a file or direct link to see tailored conversion options.'}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedSource && suggestedConverterModes.length > 0 ? suggestedConverterModes.map((mode) => {
                      const meta = converterModeMeta[mode];
                      return (
                        <button
                          key={mode}
                          onClick={() => {
                            setConverterMode(mode);
                            if (mode === 'media') {
                              setMediaOutputFormat(getMediaOutputFormats(selectedSource)[0]);
                            }
                            resetConverterOutput();
                          }}
                          className={`rounded-2xl border px-3 py-3 text-left ${converterMode === mode ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/40'}`}
                        >
                          <div className="font-medium">{meta.title}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{meta.description}</div>
                        </button>
                      );
                    }) : (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-muted-foreground">
                        {selectedSource ? 'No tailored conversions detected yet, but you can still pick a manual converter on the right.' : 'Upload a file or paste a link first to reveal recommended conversions.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Also available</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">Manual converters</div>
                  <p className="mt-1 text-muted-foreground">Switch to any recipe here if you want to override the suggested path.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(converterModeMeta).map(([mode, meta]) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setConverterMode(mode as ConverterMode);
                          if ((mode as ConverterMode) === 'media') {
                            setMediaOutputFormat(getMediaOutputFormats(selectedSource)[0]);
                          }
                          resetConverterOutput();
                        }}
                        className={`rounded-2xl border px-3 py-2 text-left ${converterMode === mode ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/40'}`}
                      >
                        <div className="font-medium">{meta.title}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{meta.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <WandSparkles className="h-4 w-4 text-primary" /> {activeConverterMeta.title}
                </div>
                <p className="mt-1 text-muted-foreground">{activeConverterMeta.description}</p>

                {activeConverterMeta.acceptsFile && !selectedSource && (
                  <div className="mt-3 rounded-xl bg-muted/20 p-3 text-muted-foreground">Upload a source file or paste a direct link above to use this converter.</div>
                )}

                {converterMode === 'media' && (
                  <div className="mt-3 grid gap-2">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Output format</span>
                      <select value={mediaOutputFormat} onChange={(event) => setMediaOutputFormat(event.target.value as MediaOutputFormat)} className="w-full rounded-xl border border-border bg-input px-3 py-2">
                        {availableMediaOutputFormats.map((format) => (
                          <option key={format} value={format}>{format.toUpperCase()}</option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-xl bg-muted/20 p-3 text-[11px] text-muted-foreground">
                      Tip: direct `.m3u8` links such as public HLS playlist URLs can be converted here when the playlist and segments are public and allow browser access. Available exports: {availableMediaOutputFormats.length}.
                    </div>
                    {ffmpegStatus && <div className="rounded-xl bg-muted/30 p-2 text-foreground">{ffmpegStatus}</div>}
                  </div>
                )}

                {converterMode === 'image' && (
                  <div className="mt-3 grid gap-2">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Output format</span>
                      <select value={convertFormat} onChange={(event) => setConvertFormat(event.target.value as typeof convertFormat)} className="w-full rounded-xl border border-border bg-input px-3 py-2">
                        <option value="png">PNG</option>
                        <option value="jpeg">JPG</option>
                        <option value="webp">WEBP</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Quality: {Math.round(convertQuality * 100)}%</span>
                      <input type="range" min={0.1} max={1} step={0.01} value={convertQuality} onChange={(event) => setConvertQuality(Number(event.target.value))} className="w-full" />
                    </label>
                  </div>
                )}

                {(converterMode === 'pdf-to-docx' || converterMode === 'pdf-to-markdown') && (
                  <div className="mt-3 rounded-xl bg-muted/20 p-3 text-[11px] text-muted-foreground">
                    PDF exports here are text-focused: they preserve readable content well for normal PDFs, but scanned/image PDFs will still need OCR for best results.
                  </div>
                )}

                {converterMode !== 'image' && converterMode !== 'media' && converterMode !== 'pdf-to-docx' && converterMode !== 'pdf-to-markdown' && (
                  <label className="mt-3 block space-y-2">
                    <span className="text-muted-foreground">Paste content</span>
                    <textarea
                      value={converterInput}
                      onChange={(event) => setConverterInput(event.target.value)}
                      rows={12}
                      placeholder={converterMode === 'json-to-csv' ? '[{"name":"Ada","score":10}]' : converterMode === 'csv-to-json' ? 'name,score\nAda,10' : converterMode === 'text-to-base64' ? 'Paste text to encode' : converterMode === 'base64-to-text' ? 'UGFzdGUgQmFzZTY0' : converterMode === 'url-encode' ? 'A string with spaces & symbols' : 'Paste encoded text'}
                      className="w-full rounded-2xl border border-border bg-input px-3 py-2 font-mono text-xs"
                    />
                  </label>
                )}

                <button onClick={() => void runConverter()} disabled={ffmpegLoading} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${ffmpegLoading ? 'animate-spin' : ''}`} /> {ffmpegLoading ? 'Loading converter...' : 'Convert now'}
                </button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="text-sm font-semibold text-foreground">Output</div>
                <p className="mt-1 text-muted-foreground">Download files or copy text right from here.</p>
                {converterResult?.kind === 'file' && converterResult.fileName && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl border border-border bg-muted/30 p-3 text-foreground">Ready: {converterResult.fileName}</div>
                    <a href={converterResult.content} download={converterResult.fileName} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-foreground hover:bg-accent/80">
                      <Download className="h-4 w-4" /> Download file
                    </a>
                    {converterResult.mimeType?.startsWith('image/') && (
                      <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 p-2">
                        <img src={converterResult.content} alt="Converted preview" className="max-h-64 w-full rounded-xl object-contain" />
                      </div>
                    )}
                  </div>
                )}

                {converterResult?.kind === 'text' && (
                  <div className="mt-3 space-y-3">
                    <textarea readOnly value={converterResult.content} rows={16} className="w-full rounded-2xl border border-border bg-input px-3 py-2 font-mono text-xs" />
                    <div className="grid gap-2">
                      <button onClick={() => navigator.clipboard.writeText(converterResult.content)} className="rounded-xl bg-accent px-3 py-2 hover:bg-accent/80">
                        <Copy className="mr-1 inline h-4 w-4" /> Copy output
                      </button>
                      <a
                        href={URL.createObjectURL(new Blob([converterResult.content], { type: converterResult.mimeType ?? 'text/plain' }))}
                        download={converterResult.fileName ?? 'converted.txt'}
                        className="inline-flex items-center justify-center rounded-xl bg-accent px-3 py-2 hover:bg-accent/80"
                      >
                        <Download className="mr-1 h-4 w-4" /> Download text
                      </a>
                    </div>
                  </div>
                )}

                {!converterResult && !converterError && (
                  <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground">
                    No terminal required — choose a recipe and convert from here.
                  </div>
                )}

                {converterError && <div className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-destructive">{converterError}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
