import { sanitizeRichText } from '@/lib/richText';

interface MediaRendererProps {
  content: string;
  className?: string;
}

export function MediaRenderer({ content, className = '' }: MediaRendererProps) {
  const html = sanitizeRichText(content || '');

  if (!html) return null;

  return (
    <div
      className={`prose prose-sm prose-invert max-w-none break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
