const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'EM',
  'I',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'STRONG',
  'U',
  'UL',
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
