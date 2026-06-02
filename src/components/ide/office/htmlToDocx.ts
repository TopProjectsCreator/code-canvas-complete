import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  UnderlineType, ExternalHyperlink, ImageRun, LevelFormat,
  Table, TableRow, TableCell,
} from 'docx';
import type { ParagraphChild } from 'docx';

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADING_MAP: Record<string, string> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

const HEADING_SIZES: Record<string, number> = {
  h1: 32, h2: 28, h3: 24, h4: 22, h5: 20, h6: 18,
};

const HEADING_SPACING: Record<string, { before: number; after: number }> = {
  h1: { before: 240, after: 120 },
  h2: { before: 200, after: 100 },
  h3: { before: 160, after: 80 },
  h4: { before: 140, after: 70 },
  h5: { before: 120, after: 60 },
  h6: { before: 120, after: 60 },
};

function dataUriToBytes(uri: string): { data: Uint8Array; mime: string } | null {
  const m = uri.match(/^data:(\w+\/\w+);base64,(.+)$/);
  if (!m) return null;
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes, mime: m[1] };
}

function mimeToImgType(mime: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/bmp') return 'bmp';
  return 'png';
}

function collectText(node: Node): string {
  let text = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'br' && tag !== 'img') {
        text += collectText(el);
      }
    }
  }
  return text;
}

function parseTextRuns(node: Node, opts?: { fontSize?: number; font?: string }): ParagraphChild[] {
  const children: ParagraphChild[] = [];
  const baseSize = opts?.fontSize ?? 22;
  const baseFont = opts?.font ?? 'Calibri';

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) {
        children.push(new TextRun({ text: child.textContent, size: baseSize, font: baseFont }));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        children.push(new TextRun({ break: 1 }));
      } else if (tag === 'strong' || tag === 'b') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, bold: true, size: baseSize, font: baseFont }));
      } else if (tag === 'em' || tag === 'i') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, italics: true, size: baseSize, font: baseFont }));
      } else if (tag === 'u') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, underline: { type: UnderlineType.SINGLE }, size: baseSize, font: baseFont }));
      } else if (tag === 's' || tag === 'strike' || tag === 'del') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, strike: true, size: baseSize, font: baseFont }));
      } else if (tag === 'code') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, font: 'Courier New', size: 20 }));
      } else if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        const linkText = collectText(el);
        if (href && linkText) {
          children.push(
            new ExternalHyperlink({
              children: [new TextRun({ text: linkText, style: 'Hyperlink', size: baseSize, font: baseFont, color: '0563C1', underline: { type: UnderlineType.SINGLE } })],
              link: href,
            })
          );
        } else if (linkText) {
          children.push(new TextRun({ text: linkText, size: baseSize, font: baseFont }));
        }
      } else if (tag === 'img') {
        const src = el.getAttribute('src') || '';
        const width = parseInt(el.getAttribute('width') || '', 10) || 200;
        const height = parseInt(el.getAttribute('height') || '', 10) || 150;
        const converted = dataUriToBytes(src);
        if (converted) {
          children.push(
            new ImageRun({
              type: mimeToImgType(converted.mime),
              data: converted.data,
              transformation: { width, height },
            })
          );
        }
      } else if (tag === 'sub') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, subScript: true, size: Math.round(baseSize * 0.65), font: baseFont }));
      } else if (tag === 'sup') {
        const text = collectText(el);
        if (text) children.push(new TextRun({ text, superScript: true, size: Math.round(baseSize * 0.65), font: baseFont }));
      } else {
        const inner = parseTextRuns(el, opts);
        children.push(...inner);
        if (inner.length === 0) {
          const text = collectText(el);
          if (text) children.push(new TextRun({ text, size: baseSize, font: baseFont }));
        }
      }
    }
  }

  return children;
}

function getTextAlignment(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = el.style.textAlign;
  if (align && ALIGN_MAP[align]) return ALIGN_MAP[align];
  return undefined;
}

