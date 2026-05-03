import PptxGenJS from 'pptxgenjs';
import { encodeDataUrl } from '@/components/ide/office/officeUtils';

export interface PptxSlide {
  title: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  layout?: 'title' | 'content' | 'blank' | 'two-col';
  colLeft?: string[];
  colRight?: string[];
}

export interface PptxSpec {
  title: string;
  author?: string;
  theme?: 'blue' | 'dark' | 'green' | 'orange' | 'purple' | 'teal' | 'red' | 'slate';
  slides: PptxSlide[];
}

const THEMES: Record<string, { bg: string; accent: string; titleColor: string; bodyColor: string; titleBg: string }> = {
  blue:   { bg: 'FFFFFF', accent: '1E40AF', titleColor: 'FFFFFF', bodyColor: '1F2937', titleBg: '1E3A8A' },
  dark:   { bg: '1E1E2E', accent: '7C3AED', titleColor: 'FFFFFF', bodyColor: 'D1D5DB', titleBg: '111827' },
  green:  { bg: 'F0FDF4', accent: '16A34A', titleColor: 'FFFFFF', bodyColor: '1F2937', titleBg: '15803D' },
  orange: { bg: 'FFF7ED', accent: 'EA580C', titleColor: 'FFFFFF', bodyColor: '1F2937', titleBg: 'C2410C' },
  purple: { bg: 'FAF5FF', accent: '7C3AED', titleColor: 'FFFFFF', bodyColor: '1F2937', titleBg: '6D28D9' },
  teal:   { bg: 'F0FDFA', accent: '0D9488', titleColor: 'FFFFFF', bodyColor: '1F2937', titleBg: '0F766E' },
  red:    { bg: 'FFF1F2', accent: 'DC2626', titleColor: 'FFFFFF', bodyColor: '1F2937', titleBg: 'B91C1C' },
  slate:  { bg: 'F8FAFC', accent: '475569', titleColor: 'FFFFFF', bodyColor: '1E293B', titleBg: '334155' },
};

export async function generatePresentationPptx(spec: PptxSpec): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = spec.author || 'Canvas Agent';
  pptx.subject = spec.title;
  pptx.title = spec.title;

  const theme = THEMES[spec.theme || 'blue'];
  const W = 13.33;
  const H = 7.5;

  for (let i = 0; i < spec.slides.length; i++) {
    const sd = spec.slides[i];
    const slide = pptx.addSlide();
    const isFirst = i === 0;

    // Background
    slide.background = { color: isFirst ? theme.titleBg : theme.bg };

    if (isFirst) {
      // === TITLE SLIDE ===
      // Decorative accent bar at bottom
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: H - 0.9, w: W, h: 0.9,
        fill: { color: theme.accent },
        line: { color: theme.accent },
      });
      // Title
      slide.addText(sd.title, {
        x: 0.8, y: 1.8, w: W - 1.6, h: 2.2,
        fontSize: 44,
        bold: true,
        color: theme.titleColor,
        align: 'left',
        valign: 'middle',
        fontFace: 'Calibri',
        wrap: true,
      });
      // Subtitle
      if (sd.subtitle || sd.content) {
        slide.addText(sd.subtitle || sd.content || '', {
          x: 0.8, y: 4.0, w: W - 1.6, h: 1.4,
          fontSize: 22,
          color: 'BFD3F6',
          align: 'left',
          valign: 'top',
          fontFace: 'Calibri',
          wrap: true,
        });
      }
      // Slide number accent
      slide.addText(`${spec.title}`, {
        x: 0, y: H - 0.8, w: W, h: 0.7,
        fontSize: 12,
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
        fontFace: 'Calibri',
      });
    } else {
      // === CONTENT SLIDE ===
      // Header bar with title
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: W, h: 1.3,
        fill: { color: theme.titleBg },
        line: { color: theme.titleBg },
      });
      // Accent line below header
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 1.3, w: W, h: 0.06,
        fill: { color: theme.accent },
        line: { color: theme.accent },
      });

      slide.addText(sd.title, {
        x: 0.5, y: 0.1, w: W - 3, h: 1.1,
        fontSize: 28,
        bold: true,
        color: theme.titleColor,
        align: 'left',
        valign: 'middle',
        fontFace: 'Calibri',
      });

      // Slide number in header
      slide.addText(`${i + 1}`, {
        x: W - 1.2, y: 0.1, w: 0.9, h: 1.1,
        fontSize: 16,
        color: '9CA3AF',
        align: 'right',
        valign: 'middle',
        fontFace: 'Calibri',
      });

      if (sd.layout === 'two-col' && sd.colLeft && sd.colRight) {
        // Two column layout
        const colW = (W - 1.2) / 2;
        const leftItems = sd.colLeft.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 18, color: theme.bodyColor, fontFace: 'Calibri', paraSpaceBefore: 6 } }));
        const rightItems = sd.colRight.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 18, color: theme.bodyColor, fontFace: 'Calibri', paraSpaceBefore: 6 } }));
        slide.addText(leftItems, { x: 0.5, y: 1.6, w: colW, h: H - 2, valign: 'top', wrap: true });
        slide.addText(rightItems, { x: 0.7 + colW, y: 1.6, w: colW, h: H - 2, valign: 'top', wrap: true });
      } else if (sd.bullets && sd.bullets.length > 0) {
        // Bullets
        const bulletItems = sd.bullets.map((b, bi) => ({
          text: b,
          options: {
            bullet: { type: 'bullet' as const, indent: 15 },
            fontSize: bi === 0 && sd.bullets!.length === 1 ? 22 : 19,
            color: theme.bodyColor,
            fontFace: 'Calibri',
            paraSpaceBefore: 10,
            bold: false,
          },
        }));
        slide.addText(bulletItems, {
          x: 0.7, y: 1.6, w: W - 1.4, h: H - 2.2,
          valign: 'top',
          wrap: true,
        });
      } else if (sd.content) {
        slide.addText(sd.content, {
          x: 0.7, y: 1.6, w: W - 1.4, h: H - 2.2,
          fontSize: 20,
          color: theme.bodyColor,
          align: 'left',
          valign: 'top',
          fontFace: 'Calibri',
          wrap: true,
        });
      }

      // Footer line
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: H - 0.35, w: W, h: 0.35,
        fill: { color: theme.titleBg },
        line: { color: theme.titleBg },
      });
    }
  }

  const base64 = await pptx.write({ outputType: 'base64' }) as string;
  const mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return `data:${mime};base64,${base64}`;
}

export function parsePptxSpec(raw: string): PptxSpec | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.slides)) {
      return parsed as PptxSpec;
    }
    return null;
  } catch {
    return null;
  }
}
