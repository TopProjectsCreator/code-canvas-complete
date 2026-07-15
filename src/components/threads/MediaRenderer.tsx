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
      className={`prose prose-sm max-w-none dark:prose-invert break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
