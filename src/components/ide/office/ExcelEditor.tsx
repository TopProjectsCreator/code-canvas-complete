import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { FileNode } from '@/types/ide';
import {
  FileSpreadsheet, Save, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo,
  Plus, Loader2, ChevronDown, Table, Image, Link,
  BarChart3, Filter, SortAsc, SortDesc, Search,
  Eye, Columns, ArrowDownUp, Calculator, Sigma,
  Percent, DollarSign, Calendar, X, Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { decodeDataUrl, encodeDataUrl, parseXml, xmlEncode, buildNewXlsx } from './officeUtils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Parser } from 'hot-formula-parser';

interface ExcelEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

interface CellStyle {
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  numberFormat?: 'general' | 'number' | 'currency' | 'percent' | 'date';
}

interface CellMerge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

interface Sheet {
  name: string;
  grid: string[][];
  styles: CellStyle[][];
  mergedCells: CellMerge[];
}

const colLabel = (idx: number): string => {
  let label = '';
  let n = idx;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 100;

const isFormula = (value: string) => value.trim().startsWith("=");
const isNumericLiteral = (value: string) => /^-?\d+(\.\d+)?$/.test(value.trim());

export const ExcelEditor = ({ file, onContentChange }: ExcelEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([{ 
    name: 'Sheet1', 
    grid: Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill('')), 
    styles: Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill({ textAlign: 'left', numberFormat: 'general' })),
    mergedCells: []
  }]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selectedCell, setSelectedCell] = useState<[number, number]>([0, 0]);
  const [selectedRange, setSelectedRange] = useState<[[number, number], [number, number]] | null>(null);
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [colWidths, setColWidths] = useState<number[]>(Array(DEFAULT_COLS).fill(80));
  const [ribbonTab, setRibbonTab] = useState<'home' | 'insert' | 'formulas' | 'data' | 'review' | 'view'>('home');
  const [renamingSheetIdx, setRenamingSheetIdx] = useState<number | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const grid = sheets[activeSheetIdx].grid;
  const cellStyles = sheets[activeSheetIdx].styles;
  const mergedCells = sheets[activeSheetIdx].mergedCells;

  const setGrid = (updater: (prev: string[][]) => string[][]) => {
    setSheets(prev => prev.map((s, idx) => idx === activeSheetIdx ? { ...s, grid: updater(s.grid) } : s));
  };
  
  const setCellStyles = (updater: (prev: CellStyle[][]) => CellStyle[][]) => {
    setSheets(prev => prev.map((s, idx) => idx === activeSheetIdx ? { ...s, styles: updater(s.styles) } : s));
  };

  const setMergedCells = (updater: (prev: CellMerge[]) => CellMerge[]) => {
    setSheets(prev => prev.map((s, idx) => idx === activeSheetIdx ? { ...s, mergedCells: updater(s.mergedCells) } : s));
  };

  const addSheet = () => {
    setSheets([...sheets, { 
      name: `Sheet${sheets.length + 1}`, 
      grid: Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill('')), 
      styles: Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill({ textAlign: 'left', numberFormat: 'general' })),
      mergedCells: []
    }]);
    setActiveSheetIdx(sheets.length);
  };
  
  const renameSheet = (idx: number, newName: string) => {
    if (newName.trim()) {
      setSheets(prev => prev.map((s, i) => i === idx ? { ...s, name: newName.trim() } : s));
    }
    setRenamingSheetIdx(null);
  };

  const deleteSheet = (idx: number) => {
    if (sheets.length <= 1) return;
    setSheets(prev => prev.filter((_, i) => i !== idx));
    if (activeSheetIdx >= idx && activeSheetIdx > 0) {
      setActiveSheetIdx(activeSheetIdx - 1);
    }
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[][][]>([]);
  const redoRef = useRef<string[][][]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const lastZipBytesRef = useRef<Uint8Array | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: DEFAULT_ROWS,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  const colVirtualizer = useVirtualizer({
    count: DEFAULT_COLS,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (colWidths[0] || 80),
    horizontal: true,
    overscan: 5,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let bytes = decodeDataUrl(file.content || '');
        if (!bytes) {
          bytes = await buildNewXlsx();
          onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes));
        }
        lastZipBytesRef.current = bytes;
        const zip = await JSZip.loadAsync(bytes);
        const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
        const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
        const sharedStrings = sharedStringsXml
          ? Array.from(parseXml(sharedStringsXml).getElementsByTagNameNS('*', 't')).map(n => n.textContent || '')
          : [];

        const matrix = Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill(''));

        if (sheetXml) {
          const sheet = parseXml(sheetXml);
          const cells = Array.from(sheet.getElementsByTagNameNS('*', 'c'));
          for (const cell of cells) {
            const ref = cell.getAttribute('r') || '';
            const match = ref.match(/^([A-Z]+)(\d+)$/);
            if (!match) continue;
            const colName = match[1];
            const row = Number(match[2]) - 1;
            let col = 0;
            for (let i = 0; i < colName.length; i++) col = col * 26 + (colName.charCodeAt(i) - 64);
            col -= 1;
            if (row < 0 || col < 0 || row >= DEFAULT_ROWS || col >= DEFAULT_COLS) continue;
            const v = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
            const f = cell.getElementsByTagNameNS('*', 'f')[0]?.textContent || '';
            if (f) matrix[row][col] = `=${f}`;
            else matrix[row][col] = cell.getAttribute('t') === 's' ? (sharedStrings[Number(v)] || '') : v;
          }
        }
        setGrid(matrix);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open spreadsheet');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  useEffect(() => {
    setFormulaBarValue(grid[selectedCell[0]]?.[selectedCell[1]] || '');
  }, [selectedCell, grid]);

  const save = useCallback(async () => {
    const baseBytes = lastZipBytesRef.current || (await buildNewXlsx());
    const zip = await JSZip.loadAsync(baseBytes);

    const sharedValues = grid.flat().filter(v => v.length > 0 && !isFormula(v) && !isNumericLiteral(v));
    const uniqueShared = Array.from(new Set(sharedValues));
    const sharedIndex = new Map(uniqueShared.map((v, i) => [v, i]));

    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedValues.length}" uniqueCount="${uniqueShared.length}">${uniqueShared.map(v => `<si><t xml:space="preserve">${xmlEncode(v)}</t></si>`).join('')}</sst>`;

    const rowsXml = grid
      .map((row, rowIdx) => {
        const cellsXml = row
          .map((value, colIdx) => {
            if (!value) return '';
            const ref = `${colLabel(colIdx)}${rowIdx + 1}`;
            if (isFormula(value)) {
              return `<c r="${ref}"><f>${xmlEncode(value.trim().slice(1))}</f></c>`;
            }
            if (isNumericLiteral(value)) {
              return `<c r="${ref}"><v>${value.trim()}</v></c>`;
            }
            const index = sharedIndex.get(value) || 0;
            return `<c r="${ref}" t="s"><v>${index}</v></c>`;
          })
          .join('');
        return cellsXml ? `<row r="${rowIdx + 1}">${cellsXml}</row>` : '';
      })
      .join('');

    zip.file('xl/sharedStrings.xml', sharedStringsXml);
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`);

    zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);

    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    lastZipBytesRef.current = out;
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', out));
  }, [file.id, grid, onContentChange]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (loading || grid.length === 0) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    const timer = setTimeout(() => {
      save();
    }, 500);
    return () => clearTimeout(timer);
  }, [grid, loading, save]);

  const updateCell = (row: number, col: number, value: string) => {
    historyRef.current.push(grid.map(r => [...r]));
    redoRef.current = [];
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  const applyStyle = (update: (s: CellStyle) => CellStyle) => {
    const [row, col] = selectedCell;
    setCellStyles(prev => prev.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? update(c || {}) : c) : r));
  };

  const mergeCells = () => {
    if (!selectedRange) return;
    const [[r1, c1], [r2, c2]] = selectedRange;
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);

    if (minR === maxR && minC === maxC) return;

    setMergedCells(prev => [
      ...prev,
      { fromRow: minR, fromCol: minC, toRow: maxR, toCol: maxC }
    ]);

    const mainValue = grid[minR]?.[minC] || '';
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r === minR && c === minC) next[r][c] = mainValue;
          else next[r][c] = '';
        }
      }
      return next;
    });
  };

  const unmergeCells = () => {
    const [row, col] = selectedCell;
    const mergeIdx = mergedCells.findIndex(m => 
      row >= m.fromRow && row <= m.toRow && col >= m.fromCol && col <= m.toCol
    );
    if (mergeIdx >= 0) {
      setMergedCells(prev => prev.filter((_, idx) => idx !== mergeIdx));
    }
  };

  const isCellMerged = (row: number, col: number): CellMerge | null => {
    return mergedCells.find(m => 
      row >= m.fromRow && row <= m.toRow && col >= m.fromCol && col <= m.toCol
    ) || null;
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push(grid.map(r => [...r]));
    setGrid(prev);
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(grid.map(r => [...r]));
    setGrid(next);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      const nextCol = e.shiftKey ? Math.max(0, col - 1) : Math.min(DEFAULT_COLS - 1, col + 1);
      setSelectedCell([row, nextCol]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
      const nextRow = e.shiftKey ? Math.max(0, row - 1) : Math.min(DEFAULT_ROWS - 1, row + 1);
      setSelectedCell([nextRow, col]);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return;
    const [row, col] = selectedCell;
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedCell([Math.max(0, row - 1), col]); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedCell([Math.min(DEFAULT_ROWS - 1, row + 1), col]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setSelectedCell([row, Math.max(0, col - 1)]); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setSelectedCell([row, Math.min(DEFAULT_COLS - 1, col + 1)]); }
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditingCell([row, col]); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { updateCell(row, col, ''); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      updateCell(row, col, '');
      setEditingCell([row, col]);
    }
  };

  const addTableBlock = () => {
    const [row, col] = selectedCell;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) updateCell(Math.min(DEFAULT_ROWS - 1, row + r), Math.min(DEFAULT_COLS - 1, col + c), r === 0 ? `Header ${c + 1}` : `${r},${c + 1}`);
  };

  const insertLink = () => {
    const url = prompt('Enter URL')?.trim();
    if (!url) return;
    const [row, col] = selectedCell;
    updateCell(row, col, url);
  };

  const insertPictureRef = () => {
    const [row, col] = selectedCell;
    updateCell(row, col, '[image]');
  };

  const insertChartRef = () => {
    const [row, col] = selectedCell;
    updateCell(row, col, '=CHART(RANGE)');
  };

  const applyFilter = () => {
    const text = prompt('Show rows containing:')?.trim();
    if (!text) return;
    const [row, col] = selectedCell;
    const match = grid.findIndex(r => (r[col] || '').toLowerCase().includes(text.toLowerCase()));
    if (match >= 0) setSelectedCell([match, col]);
    else updateCell(row, col, 'No match');
  };

  const customSort = () => sortSelectedColumn('asc');

  const textToColumns = () => {
    const [row, col] = selectedCell;
    const parts = (grid[row]?.[col] || '').split(/[;,|]/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) return;
    parts.forEach((part, idx) => updateCell(row, Math.min(DEFAULT_COLS - 1, col + idx), part));
  };

  const findInSheet = () => {
    const text = prompt('Find text:')?.trim();
    if (!text) return;
    for (let r = 0; r < DEFAULT_ROWS; r++) {
      for (let c = 0; c < DEFAULT_COLS; c++) {
        if ((grid[r][c] || '').toLowerCase().includes(text.toLowerCase())) {
          setSelectedCell([r, c]);
          return;
        }
      }
    }
  };

  const sortSelectedColumn = (direction: 'asc' | 'desc') => {
    const [, col] = selectedCell;
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next.sort((a, b) => {
        const av = (a[col] || '').toLowerCase();
        const bv = (b[col] || '').toLowerCase();
        return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      return next;
    });
  };

  const applyFormula = (kind: 'sum' | 'avg') => {
    const [row, col] = selectedCell;
    const nums = grid.map(r => Number(r[col])).filter(v => Number.isFinite(v));
    const value = kind === 'sum' ? nums.reduce((a, b) => a + b, 0) : (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
    updateCell(row, col, String(Number(value.toFixed(4))));
  };

  const getCellDisplayValue = (value: string, style?: CellStyle): string => {
    if (isFormula(value)) {
      try {
        const parser = new Parser();
        const parserResult = parser.parse(value.trim().slice(1));
        if (parserResult.error) return '#ERR';
        const result = parser.evaluate(parserResult.result, (id: string) => {
          const match = id.match(/^([A-Z]+)(\d+)$/i);
          if (!match) return undefined;
          const col = match[1].toUpperCase().split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          const row = parseInt(match[2]) - 1;
          const cellVal = grid[row]?.[col] || '';
          return isNumericLiteral(cellVal) ? parseFloat(cellVal) : cellVal;
        });
        if (typeof result === 'number') {
          return formatNumber(result, style?.numberFormat);
        }
        return String(result ?? '#ERR');
      } catch { return '#ERR'; }
    }
    if (style?.numberFormat && style.numberFormat !== 'general' && isNumericLiteral(value)) {
      return formatNumber(parseFloat(value), style.numberFormat);
    }
    return value;
  };

  const formatNumber = (num: number, fmt?: string): string => {
    switch (fmt) {
      case 'currency': return `$${num.toFixed(2)}`;
      case 'percent': return `${(num * 100).toFixed(1)}%`;
      case 'date': {
        const d = new Date((num - 25569) * 86400 * 1000);
        if (isNaN(d.getTime())) return String(num);
        return d.toLocaleDateString();
      }
      default: return String(num);
    }
  };

  const applyNumberFormat = (fmt: string) => {
    const [row, col] = selectedCell;
    setCellStyles(prev => prev.map((r, ri) =>
      ri === row ? r.map((c, ci) => ci === col ? { ...c, numberFormat: fmt as CellStyle['numberFormat'] } : c) : r
    ));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Opening spreadsheet…</span>
      </div>
    );
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Title bar */}
        <div className="bg-[#217346] dark:bg-[#1a5c37] text-white">
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              <span className="text-sm font-semibold">{file.name}</span>
            </div>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7" onClick={save}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
          <div className="flex items-center gap-1 px-2 text-xs bg-[#217346]/80 dark:bg-[#1a5c37]/80">
            {(['home', 'insert', 'formulas', 'data', 'review', 'view'] as const).map(tab => (
              <span
                key={tab}
                className={cn(
                  "px-3 py-1 rounded-t cursor-pointer capitalize",
                  ribbonTab === tab ? "bg-white/20 font-medium" : "hover:bg-white/10"
                )}
                onClick={() => setRibbonTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Ribbon */}
        <div className="bg-background border-b border-border flex items-center gap-1 px-3 py-1.5 min-h-[40px]">
          {ribbonTab === 'home' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={undo}><Undo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={redo}><Redo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, fontWeight: s.fontWeight === 'bold' ? 'normal' : 'bold' }))}><Bold className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' }))}><Italic className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, textDecoration: s.textDecoration === 'underline' ? 'none' : 'underline' }))}><Underline className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Select value={cellStyles[selectedCell[0]]?.[selectedCell[1]]?.numberFormat || 'general'} onValueChange={applyNumberFormat}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general" className="text-xs">General</SelectItem>
                    <SelectItem value="number" className="text-xs">Number</SelectItem>
                    <SelectItem value="currency" className="text-xs">Currency</SelectItem>
                    <SelectItem value="percent" className="text-xs">Percent</SelectItem>
                    <SelectItem value="date" className="text-xs">Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, textAlign: 'left' }))}><AlignLeft className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, textAlign: 'center' }))}><AlignCenter className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, textAlign: 'right' }))}><AlignRight className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={mergeCells}><Maximize2 className="w-3.5 h-3.5" /> Merge</Button></TooltipTrigger><TooltipContent>Merge Cells</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={unmergeCells}><X className="w-3.5 h-3.5" /> Unmerge</Button></TooltipTrigger><TooltipContent>Unmerge Cells</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'insert' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={addTableBlock}><Table className="w-3.5 h-3.5" /> Table</Button></TooltipTrigger><TooltipContent>Insert Table</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertChartRef}><BarChart3 className="w-3.5 h-3.5" /> Chart</Button></TooltipTrigger><TooltipContent>Insert Chart</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertPictureRef}><Image className="w-3.5 h-3.5" /> Picture</Button></TooltipTrigger><TooltipContent>Insert Picture</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertLink}><Link className="w-3.5 h-3.5" /> Link</Button></TooltipTrigger><TooltipContent>Insert Link</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'formulas' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => applyFormula('sum')}><Sigma className="w-3.5 h-3.5" /> AutoSum</Button></TooltipTrigger><TooltipContent>AutoSum</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => applyFormula('avg')}><Calculator className="w-3.5 h-3.5" /> Financial</Button></TooltipTrigger><TooltipContent>Financial Functions</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => updateCell(selectedCell[0], selectedCell[1], '=VLOOKUP(value,range,col,FALSE)')}><Search className="w-3.5 h-3.5" /> Lookup</Button></TooltipTrigger><TooltipContent>Lookup & Reference</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'data' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => sortSelectedColumn('asc')}><SortAsc className="w-3.5 h-3.5" /> Sort A-Z</Button></TooltipTrigger><TooltipContent>Sort Ascending</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => sortSelectedColumn('desc')}><SortDesc className="w-3.5 h-3.5" /> Sort Z-A</Button></TooltipTrigger><TooltipContent>Sort Descending</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={applyFilter}><Filter className="w-3.5 h-3.5" /> Filter</Button></TooltipTrigger><TooltipContent>Filter</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={customSort}><ArrowDownUp className="w-3.5 h-3.5" /> Sort</Button></TooltipTrigger><TooltipContent>Custom Sort</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={textToColumns}><Columns className="w-3.5 h-3.5" /> Text to Columns</Button></TooltipTrigger><TooltipContent>Text to Columns</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'review' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={findInSheet}><Search className="w-3.5 h-3.5" /> Find</Button></TooltipTrigger><TooltipContent>Find</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => updateCell(selectedCell[0], selectedCell[1], `${grid[selectedCell[0]]?.[selectedCell[1]] || ''} [comment]`)}><Eye className="w-3.5 h-3.5" /> Show Comments</Button></TooltipTrigger><TooltipContent>Show Comments</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'view' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => gridRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}><Eye className="w-3.5 h-3.5" /> Normal</Button></TooltipTrigger><TooltipContent>Normal View</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setSelectedCell([0, selectedCell[1]])}><Columns className="w-3.5 h-3.5" /> Freeze Panes</Button></TooltipTrigger><TooltipContent>Freeze Panes</TooltipContent></Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Formula bar */}
        <div className="flex items-center border-b border-border bg-background">
          <div className="w-20 px-2 py-1 border-r border-border text-xs font-mono text-center bg-muted/30 flex items-center justify-between">
            <span>{colLabel(selectedCell[1])}{selectedCell[0] + 1}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="px-2 py-1 border-r border-border text-xs text-muted-foreground">
            <span className="italic">fx</span>
          </div>
          <Input
            className="flex-1 h-7 border-0 rounded-none text-xs font-mono focus-visible:ring-0"
            value={formulaBarValue}
            onChange={e => {
              setFormulaBarValue(e.target.value);
              updateCell(selectedCell[0], selectedCell[1], e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setSelectedCell([Math.min(DEFAULT_ROWS - 1, selectedCell[0] + 1), selectedCell[1]]);
              }
            }}
          />
        </div>

        {/* Grid */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto focus:outline-none"
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
        >
          <div style={{ width: colVirtualizer.getTotalSize(), height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {/* Column headers */}
            <div className="sticky top-0 z-10 flex" style={{ height: 24 }}>
              <div className="sticky left-0 z-20 w-10 shrink-0 bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground" />
              {colVirtualizer.getVirtualItems().map(col => (
                <div
                  key={col.key}
                  className={cn(
                    "border border-border bg-muted font-medium text-muted-foreground px-1 py-0.5 flex items-center text-xs shrink-0",
                    selectedCell[1] === col.index && "bg-primary/10 text-primary font-semibold"
                  )}
                  style={{ width: colWidths[col.index], minWidth: colWidths[col.index], left: col.start, position: 'absolute', top: 0, height: 24 }}
                >
                  {colLabel(col.index)}
                </div>
              ))}
            </div>
            {/* Rows */}
            {rowVirtualizer.getVirtualItems().map(row => {
              const rowIdx = row.index;
              const virtualCols = colVirtualizer.getVirtualItems();
              return (
                <div
                  key={row.key}
                  style={{ position: 'absolute', top: row.start + 24, left: 0, height: row.size, width: colVirtualizer.getTotalSize(), display: 'flex' }}
                >
                  <div
                    className={cn(
                      "sticky left-0 z-10 w-10 shrink-0 border border-border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground",
                      selectedCell[0] === rowIdx && "bg-primary/10 text-primary font-semibold"
                    )}
                    style={{ height: 28 }}
                  >
                    {rowIdx + 1}
                  </div>
                  {virtualCols.map(col => {
                    const colIdx = col.index;
                    const cell = grid[rowIdx]?.[colIdx] || '';
                    const isSelected = selectedCell[0] === rowIdx && selectedCell[1] === colIdx;
                    const isEditing = editingCell?.[0] === rowIdx && editingCell?.[1] === colIdx;
                    const merge = isCellMerged(rowIdx, colIdx);
                    const isMergeMain = merge && merge.fromRow === rowIdx && merge.fromCol === colIdx;

                    if (merge && !(merge.fromRow === rowIdx && merge.fromCol === colIdx)) {
                      return null;
                    }

                    return (
                      <div
                        key={col.key}
                        className={cn(
                          "border border-border p-0 relative flex items-center shrink-0",
                          isSelected && "ring-2 ring-primary ring-inset z-[5]"
                        )}
                        style={{ 
                          width: merge ? colWidths.slice(merge.fromCol, merge.toCol + 1).reduce((a, b) => a + b, 0) : colWidths[colIdx],
                          minWidth: merge ? colWidths.slice(merge.fromCol, merge.toCol + 1).reduce((a, b) => a + b, 0) : colWidths[colIdx],
                          height: merge ? (merge.toRow - merge.fromRow + 1) * 28 : 28,
                          left: col.start,
                          position: 'absolute',
                          top: 0
                        }}
                        onClick={() => {
                          setSelectedCell([rowIdx, colIdx]);
                          setEditingCell(null);
                        }}
                        onDoubleClick={() => setEditingCell([rowIdx, colIdx])}
                      >
                        {isEditing ? (
                          <input
                            className="w-full h-full px-1 py-0.5 outline-none bg-white dark:bg-[#2d2d2d] text-xs font-mono"
                            value={cell}
                            autoFocus
                            onChange={e => updateCell(rowIdx, colIdx, e.target.value)}
                            onKeyDown={e => handleCellKeyDown(e, rowIdx, colIdx)}
                            onBlur={() => setEditingCell(null)}
                          />
                        ) : (
                          <div className="px-1 py-0.5 truncate w-full text-xs" style={{
                            fontWeight: cellStyles[rowIdx]?.[colIdx]?.fontWeight,
                            fontStyle: cellStyles[rowIdx]?.[colIdx]?.fontStyle,
                            textDecoration: cellStyles[rowIdx]?.[colIdx]?.textDecoration,
                            textAlign: cellStyles[rowIdx]?.[colIdx]?.textAlign
                          }}>
                            {getCellDisplayValue(cell, cellStyles[rowIdx]?.[colIdx])}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sheet tabs */}
        <div className="flex items-center border-t border-border bg-background h-8 overflow-x-auto">
          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-none flex-shrink-0" onClick={addSheet}>
            <Plus className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-0">
            {sheets.map((sheet, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs border-r border-border cursor-pointer flex-shrink-0 select-none group relative",
                  idx === activeSheetIdx
                    ? "bg-background font-medium border-t-2 border-t-[#217346]"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
                onClick={() => {
                  setActiveSheetIdx(idx);
                  setRenamingSheetIdx(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const action = window.confirm(`Delete sheet "${sheet.name}"?`) ? 'delete' : 'rename';
                  if (action === 'delete') {
                    deleteSheet(idx);
                  } else {
                    setRenamingSheetIdx(idx);
                  }
                }}
              >
                {renamingSheetIdx === idx ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={sheet.name}
                    onChange={(e) => {
                      setSheets(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s));
                    }}
                    onBlur={() => {
                      renameSheet(idx, sheet.name);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameSheet(idx, sheet.name);
                      } else if (e.key === 'Escape') {
                        setRenamingSheetIdx(null);
                      }
                    }}
                    className="w-24 px-1 text-xs border border-border rounded"
                    autoFocus
                  />
                ) : (
                  <>
                    <span>{sheet.name}</span>
                    {idx === activeSheetIdx && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSheet(idx);
                        }}
                      >
                        <X className="w-2.5 h-2.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1" />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-0.5 bg-[#217346] dark:bg-[#1a5c37] text-white text-xs">
          <span>Ready</span>
          <span>{file.name}</span>
        </div>
      </div>
    </TooltipProvider>
  );
};
