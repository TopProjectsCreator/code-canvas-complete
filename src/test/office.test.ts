import { describe, it, expect } from 'vitest';
import { decodeDataUrl, encodeDataUrl, xmlEncode, parseXml } from '@/components/ide/office/officeUtils';
import { htmlToDocx } from '@/components/ide/office/htmlToDocx';

describe('officeUtils', () => {
  it('encodeDataUrl and decodeDataUrl round-trip', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = encodeDataUrl('text/plain', input);
    const decoded = decodeDataUrl(encoded);
    expect(decoded).toEqual(input);
  });

  it('decodeDataUrl returns null for empty content', () => {
    expect(decodeDataUrl('')).toBeNull();
    expect(decodeDataUrl(null as unknown as string)).toBeNull();
  });

  it('xmlEncode escapes special characters', () => {
    expect(xmlEncode('<hello> & "world"')).toBe('&lt;hello&gt; &amp; &quot;world&quot;');
  });

  it('parseXml parses valid XML', () => {
    const doc = parseXml('<root><item id="1">test</item></root>');
    expect(doc.querySelector('item')?.textContent).toBe('test');
    expect(doc.querySelector('item')?.getAttribute('id')).toBe('1');
  });
});

describe('htmlToDocx', () => {
  it('generates a Document from empty HTML', () => {
    const doc = htmlToDocx('<p></p>');
    expect(doc).toBeDefined();
    expect(doc).toBeInstanceOf(Object);
  });

  it('handles headings and paragraphs', () => {
    const html = '<h1>Title</h1><p>Body text</p><h2>Subtitle</h2>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });

  it('handles bold, italic, underline', () => {
    const html = '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u></p>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });

  it('handles links', () => {
    const html = '<p><a href="https://example.com">Link</a></p>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });

  it('handles lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>Ordered 1</li></ol>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });

  it('handles tables', () => {
    const html = '<table><tr><th>H1</th><th>H2</th></tr><tr><td>D1</td><td>D2</td></tr></table>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });

  it('handles blockquotes and code blocks', () => {
    const html = '<blockquote>Quote</blockquote><pre><code>code block</code></pre>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });

  it('handles page breaks', () => {
    const html = '<p>Before</p><div class="page-break"></div><p>After</p>';
    const doc = htmlToDocx(html);
    expect(doc).toBeDefined();
  });
});

describe('OOXML factory functions', () => {
  it('buildNewDocx produces valid zip', async () => {
    const { buildNewDocx } = await import('@/components/ide/office/officeUtils');
    const bytes = await buildNewDocx();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
  });

  it('buildNewPptx produces valid zip', async () => {
    const { buildNewPptx } = await import('@/components/ide/office/officeUtils');
    const bytes = await buildNewPptx();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
  });

  it('buildNewXlsx produces valid zip', async () => {
    const { buildNewXlsx } = await import('@/components/ide/office/officeUtils');
    const bytes = await buildNewXlsx();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
  });
});
