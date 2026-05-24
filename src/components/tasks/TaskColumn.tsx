import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { SortableTaskCard } from './TaskBoard';
import type { Task } from '@/types/task';

interface TaskColumnProps {
  colKey: string;
  colLabel: string;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onAddTask: (status: string, title: string) => Promise<void>;
  adding: boolean;
}

export function TaskColumn({
  colKey,
  colLabel,
  tasks,
  onSelectTask,
  onAddTask,
  adding,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onAddTask(colKey, title.trim());
      setTitle('');
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setShowForm(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg border bg-muted/30 p-3 min-h-[200px] transition-colors',
        isOver && 'bg-muted/60 ring-2 ring-primary/30',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{colLabel}</h3>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-secondary-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onSelect={() => onSelectTask(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !showForm && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">No tasks</p>
          </div>
        )}
      </div>

      <div className="mt-2">
        {showForm ? (
          <div className="space-y-2">
            <input
              ref={inputRef}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
              disabled={submitting}
            />
            <div className="flex gap-1">
              <button
                className="inline-flex h-7 items-center justify-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={handleSubmit}
                disabled={submitting || !title.trim()}
              >
                {submitting ? 'Adding...' : 'Add'}
              </button>
              <button
                className="inline-flex h-7 items-center justify-center rounded-md bg-secondary px-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-xs text-muted-foreground hover:border-solid hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => {
              setShowForm(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            disabled={adding}
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}
