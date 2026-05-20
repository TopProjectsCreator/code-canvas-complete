import { describe, expect, it } from 'vitest';
import { parseAIErrorResponse } from '@/lib/aiErrorParsing';

describe('parseAIErrorResponse', () => {
  it('returns structured JSON error when present', () => {
    const msg = parseAIErrorResponse(500, JSON.stringify({ error: 'Upstream failed' }));
    expect(msg).toBe('Upstream failed');
  });

  it('returns HTML-specific guidance for HTML bodies', () => {
    const msg = parseAIErrorResponse(502, '<!doctype html><html><body>Bad gateway</body></html>');
    expect(msg).toContain('Server returned HTML instead of JSON');
  });

  it('returns trimmed plain text response', () => {
    const msg = parseAIErrorResponse(400, '  Plain text failure  ');
    expect(msg).toBe('Plain text failure');
  });

  it('falls back to status-based message when response is empty', () => {
    const msg = parseAIErrorResponse(503, '');
    expect(msg).toBe('Failed to get response (503)');
  });
});
