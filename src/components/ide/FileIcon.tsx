import { 
  File, 
  FileCode, 
  FileJson, 
  FileText, 
  Folder, 
  FolderOpen,
  FileType,
  Code2
} from 'lucide-react';

interface FileIconProps {
  name: string;
  type: 'file' | 'folder';
  isOpen?: boolean;
  className?: string;
}

export const FileIcon = ({ name, type, isOpen = false, className = '' }: FileIconProps) => {
  if (type === 'folder') {
    return isOpen ? (
      <FolderOpen className={`w-4 h-4 text-file-folder ${className}`} />
    ) : (
      <Folder className={`w-4 h-4 text-file-folder ${className}`} />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'html':
      return <FileCode className={`w-4 h-4 text-file-html ${className}`} />;
    case 'css':
    case 'scss':
    case 'sass':
      return <FileType className={`w-4 h-4 text-file-css ${className}`} />;
    case 'js':
    case 'jsx':
      return <Code2 className={`w-4 h-4 text-file-js ${className}`} />;
    case 'ts':
    case 'tsx':
      return <Code2 className={`w-4 h-4 text-file-ts ${className}`} />;
    case 'json':
      return <FileJson className={`w-4 h-4 text-file-json ${className}`} />;
    case 'md':
      return <FileText className={`w-4 h-4 text-muted-foreground ${className}`} />;
    default:
      return <File className={`w-4 h-4 text-muted-foreground ${className}`} />;
  }
};
