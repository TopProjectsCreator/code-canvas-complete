import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { FileNode } from '@/types/ide';
import {
  FileSpreadsheet, Save, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo,
  Plus, Loader2, ChevronDown, Table, Image, Link,
  BarChart3, Filter, SortAsc, SortDesc, Search,
  Eye, Columns, ArrowDownUp, Calculator, Sigma
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { decodeDataUrl, encodeDataUrl, parseXml, xmlEncode, buildNewXlsx } from './officeUtils';

interface ExcelEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
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

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;

export const ExcelEditor = ({ file, onContentChange }: ExcelEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<string[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number]>([0, 0]);
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [sheets] = useState(['Sheet1']);
  const [activeSheet] = useState(0);
  const [colWidths] = useState<number[]>(Array(DEFAULT_COLS).fill(80));
  const [ribbonTab, setRibbonTab] = useState<'home' | 'insert' | 'formulas' | 'data' | 'review' | 'view'>('home');
  const gridRef = useRef<HTMLDivElement>(null);

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
            matrix[row][col] = cell.getAttribute('t') === 's' ? (sharedStrings[Number(v)] || '') : v;
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
  }, [file.id, file.content, onContentChange]);

  useEffect(() => {
    setFormulaBarValue(grid[selectedCell[0]]?.[selectedCell[1]] || '');
  }, [selectedCell, grid]);

  const save = useCallback(async () => {
    const bytes = decodeDataUrl(file.content || '') || (await buildNewXlsx());
    const zip = await JSZip.loadAsync(bytes);

    const sharedValues = grid.flat().filter(v => v.length > 0);
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

    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', out));
  }, [file, grid, onContentChange]);

  const updateCell = (row: number, col: number, value: string) => {
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = value;
      return next;
    });
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
      setEditingCell([row, col]);
      updateCell(row, col, e.key);
    }
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
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Undo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Redo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Bold className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Italic className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Underline className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignLeft className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignCenter className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignRight className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'insert' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Table className="w-3.5 h-3.5" /> Table</Button></TooltipTrigger><TooltipContent>Insert Table</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Chart</Button></TooltipTrigger><TooltipContent>Insert Chart</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Image className="w-3.5 h-3.5" /> Picture</Button></TooltipTrigger><TooltipContent>Insert Picture</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Link className="w-3.5 h-3.5" /> Link</Button></TooltipTrigger><TooltipContent>Insert Link</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'formulas' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Sigma className="w-3.5 h-3.5" /> AutoSum</Button></TooltipTrigger><TooltipContent>AutoSum</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Calculator className="w-3.5 h-3.5" /> Financial</Button></TooltipTrigger><TooltipContent>Financial Functions</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Search className="w-3.5 h-3.5" /> Lookup</Button></TooltipTrigger><TooltipContent>Lookup & Reference</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'data' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><SortAsc className="w-3.5 h-3.5" /> Sort A-Z</Button></TooltipTrigger><TooltipContent>Sort Ascending</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><SortDesc className="w-3.5 h-3.5" /> Sort Z-A</Button></TooltipTrigger><TooltipContent>Sort Descending</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Filter className="w-3.5 h-3.5" /> Filter</Button></TooltipTrigger><TooltipContent>Filter</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><ArrowDownUp className="w-3.5 h-3.5" /> Sort</Button></TooltipTrigger><TooltipContent>Custom Sort</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Columns className="w-3.5 h-3.5" /> Text to Columns</Button></TooltipTrigger><TooltipContent>Text to Columns</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'review' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Search className="w-3.5 h-3.5" /> Find</Button></TooltipTrigger><TooltipContent>Find</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Eye className="w-3.5 h-3.5" /> Show Comments</Button></TooltipTrigger><TooltipContent>Show Comments</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {ribbonTab === 'view' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Eye className="w-3.5 h-3.5" /> Normal</Button></TooltipTrigger><TooltipContent>Normal View</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Columns className="w-3.5 h-3.5" /> Freeze Panes</Button></TooltipTrigger><TooltipContent>Freeze Panes</TooltipContent></Tooltip>
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
          ref={gridRef}
          className="flex-1 overflow-auto focus:outline-none"
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
        >
          <table className="border-collapse text-xs select-none" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 w-10 min-w-10 bg-muted border border-border" />
                {Array.from({ length: DEFAULT_COLS }, (_, i) => (
                  <th
                    key={i}
                    className={cn(
                      "border border-border bg-muted font-medium text-muted-foreground px-1 py-0.5",
                      selectedCell[1] === i && "bg-primary/10 text-primary font-semibold"
                    )}
                    style={{ width: colWidths[i], minWidth: colWidths[i] }}
                  >
                    {colLabel(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td
                    className={cn(
                      "sticky left-0 z-10 border border-border bg-muted text-center font-medium text-muted-foreground px-1 py-0",
                      selectedCell[0] === rowIdx && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    {rowIdx + 1}
                  </td>
                  {row.map((cell, colIdx) => {
                    const isSelected = selectedCell[0] === rowIdx && selectedCell[1] === colIdx;
                    const isEditing = editingCell?.[0] === rowIdx && editingCell?.[1] === colIdx;

                    return (
                      <td
                        key={colIdx}
                        className={cn(
                          "border border-border p-0 relative",
                          isSelected && "ring-2 ring-primary ring-inset z-[5]"
                        )}
                        style={{ width: colWidths[colIdx], minWidth: colWidths[colIdx] }}
                        onClick={() => {
                          setSelectedCell([rowIdx, colIdx]);
                          setEditingCell(null);
                        }}
                        onDoubleClick={() => setEditingCell([rowIdx, colIdx])}
                      >
                        {isEditing ? (
                          <input
                            className="w-full h-full px-1 py-0.5 outline-none bg-white dark:bg-[#2d2d2d] text-xs font-mono absolute inset-0 z-10"
                            value={cell}
                            autoFocus
                            onChange={e => updateCell(rowIdx, colIdx, e.target.value)}
                            onKeyDown={e => handleCellKeyDown(e, rowIdx, colIdx)}
                            onBlur={() => setEditingCell(null)}
                          />
                        ) : (
                          <div className="px-1 py-0.5 truncate h-[22px] leading-[22px]">
                            {cell}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sheet tabs */}
        <div className="flex items-center border-t border-border bg-background">
          <div className="flex items-center">
            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-none">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center">
            {sheets.map((sheet, idx) => (
              <div
                key={idx}
                className={cn(
                  "px-4 py-1 text-xs border-r border-border cursor-pointer",
                  idx === activeSheet
                    ? "bg-background font-medium border-t-2 border-t-[#217346]"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {sheet}
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
