import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileTree } from '@/components/ide/FileTree';
import { FileNode } from '@/types/ide';

const files: FileNode[] = [
  { id: 'file-1', name: 'index.ts', type: 'file', content: 'console.log(1);' },
];

describe('FileTree context menu', () => {
  it('closes the menu when clicking outside', () => {
    render(
      <FileTree
        files={files}
        fileContents={{}}
        onFileSelect={vi.fn()}
        onCreateFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFile={vi.fn()}
        activeFileId={null}
      />,
    );

    fireEvent.contextMenu(screen.getByText('index.ts'));
    expect(screen.getByText('Rename')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
  });
});
