import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { FileNode } from '@/types/ide';
import {
  FileSpreadsheet, Save, Bold, Italic, Underline as UnderlineIcon,
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
import { ShortcutsGuide } from './ShortcutsGuide';
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
  fillColor?: string;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
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
  const [rowHeights, setRowHeights] = useState<number[]>(Array(DEFAULT_ROWS).fill(28));
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
  const colResizeRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: DEFAULT_ROWS,
    getScrollElement: () => parentRef.current,
    estimateSize: (idx) => rowHeights[idx] || 28,
    overscan: 10,
  });

  const colVirtualizer = useVirtualizer({
    count: DEFAULT_COLS,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (colWidths[0] || 80),
    horizontal: true,
    overscan: 5,
  });

  const handleColResizeStart = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    colResizeRef.current = { index, startX: e.clientX, startWidth: colWidths[index] || 80 };
  }, [colWidths]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ref = colResizeRef.current;
      if (!ref) return;
      const dx = e.clientX - ref.startX;
      const newWidth = Math.max(40, ref.startWidth + dx);
      setColWidths(prev => {
        const next = [...prev];
        next[ref.index] = newWidth;
        return next;
      });
    };
    const handleMouseUp = () => {
      colResizeRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
        const sharedStrings = sharedStringsXml
          ? Array.from(parseXml(sharedStringsXml).getElementsByTagNameNS('*', 't')).map(n => n.textContent || '')
          : [];

        let sheetCount = 1;
        const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
        if (workbookXml) {
          const wb = parseXml(workbookXml);
          sheetCount = wb.getElementsByTagNameNS('*', 'sheet').length || 1;
        }

        const loadedSheets: Sheet[] = [];
        for (let s = 0; s < sheetCount; s++) {
          const sheetName = workbookXml ? (() => {
            const wb = parseXml(workbookXml);
            const sheets = wb.getElementsByTagNameNS('*', 'sheet');
            return sheets[s]?.getAttribute('name') || `Sheet${s + 1}`;
          })() : `Sheet${s + 1}`;

          const sheetXml = await zip.file(`xl/worksheets/sheet${s + 1}.xml`)?.async('string');
          const matrix = Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill(''));
          const merged: CellMerge[] = [];

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

            const mergeCells = Array.from(sheet.getElementsByTagNameNS('*', 'mergeCell'));
            for (const mc of mergeCells) {
              const ref = mc.getAttribute('ref') || '';
              const parts = ref.split(':');
              if (parts.length === 2) {
                const m1 = parts[0].match(/^([A-Z]+)(\d+)$/);
                const m2 = parts[1].match(/^([A-Z]+)(\d+)$/);
                if (m1 && m2) {
                  const col1 = m1[1].split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
                  const row1 = Number(m1[2]) - 1;
                  const col2 = m2[1].split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
                  const row2 = Number(m2[2]) - 1;
                  merged.push({ fromRow: row1, fromCol: col1, toRow: row2, toCol: col2 });
                }
              }
            }
          }
          loadedSheets.push({
            name: sheetName,
            grid: matrix,
            styles: Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill({ textAlign: 'left', numberFormat: 'general' })),
            mergedCells: merged,
          });
        }

        setSheets(loadedSheets);
        setActiveSheetIdx(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open spreadsheet');
      } finally {
        setLoading(false);
      }
    };
    load();
  // file.content intentionally excluded: re-loading on every save would reset edits
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  useEffect(() => {
    setFormulaBarValue(grid[selectedCell[0]]?.[selectedCell[1]] || '');
  }, [selectedCell, grid]);

  const save = useCallback(async () => {
    const baseBytes = lastZipBytesRef.current || (await buildNewXlsx());
    const zip = await JSZip.loadAsync(baseBytes);

    const allValues = sheets.flatMap(s => s.grid.flat()).filter(v => v.length > 0 && !isFormula(v) && !isNumericLiteral(v));
    const uniqueShared = Array.from(new Set(allValues));
    const sharedIndex = new Map(uniqueShared.map((v, i) => [v, i]));

    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${allValues.length}" uniqueCount="${uniqueShared.length}">${uniqueShared.map(v => `<si><t xml:space="preserve">${xmlEncode(v)}</t></si>`).join('')}</sst>`;
    zip.file('xl/sharedStrings.xml', sharedStringsXml);

    const sheetRels: string[] = [];
    const contentTypes: string[] = [];

    sheets.forEach((sheet, sIdx) => {
      const sheetNum = sIdx + 1;
      const rowsXml = sheet.grid
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

      let mergeXml = '';
      if (sheet.mergedCells.length > 0) {
        mergeXml = '<mergeCells count="' + sheet.mergedCells.length + '">' +
          sheet.mergedCells.map(m =>
            `<mergeCell ref="${colLabel(m.fromCol)}${m.fromRow + 1}:${colLabel(m.toCol)}${m.toRow + 1}"/>`
          ).join('') + '</mergeCells>';
      }

      zip.file(`xl/worksheets/sheet${sheetNum}.xml`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData>${mergeXml}</worksheet>`
      );

      sheetRels.push(`<Relationship Id="rId${sheetNum}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNum}.xml"/>`);
      contentTypes.push(`<Override PartName="/xl/worksheets/sheet${sheetNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    });

    zip.file('xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEncode(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
    );

    zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels.join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
    );

    const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentTypes.join('')}
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
    zip.file('[Content_Types].xml', ctXml);

    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    lastZipBytesRef.current = out;
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', out));
  }, [file.id, sheets, onContentChange]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (loading || sheets.length === 0) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    const timer = setTimeout(() => {
      save();
    }, 500);
    return () => clearTimeout(timer);
  }, [sheets, loading, save]);

  const pushHistory = () => {
    historyRef.current.push(grid.map(r => [...r]));
    if (historyRef.current.length > 50) historyRef.current.shift();
  };

  const updateCell = (row: number, col: number, value: string) => {
    pushHistory();
    redoRef.current = [];
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = value;
      return next;
    });
    if (row === selectedCell[0] && col === selectedCell[1]) {
      setFormulaBarValue(value);
    }
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

  const insertRowAbove = () => {
    const [row] = selectedCell;
    setSheets(prev => prev.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const newRow = Array(DEFAULT_COLS).fill('');
      const newStyles = Array(DEFAULT_COLS).fill({ textAlign: 'left', numberFormat: 'general' });
      const grid = [...s.grid.slice(0, row), newRow, ...s.grid.slice(row)];
      const styles = [...s.styles.slice(0, row), newStyles, ...s.styles.slice(row)];
      return { ...s, grid: grid.slice(0, DEFAULT_ROWS), styles: styles.slice(0, DEFAULT_ROWS) };
    }));
  };

  const insertRowBelow = () => {
    const [row] = selectedCell;
    setSheets(prev => prev.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const newRow = Array(DEFAULT_COLS).fill('');
      const newStyles = Array(DEFAULT_COLS).fill({ textAlign: 'left', numberFormat: 'general' });
      const grid = [...s.grid.slice(0, row + 1), newRow, ...s.grid.slice(row + 1)];
      const styles = [...s.styles.slice(0, row + 1), newStyles, ...s.styles.slice(row + 1)];
      return { ...s, grid: grid.slice(0, DEFAULT_ROWS), styles: styles.slice(0, DEFAULT_ROWS) };
    }));
  };

  const insertColumnLeft = () => {
    const [, col] = selectedCell;
    setSheets(prev => prev.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      return {
        ...s,
        grid: s.grid.map(row => [...row.slice(0, col), '', ...row.slice(col)].slice(0, DEFAULT_COLS)),
        styles: s.styles.map(row => [...row.slice(0, col), { textAlign: 'left', numberFormat: 'general' }, ...row.slice(col)].slice(0, DEFAULT_COLS)),
      };
    }));
  };

  const insertColumnRight = () => {
    const [, col] = selectedCell;
    setSheets(prev => prev.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      return {
        ...s,
        grid: s.grid.map(row => [...row.slice(0, col + 1), '', ...row.slice(col + 1)].slice(0, DEFAULT_COLS)),
        styles: s.styles.map(row => [...row.slice(0, col + 1), { textAlign: 'left', numberFormat: 'general' }, ...row.slice(col + 1)].slice(0, DEFAULT_COLS)),
      };
    }));
  };

  const deleteRow = () => {
    const [row] = selectedCell;
    setSheets(prev => prev.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const grid = s.grid.filter((_, i) => i !== row);
      const styles = s.styles.filter((_, i) => i !== row);
      while (grid.length < DEFAULT_ROWS) grid.push(Array(DEFAULT_COLS).fill(''));
      while (styles.length < DEFAULT_ROWS) styles.push(Array(DEFAULT_COLS).fill({ textAlign: 'left', numberFormat: 'general' }));
      return { ...s, grid, styles };
    }));
    setSelectedCell([Math.min(row, DEFAULT_ROWS - 2), selectedCell[1]]);
  };

  const deleteColumn = () => {
    const [, col] = selectedCell;
    setSheets(prev => prev.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      return {
        ...s,
        grid: s.grid.map(row => {
          const next = row.filter((_, i) => i !== col);
          while (next.length < DEFAULT_COLS) next.push('');
          return next;
        }),
        styles: s.styles.map(row => {
          const next = row.filter((_, i) => i !== col);
          while (next.length < DEFAULT_COLS) next.push({ textAlign: 'left', numberFormat: 'general' });
          return next;
        }),
      };
    }));
    setSelectedCell([selectedCell[0], Math.min(col, DEFAULT_COLS - 2)]);
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
    if (redoRef.current.length > 50) redoRef.current.shift();
    setGrid(prev);
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(grid.map(r => [...r]));
    if (historyRef.current.length > 50) historyRef.current.shift();
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

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      const [r1, c1] = selectedRange?.[0] || [row, col];
      const [r2, c2] = selectedRange?.[1] || [row, col];
      const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
      const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
      const lines: string[] = [];
      for (let r = minR; r <= maxR; r++) {
        const cells: string[] = [];
        for (let c = minC; c <= maxC; c++) {
          cells.push(grid[r]?.[c] || '');
        }
        lines.push(cells.join('\t'));
      }
      navigator.clipboard.writeText(lines.join('\n'));
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const lines = text.split('\n').filter(l => l.length > 0);
        lines.forEach((line, rOffset) => {
          const cells = line.split('\t');
          cells.forEach((cell, cOffset) => {
            const targetRow = row + rOffset;
            const targetCol = col + cOffset;
            if (targetRow < DEFAULT_ROWS && targetCol < DEFAULT_COLS) {
              updateCell(targetRow, targetCol, cell);
            }
          });
        });
      });
      return;
    }

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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const [row, col] = selectedCell;
        updateCell(row, col, `[IMG:${reader.result}]`);
      };
      reader.readAsDataURL(f);
    };
    input.click();
  };

  const insertChartRef = () => {
    const [row, col] = selectedCell;
    const currentCol = col;
    const values: number[] = [];
    for (let r = 0; r < DEFAULT_ROWS; r++) {
      const v = parseFloat(grid[r][currentCol]);
      if (!isNaN(v)) values.push(v);
    }
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      updateCell(row, col, `[CHART sum=${sum.toFixed(2)} avg=${avg.toFixed(2)} min=${min} max=${max}]`);
    } else {
      updateCell(row, col, '[CHART: no numeric data in column]');
    }
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

  const [sortHasHeaders, setSortHasHeaders] = useState(true);

  const sortSelectedColumn = (direction: 'asc' | 'desc') => {
    const [, col] = selectedCell;
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      const startIdx = sortHasHeaders ? 1 : 0;
      const header = sortHasHeaders ? next[0] : null;
      const data = header ? next.slice(1) : next;
      data.sort((a, b) => {
        const av = (a[col] || '').toLowerCase();
        const bv = (b[col] || '').toLowerCase();
        return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      if (header) {
        return [header, ...data];
      }
      return data;
    });
  };

  const applyFormula = (kind: 'sum' | 'avg') => {
    const [row, col] = selectedCell;
    const nums = grid.map(r => Number(r[col])).filter(v => Number.isFinite(v));
    const value = kind === 'sum' ? nums.reduce((a, b) => a + b, 0) : (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
    updateCell(row, col, String(Number(value.toFixed(4))));
  };

  const isImageCell = (value: string) => value.startsWith('[IMG:');
  const isChartCell = (value: string) => value.startsWith('[CHART');

  const getCellDisplayValue = (value: string, style?: CellStyle): string => {
    if (isImageCell(value)) return '[IMAGE]';
    if (isChartCell(value)) return value.split(']')[0] + ']';
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
    const fileSize = new Blob([file.content || '']).size;
    const showProgress = fileSize > 1024 * 1024;
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        {showProgress && (
          <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Opening spreadsheet{showProgress ? ` (${(fileSize / (1024 * 1024)).toFixed(1)} MB)` : ''}...</span>
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
            <ShortcutsGuide />
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
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyStyle(s => ({ ...s, textDecoration: s.textDecoration === 'underline' ? 'none' : 'underline' }))}><UnderlineIcon className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild>
                  <label className="h-7 px-1.5 rounded hover:bg-muted/50 flex items-center cursor-pointer" title="Fill Color">
                    <span className="text-[10px] mr-0.5">▨</span>
                    <input
                      type="color"
                      className="h-3.5 w-3.5 border-0 p-0 bg-transparent cursor-pointer"
                      value={cellStyles[selectedCell[0]]?.[selectedCell[1]]?.fillColor || '#ffffff'}
                      onChange={(e) => applyStyle(s => ({ ...s, fillColor: e.target.value === '#ffffff' ? undefined : e.target.value }))}
                    />
                  </label>
                </TooltipTrigger><TooltipContent>Fill Color</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <label className="h-7 px-1.5 rounded hover:bg-muted/50 flex items-center cursor-pointer" title="Border Color">
                    <span className="text-[10px] mr-0.5">▢</span>
                    <input
                      type="color"
                      className="h-3.5 w-3.5 border-0 p-0 bg-transparent cursor-pointer"
                      value="#000000"
                      onChange={(e) => {
                        const c = e.target.value;
                        applyStyle(s => ({ ...s, borderTop: c, borderBottom: c, borderLeft: c, borderRight: c }));
                      }}
                    />
                  </label>
                </TooltipTrigger><TooltipContent>Border</TooltipContent></Tooltip>
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
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={mergeCells}><Maximize2 className="w-3.5 h-3.5" /> Merge</Button></TooltipTrigger><TooltipContent>Merge Cells</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={unmergeCells}><X className="w-3.5 h-3.5" /> Unmerge</Button></TooltipTrigger><TooltipContent>Unmerge Cells</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertRowAbove}>Row ↑</Button></TooltipTrigger><TooltipContent>Insert Row Above</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertRowBelow}>Row ↓</Button></TooltipTrigger><TooltipContent>Insert Row Below</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertColumnLeft}>Col ←</Button></TooltipTrigger><TooltipContent>Insert Column Left</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertColumnRight}>Col →</Button></TooltipTrigger><TooltipContent>Insert Column Right</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" onClick={deleteRow}>Del Row</Button></TooltipTrigger><TooltipContent>Delete Row</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" onClick={deleteColumn}>Del Col</Button></TooltipTrigger><TooltipContent>Delete Column</TooltipContent></Tooltip>
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
              <div className="flex items-center gap-0.5 pl-2 border-l border-border">
                <Tooltip><TooltipTrigger asChild>
                  <label className="h-7 px-2 rounded hover:bg-muted/50 flex items-center cursor-pointer text-xs gap-1">
                    <span>↑ CSV</span>
                    <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const text = reader.result as string;
                        text.split('\n').forEach((line, r) => {
                          line.split('\t').forEach((cell, c) => {
                            if (r < DEFAULT_ROWS && c < DEFAULT_COLS) updateCell(r, c, cell.replace(/"/g, ''));
                          });
                        });
                      };
                      reader.readAsText(f);
                      e.target.value = '';
                    }} />
                  </label>
                </TooltipTrigger><TooltipContent>Import CSV</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => {
                    const csv = grid.map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${file.name.replace(/\.[^/.]+$/, '')}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    <span>↓ CSV</span>
                  </Button>
                </TooltipTrigger><TooltipContent>Export CSV</TooltipContent></Tooltip>
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
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant={sortHasHeaders ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setSortHasHeaders(h => !h)}>
                    {sortHasHeaders ? 'Headers' : 'No Headers'}
                  </Button>
                </TooltipTrigger><TooltipContent>Toggle Header Row</TooltipContent></Tooltip>
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
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
                    onMouseDown={e => handleColResizeStart(e, col.index)}
                  />
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
                      style={{ height: rowHeights[rowIdx] || 28 }}
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
                          height: merge ? rowHeights.slice(merge.fromRow, merge.toRow + 1).reduce((a, b) => a + b, 0) : (rowHeights[rowIdx] || 28),
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
                          <div className="px-1 py-0.5 truncate w-full text-xs flex items-center" style={{
                            fontWeight: cellStyles[rowIdx]?.[colIdx]?.fontWeight,
                            fontStyle: cellStyles[rowIdx]?.[colIdx]?.fontStyle,
                            textDecoration: cellStyles[rowIdx]?.[colIdx]?.textDecoration,
                            textAlign: cellStyles[rowIdx]?.[colIdx]?.textAlign,
                            backgroundColor: cellStyles[rowIdx]?.[colIdx]?.fillColor || undefined,
                            borderTop: cellStyles[rowIdx]?.[colIdx]?.borderTop ? `1px solid ${cellStyles[rowIdx][colIdx].borderTop}` : undefined,
                            borderBottom: cellStyles[rowIdx]?.[colIdx]?.borderBottom ? `1px solid ${cellStyles[rowIdx][colIdx].borderBottom}` : undefined,
                            borderLeft: cellStyles[rowIdx]?.[colIdx]?.borderLeft ? `1px solid ${cellStyles[rowIdx][colIdx].borderLeft}` : undefined,
                            borderRight: cellStyles[rowIdx]?.[colIdx]?.borderRight ? `1px solid ${cellStyles[rowIdx][colIdx].borderRight}` : undefined,
                          }}>
                            {isImageCell(cell) ? (
                              <img
                                src={cell.slice(5, -1)}
                                alt=""
                                className="max-w-full max-h-full object-contain"
                                style={{ maxHeight: (rowHeights[rowIdx] || 28) - 4 }}
                              />
                            ) : (
                              getCellDisplayValue(cell, cellStyles[rowIdx]?.[colIdx])
                            )}
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
