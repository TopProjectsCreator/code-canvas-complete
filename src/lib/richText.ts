const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'EM',
  'FIGCAPTION',
  'FIGURE',
  'H1',
  'H2',
  'H3',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SOURCE',
  'STRONG',
  'U',
  'UL',
  'VIDEO',
  'AUDIO',
]);

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const sanitizeRichText = (value: string) => {
  if (!value.trim()) return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(value).replace(/\n/g, '<br>');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    const children = Array.from(el.childNodes).map(sanitizeNode).join('');

    if (!ALLOWED_TAGS.has(tag)) {
      return children;
    }

    if (tag === 'A') {
      const href = el.getAttribute('href') || '#';
      const safeHref = /^(https?:|mailto:|#)/i.test(href) ? href : '#';
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${children}</a>`;
    }

    if (tag === 'BR') return '<br>';

    if (tag === 'IMG') {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      const width = el.getAttribute('width') || '';
      const height = el.getAttribute('height') || '';
      const attrs = [`src="${escapeHtml(src)}"`];
      if (alt) attrs.push(`alt="${escapeHtml(alt)}"`);
      if (width) attrs.push(`width="${escapeHtml(width)}"`);
      if (height) attrs.push(`height="${escapeHtml(height)}"`);
      if (!src.startsWith('http')) return '';
      return `<img ${attrs.join(' ')} />`;
    }

    if (tag === 'VIDEO') {
      const src = el.getAttribute('src') || '';
      const controls = el.hasAttribute('controls');
      if (!src.startsWith('http') && src) return '';
      const attrs = [`src="${escapeHtml(src)}"`];
      if (controls) attrs.push('controls');
      attrs.push('class="max-w-full rounded-sm"');
      return `<video ${attrs.join(' ')}>${children}</video>`;
    }

    if (tag === 'AUDIO') {
      const src = el.getAttribute('src') || '';
      const controls = el.hasAttribute('controls');
      if (!src.startsWith('http') && src) return '';
      const attrs = [`src="${escapeHtml(src)}"`];
      if (controls) attrs.push('controls');
      attrs.push('class="w-full"');
      return `<audio ${attrs.join(' ')}>${children}</audio>`;
    }

    if (tag === 'SOURCE') {
      const src = el.getAttribute('src') || '';
      const type = el.getAttribute('type') || '';
      if (!src.startsWith('http') && src) return '';
      const attrs = [`src="${escapeHtml(src)}"`];
      if (type) attrs.push(`type="${escapeHtml(type)}"`);
      return `<source ${attrs.join(' ')} />`;
    }

    return `<${tag.toLowerCase()}>${children}</${tag.toLowerCase()}>`;
  };

  return Array.from(doc.body.childNodes).map(sanitizeNode).join('').trim();
};

export const richTextToPlainText = (value: string) => {
  if (!value) return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
};