function buildParagraph(el: HTMLElement, tag: string): Paragraph | null {
  const alignment = getTextAlignment(el);

  if (tag.match(/^h[1-6]$/)) {
    const level = parseInt(tag[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const headingLevel = HEADING_MAP[tag];
    const size = HEADING_SIZES[tag] || 22;
    const spacing = HEADING_SPACING[tag] || { before: 0, after: 0 };

    const children = parseTextRuns(el, { fontSize: size });
    if (children.length === 0) return null;

    return new Paragraph({
      heading: headingLevel,
      children,
      alignment,
      spacing: { before: spacing.before, after: spacing.after },
    });
  }

  const children = parseTextRuns(el, { fontSize: 22 });
  if (children.length > 0) {
    return new Paragraph({
      children,
      alignment,
      spacing: { after: 160, line: 276 },
    });
  }

  return null;
}

function processList(el: HTMLElement, tag: string, level: number = 0): Paragraph[] {
  const result: Paragraph[] = [];
  const isOrdered = tag === 'ol';

  for (const li of Array.from(el.children).filter(c => c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName.toLowerCase() === 'li')) {
    const liEl = li as HTMLElement;
    const innerParagraphs: Paragraph[] = [];

    for (const child of Array.from(liEl.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as HTMLElement;
        const childTag = childEl.tagName.toLowerCase();

        if (childTag === 'p') {
          const children = parseTextRuns(childEl, { fontSize: 22 });
          if (children.length > 0) {
            innerParagraphs.push(new Paragraph({
              children,
              spacing: { after: 0, line: 276 },
              indent: { left: 720 * (level + 1) },
              ...(isOrdered
                ? { numbering: { reference: 'ordered-list', level } }
                : { bullet: { level } }),
            }));
          }
        } else if (childTag === 'ul' || childTag === 'ol') {
          innerParagraphs.push(...processList(childEl, childTag, level + 1));
        } else {
          const children = parseTextRuns(childEl, { fontSize: 22 });
          if (children.length > 0) {
            innerParagraphs.push(new Paragraph({
              children,
              spacing: { after: 0, line: 276 },
              indent: { left: 720 * (level + 1) },
              ...(isOrdered
                ? { numbering: { reference: 'ordered-list', level } }
                : { bullet: { level } }),
            }));
          }
        }
      }
    }

    if (innerParagraphs.length === 0) {
      const text = liEl.textContent?.trim();
      if (text) {
        innerParagraphs.push(new Paragraph({
          children: [new TextRun({ text, size: 22, font: 'Calibri' })],
          spacing: { after: 0, line: 276 },
          indent: { left: 720 * (level + 1) },
          ...(isOrdered
            ? { numbering: { reference: 'ordered-list', level } }
            : { bullet: { level } }),
        }));
      }
    }

    result.push(...innerParagraphs);
  }

  return result;
}

function processTable(el: HTMLElement): Table {
  const rows: TableRow[] = [];
  for (const tr of Array.from(el.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr'))) {
    const cells: TableCell[] = [];
    for (const td of Array.from(tr.querySelectorAll(':scope > td, :scope > th'))) {
      const tdEl = td as HTMLElement;
      const isHeader = tdEl.tagName.toLowerCase() === 'th';
      const cellChildren: (Paragraph | Table)[] = [];

      for (const child of Array.from(tdEl.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as HTMLElement;
          const childTag = childEl.tagName.toLowerCase();
          if (childTag === 'p') {
            const p = buildParagraph(childEl, 'p');
            if (p) cellChildren.push(p);
          } else if (childTag === 'ul' || childTag === 'ol') {
            cellChildren.push(...processList(childEl, childTag));
          } else if (childTag === 'br') {
            // ignore
          } else {
            const p = buildParagraph(childEl, childTag);
            if (p) cellChildren.push(p);
          }
        }
      }

      if (cellChildren.length === 0) {
        cellChildren.push(new Paragraph({
          children: [new TextRun({ text: tdEl.textContent || '', size: 22, font: 'Calibri' })],
          spacing: { after: 0, line: 276 },
        }));
      }

      cells.push(new TableCell({
        children: cellChildren,
        ...(isHeader ? { shading: { type: 'clear', fill: 'F2F2F2' } } : {}),
      }));
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows });
}

function buildBlockElements(html: string): (Paragraph | Table)[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const result: (Paragraph | Table)[] = [];

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        result.push(new Paragraph({
          children: [new TextRun({ text, size: 22, font: 'Calibri' })],
          spacing: { after: 160, line: 276 },
        }));
      }
      continue;
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'p') {
      const p = buildParagraph(el, 'p');
      if (p) result.push(p);
    } else if (tag.match(/^h[1-6]$/)) {
      const p = buildParagraph(el, tag);
      if (p) result.push(p);
    } else if (tag === 'ul' || tag === 'ol') {
      result.push(...processList(el, tag));
    } else if (tag === 'table') {
      result.push(processTable(el));
    } else if (tag === 'blockquote') {
      const children = parseTextRuns(el, { fontSize: 22 });
      if (children.length > 0) {
        result.push(new Paragraph({
          children,
          spacing: { after: 160, line: 276 },
          indent: { left: 720, right: 720 },
        }));
      }
    } else if (tag === 'pre') {
      const codeEl = el.querySelector('code');
      const text = (codeEl || el).textContent || '';
      if (text.trim()) {
        result.push(new Paragraph({
          children: [new TextRun({ text, font: 'Courier New', size: 20 })],
          spacing: { after: 160, line: 276 },
          indent: { left: 360 },
        }));
      }
    } else if (tag === 'hr') {
      result.push(new Paragraph({
        thematicBreak: true,
        spacing: { before: 160, after: 160 },
      }));
    } else if (tag === 'div') {
      const inner = buildBlockElements(el.innerHTML);
      result.push(...inner);
    } else {
      const p = buildParagraph(el, tag);
      if (p) result.push(p);
    }
  }

  return result;
}

