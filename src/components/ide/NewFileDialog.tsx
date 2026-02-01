import { useState, useEffect } from 'react';
import { X, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: 'file' | 'folder') => void;
  parentFolder?: string;
  defaultType?: 'file' | 'folder';
}

export const NewFileDialog = ({ isOpen, onClose, onSubmit, parentFolder, defaultType = 'file' }: NewFileDialogProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'folder'>(defaultType);
  const [error, setError] = useState('');

  // Reset type when dialog opens with a new defaultType
  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate file name
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(name)) {
      setError('Invalid characters in name');
      return;
    }

    onSubmit(name.trim(), type);
    setName('');
    setType('file');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setType('file');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Create New {type === 'file' ? 'File' : 'Folder'}
          </h2>
          <button 
            onClick={handleClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors',
                type === 'file'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <File className="w-5 h-5" />
              <span>File</span>
            </button>
            <button
              type="button"
              onClick={() => setType('folder')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors',
                type === 'folder'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Folder className="w-5 h-5" />
              <span>Folder</span>
            </button>
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {type === 'file' ? 'File name' : 'Folder name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder={type === 'file' ? 'example.js' : 'my-folder'}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {parentFolder && (
            <p className="text-xs text-muted-foreground">
              Creating in: {parentFolder}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
