import { 
  File, 
  FileCode, 
  FileJson, 
  FileText, 
  Folder, 
  FolderOpen,
  FileType,
  Code2,
  Image,
  Video,
  Music,
  FileSpreadsheet,
  Settings,
  Terminal,
  Database,
  Braces,
  Hash,
  Gem,
  Coffee,
  Flame,
  Leaf,
  Box,
  FileCode2,
  Cog,
  Lock,
  GitBranch,
  FileArchive
} from 'lucide-react';

interface FileIconProps {
  name: string;
  type: 'file' | 'folder';
  isOpen?: boolean;
  className?: string;
}

export const FileIcon = ({ name, type, isOpen = false, className = '' }: FileIconProps) => {
  if (type === 'folder') {
    // Special folder icons
    const folderName = name.toLowerCase();
    if (folderName === 'node_modules') {
      return isOpen ? (
        <FolderOpen className={`w-4 h-4 text-green-600 ${className}`} />
      ) : (
        <Folder className={`w-4 h-4 text-green-600 ${className}`} />
      );
    }
    if (folderName === 'src' || folderName === 'source') {
      return isOpen ? (
        <FolderOpen className={`w-4 h-4 text-blue-400 ${className}`} />
      ) : (
        <Folder className={`w-4 h-4 text-blue-400 ${className}`} />
      );
    }
    if (folderName === 'public' || folderName === 'assets' || folderName === 'static') {
      return isOpen ? (
        <FolderOpen className={`w-4 h-4 text-yellow-400 ${className}`} />
      ) : (
        <Folder className={`w-4 h-4 text-yellow-400 ${className}`} />
      );
    }
    if (folderName === 'components') {
      return isOpen ? (
        <FolderOpen className={`w-4 h-4 text-purple-400 ${className}`} />
      ) : (
        <Folder className={`w-4 h-4 text-purple-400 ${className}`} />
      );
    }
    if (folderName === 'test' || folderName === 'tests' || folderName === '__tests__') {
      return isOpen ? (
        <FolderOpen className={`w-4 h-4 text-orange-400 ${className}`} />
      ) : (
        <Folder className={`w-4 h-4 text-orange-400 ${className}`} />
      );
    }
    
    return isOpen ? (
      <FolderOpen className={`w-4 h-4 text-file-folder ${className}`} />
    ) : (
      <Folder className={`w-4 h-4 text-file-folder ${className}`} />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();
  const fileName = name.toLowerCase();

  // Special filenames
  if (fileName === 'dockerfile') {
    return <Box className={`w-4 h-4 text-cyan-400 ${className}`} />;
  }
  if (fileName === '.gitignore' || fileName === '.gitattributes') {
    return <GitBranch className={`w-4 h-4 text-orange-500 ${className}`} />;
  }
  if (fileName === '.env' || fileName.startsWith('.env.')) {
    return <Lock className={`w-4 h-4 text-yellow-500 ${className}`} />;
  }
  if (fileName === 'package.json') {
    return <Box className={`w-4 h-4 text-green-500 ${className}`} />;
  }
  if (fileName === 'tsconfig.json') {
    return <Cog className={`w-4 h-4 text-blue-400 ${className}`} />;
  }
  if (fileName === 'vite.config.ts' || fileName === 'vite.config.js') {
    return <Flame className={`w-4 h-4 text-purple-400 ${className}`} />;
  }
  if (fileName === 'tailwind.config.ts' || fileName === 'tailwind.config.js') {
    return <Leaf className={`w-4 h-4 text-cyan-400 ${className}`} />;
  }

  switch (ext) {
    // Web
    case 'html':
    case 'htm':
      return <FileCode className={`w-4 h-4 text-orange-500 ${className}`} />;
    case 'css':
      return <FileType className={`w-4 h-4 text-blue-500 ${className}`} />;
    case 'scss':
    case 'sass':
      return <FileType className={`w-4 h-4 text-pink-400 ${className}`} />;
    case 'less':
      return <FileType className={`w-4 h-4 text-indigo-400 ${className}`} />;
    
    // JavaScript/TypeScript
    case 'js':
      return <Code2 className={`w-4 h-4 text-yellow-400 ${className}`} />;
    case 'jsx':
      return <Code2 className={`w-4 h-4 text-cyan-400 ${className}`} />;
    case 'ts':
      return <Code2 className={`w-4 h-4 text-blue-500 ${className}`} />;
    case 'tsx':
      return <Code2 className={`w-4 h-4 text-blue-400 ${className}`} />;
    case 'mjs':
    case 'cjs':
      return <Code2 className={`w-4 h-4 text-yellow-500 ${className}`} />;
    
    // Data formats
    case 'json':
      return <Braces className={`w-4 h-4 text-yellow-300 ${className}`} />;
    case 'yaml':
    case 'yml':
      return <FileCode2 className={`w-4 h-4 text-red-400 ${className}`} />;
    case 'xml':
      return <FileCode className={`w-4 h-4 text-orange-400 ${className}`} />;
    case 'toml':
      return <FileCode2 className={`w-4 h-4 text-gray-400 ${className}`} />;
    case 'csv':
      return <FileSpreadsheet className={`w-4 h-4 text-green-400 ${className}`} />;
    
    // Documentation
    case 'md':
    case 'markdown':
      return <FileText className={`w-4 h-4 text-blue-300 ${className}`} />;
    case 'txt':
      return <FileText className={`w-4 h-4 text-muted-foreground ${className}`} />;
    case 'pdf':
      return <FileText className={`w-4 h-4 text-red-500 ${className}`} />;
    
    // Programming languages
    case 'py':
      return <Code2 className={`w-4 h-4 text-yellow-400 ${className}`} />;
    case 'rb':
      return <Gem className={`w-4 h-4 text-red-500 ${className}`} />;
    case 'go':
      return <Code2 className={`w-4 h-4 text-cyan-500 ${className}`} />;
    case 'rs':
      return <Cog className={`w-4 h-4 text-orange-600 ${className}`} />;
    case 'java':
      return <Coffee className={`w-4 h-4 text-red-400 ${className}`} />;
    case 'kt':
    case 'kts':
      return <Code2 className={`w-4 h-4 text-purple-500 ${className}`} />;
    case 'swift':
      return <Code2 className={`w-4 h-4 text-orange-500 ${className}`} />;
    case 'c':
      return <Hash className={`w-4 h-4 text-blue-400 ${className}`} />;
    case 'cpp':
    case 'cc':
    case 'cxx':
      return <Hash className={`w-4 h-4 text-blue-500 ${className}`} />;
    case 'h':
    case 'hpp':
      return <Hash className={`w-4 h-4 text-purple-400 ${className}`} />;
    case 'cs':
      return <Hash className={`w-4 h-4 text-green-500 ${className}`} />;
    case 'php':
      return <Code2 className={`w-4 h-4 text-indigo-400 ${className}`} />;
    case 'lua':
      return <Code2 className={`w-4 h-4 text-blue-600 ${className}`} />;
    case 'r':
      return <Code2 className={`w-4 h-4 text-blue-400 ${className}`} />;
    case 'scala':
      return <Code2 className={`w-4 h-4 text-red-500 ${className}`} />;
    case 'hs':
      return <Code2 className={`w-4 h-4 text-purple-500 ${className}`} />;
    case 'ex':
    case 'exs':
      return <Code2 className={`w-4 h-4 text-purple-400 ${className}`} />;
    case 'erl':
      return <Code2 className={`w-4 h-4 text-red-400 ${className}`} />;
    case 'pl':
      return <Code2 className={`w-4 h-4 text-blue-300 ${className}`} />;
    case 'dart':
      return <Code2 className={`w-4 h-4 text-cyan-400 ${className}`} />;
    case 'zig':
      return <Code2 className={`w-4 h-4 text-orange-400 ${className}`} />;
    case 'nim':
      return <Code2 className={`w-4 h-4 text-yellow-500 ${className}`} />;
    case 'julia':
    case 'jl':
      return <Code2 className={`w-4 h-4 text-purple-500 ${className}`} />;
    
    // Shell/Scripts
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return <Terminal className={`w-4 h-4 text-green-400 ${className}`} />;
    case 'ps1':
    case 'bat':
    case 'cmd':
      return <Terminal className={`w-4 h-4 text-blue-400 ${className}`} />;
    
    // Database
    case 'sql':
      return <Database className={`w-4 h-4 text-yellow-500 ${className}`} />;
    case 'db':
    case 'sqlite':
      return <Database className={`w-4 h-4 text-blue-400 ${className}`} />;
    
    // Config
    case 'config':
    case 'conf':
    case 'ini':
      return <Settings className={`w-4 h-4 text-gray-400 ${className}`} />;
    case 'lock':
      return <Lock className={`w-4 h-4 text-yellow-600 ${className}`} />;
    
    // Media - Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'bmp':
    case 'tiff':
      return <Image className={`w-4 h-4 text-purple-400 ${className}`} />;
    case 'svg':
      return <Image className={`w-4 h-4 text-orange-400 ${className}`} />;
    
    // Media - Video
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'avi':
    case 'mkv':
    case 'ogv':
      return <Video className={`w-4 h-4 text-pink-400 ${className}`} />;
    
    // Media - Audio
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'aac':
    case 'm4a':
      return <Music className={`w-4 h-4 text-green-400 ${className}`} />;
    
    // Archives
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
    case '7z':
      return <FileArchive className={`w-4 h-4 text-yellow-600 ${className}`} />;
    
    // Frameworks
    case 'vue':
      return <Code2 className={`w-4 h-4 text-green-500 ${className}`} />;
    case 'svelte':
      return <Code2 className={`w-4 h-4 text-orange-500 ${className}`} />;
    
    default:
      return <File className={`w-4 h-4 text-muted-foreground ${className}`} />;
  }
};