const ORDERED_LEVELS = [0, 1, 2, 3, 4, 5].map(level => ({
  level,
  format: level === 0 ? LevelFormat.DECIMAL :
           level === 1 ? LevelFormat.LOWER_LETTER :
           level === 2 ? LevelFormat.LOWER_ROMAN :
           LevelFormat.DECIMAL,
  text: level === 0 ? '%1.' :
        level === 1 ? '%2.' :
        level === 2 ? '%3.' :
        level === 3 ? '%4.' :
        level === 4 ? '%5.' :
        '%6.',
  alignment: AlignmentType.LEFT as const,
  style: {
    paragraph: {
      indent: { left: 720 * (level + 1), hanging: 360 },
    },
  },
}));

export function htmlToDocx(html: string): Document {
  const children = buildBlockElements(html);

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
          paragraph: {
            spacing: { after: 160, line: 276 },
          },
        },
        heading1: {
          run: { font: 'Calibri', size: 32, bold: true, color: '1F3864' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
          run: { font: 'Calibri', size: 28, bold: true, color: '2E75B6' },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
          run: { font: 'Calibri', size: 24, bold: true },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
        heading4: {
          run: { font: 'Calibri', size: 22, bold: true, italics: true },
          paragraph: { spacing: { before: 140, after: 70 } },
        },
        heading5: {
          run: { font: 'Calibri', size: 20, bold: true },
          paragraph: { spacing: { before: 120, after: 60 } },
        },
        heading6: {
          run: { font: 'Calibri', size: 18, bold: true },
          paragraph: { spacing: { before: 120, after: 60 } },
        },
      },
    },
    numbering: {
      config: [{
        reference: 'ordered-list',
        levels: ORDERED_LEVELS,
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}
