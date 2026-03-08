import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { FileNode } from '@/types/ide';
import { FileSpreadsheet, FileText, Presentation, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type OfficeType = 'docx' | 'xlsx' | 'pptx';

interface OfficeEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

const xmlEncode = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const decodeDataUrl = (content: string): Uint8Array | null => {
  if (!content) return null;
  const base64 = content.startsWith('data:') ? content.split(',')[1] || '' : content;
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encodeDataUrl = (mime: string, bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

const buildNewDocx = async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t></w:t></w:r></w:p></w:body></w:document>`);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
};

const buildNewPptx = async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  zip.folder('ppt')?.file('presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`);
  zip.folder('ppt')?.folder('_rels')?.file('presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`);
  zip.folder('ppt')?.folder('slides')?.file('slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t></a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
};

const buildNewXlsx = async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder('xl')?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`);
  zip.folder('xl')?.file('sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"></sst>`);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
};

const getOfficeType = (name: string): OfficeType | null => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'pptx') return 'pptx';
  return null;
};

export const OfficeEditor = ({ file, onContentChange }: OfficeEditorProps) => {
  const officeType = useMemo(() => getOfficeType(file.name), [file.name]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docText, setDocText] = useState('');
  const [slides, setSlides] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);

  useEffect(() => {
    const load = async () => {
      if (!officeType) return;
      setLoading(true);
      setError(null);
      try {
        let bytes = decodeDataUrl(file.content || '');
        if (!bytes) {
          bytes = officeType === 'docx' ? await buildNewDocx() : officeType === 'xlsx' ? await buildNewXlsx() : await buildNewPptx();
          const mime = officeType === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : officeType === 'xlsx'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          onContentChange(file.id, encodeDataUrl(mime, bytes));
        }
        const zip = await JSZip.loadAsync(bytes);

        if (officeType === 'docx') {
          const xml = await zip.file('word/document.xml')?.async('string');
          if (!xml) throw new Error('Missing word/document.xml');
          const doc = parseXml(xml);
          const texts = Array.from(doc.getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '');
          setDocText(texts.join('\n'));
        }

        if (officeType === 'pptx') {
          const slideFiles = Object.keys(zip.files)
            .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          const parsedSlides: string[] = [];
          for (const slideFile of slideFiles) {
            const xml = await zip.file(slideFile)?.async('string');
            if (!xml) continue;
            const doc = parseXml(xml);
            const text = Array.from(doc.getElementsByTagNameNS('*', 't')).map((n) => n.textContent || '').join('\n');
            parsedSlides.push(text);
          }
          setSlides(parsedSlides.length ? parsedSlides : ['']);
        }

        if (officeType === 'xlsx') {
          const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
          const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
          const sharedStrings = sharedStringsXml
            ? Array.from(parseXml(sharedStringsXml).getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '')
            : [];
          const defaultRows = 20;
          const defaultCols = 10;
          const matrix = Array.from({ length: defaultRows }, () => Array.from({ length: defaultCols }, () => ''));
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
              for (let i = 0; i < colName.length; i += 1) col = col * 26 + (colName.charCodeAt(i) - 64);
              col -= 1;
              if (row < 0 || col < 0 || row >= defaultRows || col >= defaultCols) continue;
              const v = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
              matrix[row][col] = cell.getAttribute('t') === 's' ? (sharedStrings[Number(v)] || '') : v;
            }
          }
          setGrid(matrix);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to open this office document');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [file.id, file.content, officeType, onContentChange]);

  const saveDocx = async () => {
    const bytes = decodeDataUrl(file.content || '') || (await buildNewDocx());
    const zip = await JSZip.loadAsync(bytes);
    const paragraphs = docText.split('\n').map((line) => `<w:p><w:r><w:t xml:space="preserve">${xmlEncode(line)}</w:t></w:r></w:p>`).join('');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs || '<w:p><w:r><w:t></w:t></w:r></w:p>'}</w:body></w:document>`);
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))));
  };

  const savePptx = async () => {
    const bytes = decodeDataUrl(file.content || '') || (await buildNewPptx());
    const zip = await JSZip.loadAsync(bytes);
    slides.forEach((slide, idx) => {
      const lines = slide.split('\n').map((line) => `<a:p><a:r><a:t>${xmlEncode(line)}</a:t></a:r></a:p>`).join('');
      zip.file(`ppt/slides/slide${idx + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${lines || '<a:p><a:r><a:t></a:t></a:r></a:p>'}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
    });
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))));
  };

  const saveXlsx = async () => {
    const bytes = decodeDataUrl(file.content || '') || (await buildNewXlsx());
    const zip = await JSZip.loadAsync(bytes);

    const sharedValues = grid.flat().filter((v) => v.length > 0);
    const uniqueShared = Array.from(new Set(sharedValues));
    const sharedIndex = new Map(uniqueShared.map((v, i) => [v, i]));

    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedValues.length}" uniqueCount="${uniqueShared.length}">${uniqueShared.map((v) => `<si><t xml:space="preserve">${xmlEncode(v)}</t></si>`).join('')}</sst>`;

    const rowsXml = grid
      .map((row, rowIdx) => {
        const cellsXml = row
          .map((value, colIdx) => {
            if (!value) return '';
            const col = String.fromCharCode(65 + colIdx);
            const ref = `${col}${rowIdx + 1}`;
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

    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))));
  };

  if (!officeType) return null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Opening document…</span>
      </div>
    );
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-editor overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-2 text-sm font-medium">
          {officeType === 'docx' && <FileText className="w-4 h-4 text-blue-500" />}
          {officeType === 'pptx' && <Presentation className="w-4 h-4 text-orange-500" />}
          {officeType === 'xlsx' && <FileSpreadsheet className="w-4 h-4 text-green-600" />}
          {file.name}
        </div>
        <Button size="sm" onClick={() => (officeType === 'docx' ? saveDocx() : officeType === 'pptx' ? savePptx() : saveXlsx())}>
          <Save className="w-4 h-4 mr-1" /> Save
        </Button>
      </div>

      {officeType === 'docx' && (
        <textarea
          className="flex-1 w-full resize-none bg-editor p-4 font-sans outline-none"
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          placeholder="Start writing your document…"
        />
      )}

      {officeType === 'pptx' && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {slides.map((slide, index) => (
              <div key={index} className="border border-border rounded-lg p-3 bg-background/60">
                <p className="text-xs font-medium text-muted-foreground mb-2">Slide {index + 1}</p>
                <textarea
                  className="w-full min-h-36 resize-y bg-editor p-3 rounded border border-border outline-none"
                  value={slide}
                  onChange={(e) => setSlides((prev) => prev.map((item, i) => (i === index ? e.target.value : item)))}
                />
              </div>
            ))}
            <Button variant="outline" onClick={() => setSlides((prev) => [...prev, ''])}>Add Slide</Button>
          </div>
        </ScrollArea>
      )}

      {officeType === 'xlsx' && (
        <ScrollArea className="flex-1">
          <div className="p-4 overflow-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-border px-2 py-1 bg-muted" />
                  {grid[0]?.map((_, colIdx) => (
                    <th key={colIdx} className="border border-border px-2 py-1 bg-muted min-w-28">
                      {String.fromCharCode(65 + colIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="border border-border px-2 py-1 bg-muted text-xs">{rowIdx + 1}</td>
                    {row.map((cell, colIdx) => (
                      <td key={colIdx} className="border border-border p-0">
                        <input
                          className="w-28 px-2 py-1 bg-editor outline-none"
                          value={cell}
                          onChange={(e) => {
                            const value = e.target.value;
                            setGrid((prev) => prev.map((r, rIdx) => (rIdx !== rowIdx ? r : r.map((c, cIdx) => (cIdx === colIdx ? value : c)))));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
