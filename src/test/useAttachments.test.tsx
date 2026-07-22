import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAttachments, type ChatAttachment } from '@/hooks/useAttachments';

const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

function createAttachment(partial: Partial<ChatAttachment>): ChatAttachment {
  const mimeType = partial.mimeType ?? 'image/png';

  return {
    id: partial.id ?? 'att-1',
    file: partial.file ?? new File(['content'], 'attachment', { type: mimeType }),
    type: partial.type ?? 'image',
    name: partial.name ?? 'attachment',
    size: partial.size ?? 7,
    base64: partial.base64 ?? 'ZmFrZQ==',
    mimeType,
    previewUrl: partial.previewUrl,
  };
}

describe('useAttachments.buildContentParts', () => {
  it('keeps only image attachments in multimodal content', () => {
    const { result } = renderHook(() => useAttachments());

    const content = result.current.buildContentParts('hello', [
      createAttachment({ id: 'img', mimeType: 'image/png', type: 'image', base64: 'aW1hZ2U=' }),
      createAttachment({ id: 'pdf', mimeType: 'application/pdf', type: 'pdf', base64: 'cGRm' }),
      createAttachment({ id: 'audio', mimeType: 'audio/mpeg', type: 'audio', base64: 'YXVkaW8=' }),
    ]);

    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) throw new Error('Expected multimodal array content');

    expect(content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=' } },
    ]);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith(
      '2 non-image attachments were skipped. AI chat currently supports image attachments only.',
    );
  });

  it('falls back to plain text when there are no image attachments', () => {
    const { result } = renderHook(() => useAttachments());

    const content = result.current.buildContentParts('hello', [
      createAttachment({ mimeType: 'application/pdf', type: 'pdf', base64: 'cGRm' }),
    ]);

    expect(content).toBe('hello');
    expect(toastErrorMock).toHaveBeenCalledWith(
      '1 non-image attachment was skipped. AI chat currently supports image attachments only.',
    );
  });
});
