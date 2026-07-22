import { describe, expect, it } from 'vitest';
import { appendPreviewLogEntry, MAX_PREVIEW_LOG_ENTRIES } from '@/components/ide/previewLogUtils';

describe('appendPreviewLogEntry', () => {
  it('keeps entries up to the configured limit', () => {
    const entries = Array.from({ length: MAX_PREVIEW_LOG_ENTRIES - 1 }, (_, index) => index);
    const result = appendPreviewLogEntry(entries, MAX_PREVIEW_LOG_ENTRIES - 1);

    expect(result).toHaveLength(MAX_PREVIEW_LOG_ENTRIES);
    expect(result[0]).toBe(0);
    expect(result[MAX_PREVIEW_LOG_ENTRIES - 1]).toBe(MAX_PREVIEW_LOG_ENTRIES - 1);
  });

  it('evicts the oldest entries when the limit is exceeded', () => {
    const entries = Array.from({ length: MAX_PREVIEW_LOG_ENTRIES }, (_, index) => index);
    const result = appendPreviewLogEntry(entries, MAX_PREVIEW_LOG_ENTRIES);

    expect(result).toHaveLength(MAX_PREVIEW_LOG_ENTRIES);
    expect(result[0]).toBe(1);
    expect(result[MAX_PREVIEW_LOG_ENTRIES - 1]).toBe(MAX_PREVIEW_LOG_ENTRIES);
  });
});
