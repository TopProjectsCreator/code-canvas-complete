import { useMemo } from 'react';
import { FileNode } from '@/types/ide';
import { PowerPointEditor } from './office/PowerPointEditor';
import { WordEditor } from './office/WordEditor';
import { ExcelEditor } from './office/ExcelEditor';

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

  if (officeType === 'pptx') return <PowerPointEditor file={file} onContentChange={onContentChange} />;
  if (officeType === 'docx') return <WordEditor file={file} onContentChange={onContentChange} />;
  if (officeType === 'xlsx') return <ExcelEditor file={file} onContentChange={onContentChange} />;

  return null;
};
