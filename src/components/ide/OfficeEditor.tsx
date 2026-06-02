import { useMemo } from 'react';
import { FileNode } from '@/types/ide';
import { PowerPointEditor } from './office/PowerPointEditor';
import { WordEditor } from './office/WordEditor';
import { ExcelEditor } from './office/ExcelEditor';
import { OfficeErrorBoundary } from './office/ErrorBoundary';

type OfficeType = 'docx' | 'xlsx' | 'pptx';

interface OfficeEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

const getOfficeType = (name: string): OfficeType | null => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'pptx') return 'pptx';
  return null;
};

export const OfficeEditor = ({ file, onContentChange }: OfficeEditorProps) => {
  const officeType = useMemo(() => getOfficeType(file.name), [file.name]);

  if (officeType === 'pptx') return (
    <OfficeErrorBoundary name="PowerPoint">
      <PowerPointEditor file={file} onContentChange={onContentChange} />
    </OfficeErrorBoundary>
  );
  if (officeType === 'docx') return (
    <OfficeErrorBoundary name="Word">
      <WordEditor file={file} onContentChange={onContentChange} />
    </OfficeErrorBoundary>
  );
  if (officeType === 'xlsx') return (
    <OfficeErrorBoundary name="Excel">
      <ExcelEditor file={file} onContentChange={onContentChange} />
    </OfficeErrorBoundary>
  );

  return null;
};
