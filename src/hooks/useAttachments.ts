import { useState, useRef, useCallback } from 'react';

export interface ChatAttachment {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'document';
  name: string;
  size: number;
  previewUrl?: string;
  base64?: string;
  mimeType: string;
}

const ACCEPTED_TYPES: Record<string, ChatAttachment['type']> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/mp4': 'audio',
  'application/pdf': 'pdf',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function getAttachmentType(mimeType: string): ChatAttachment['type'] | null {
  return ACCEPTED_TYPES[mimeType] || null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 data after the comma
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useAttachments() {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds 20MB limit`);
        continue;
      }
      const type = getAttachmentType(file.type);
      if (!type) {
        console.warn(`Unsupported file type: ${file.type}`);
        continue;
      }
      const base64 = await fileToBase64(file);
      const previewUrl = type === 'image' ? URL.createObjectURL(file) : undefined;
      newAttachments.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        type,
        name: file.name,
        size: file.size,
        previewUrl,
        base64,
        mimeType: file.type,
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments(prev => {
      prev.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
      return [];
    });
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Build OpenAI-compatible multimodal content parts from attachments
  const buildContentParts = useCallback((text: string, atts: ChatAttachment[]) => {
    if (atts.length === 0) return text;

    const parts: Array<{ type: string; text?: string; image_url?: { url: string }; }> = [
      { type: 'text', text },
    ];

    for (const att of atts) {
      // All file types are sent as image_url with data URI - the gateway/model handles them
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${att.mimeType};base64,${att.base64}` },
      });
    }

    return parts;
  }, []);

  const acceptString = Object.keys(ACCEPTED_TYPES).join(',');

  return {
    attachments,
    fileInputRef,
    addFiles,
    removeAttachment,
    clearAttachments,
    openFilePicker,
    buildContentParts,
    acceptString,
  };
}
