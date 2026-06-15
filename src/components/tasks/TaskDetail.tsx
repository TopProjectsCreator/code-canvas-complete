import { useState, useEffect } from 'react';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';
import { COLUMNS } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TaskDependencies } from './TaskDependencies';

interface TaskDetailProps {
  task: Task | null;
  allTasks: Task[];
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function TaskDetail({
  task,
  allTasks,
  open,
  onClose,
  onUpdate,
  onAddSubtask,
  onDelete,
}: TaskDetailProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [deadline, setDeadline] = useState('');
  const [assignee, setAssignee] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setDeadline(task.deadline || '');
      setAssignee(task.assignee || '');
    }
  }, [task]);

  if (!task) return null;

  const subtasks = allTasks.filter((t) => t.parentId === task.id);
  const doneSubtasks = subtasks.filter((t) => t.status === 'done').length;

  const handleSave = () => {
    onUpdate(task.id, {
      title,
      description,
      status,
      priority,
      deadline: deadline || null,
      assignee: assignee || null,
    });
    setEditing(false);
  };

  const handleToggleSubtask = (sub: Task) => {
    onUpdate(sub.id, {
      status: sub.status === 'done' ? 'todo' : 'done',
    });
  };

  const handleDeleteSubtask = (subId: string) => {
    onDelete(subId);
  };

  const handleAddSubtask = () => {
    if (!subtaskTitle.trim()) return;
    onAddSubtask(task.id, subtaskTitle.trim());
    setSubtaskTitle('');
  };

  const overdue =
    task.deadline &&
    task.status !== 'done' &&
    new Date(task.deadline + 'T00:00:00') < new Date();

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-200 ${
        open ? 'visible opacity-100' : 'invisible opacity-0'
      }`}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-lg border-l bg-background shadow-xl transition-all duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Close
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(!editing)}
              >
                {editing ? 'Cancel' : 'Edit'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm('Delete this task?')) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {editing ? (
              <div className="space-y-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task description..."
                  rows={4}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-3 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-3 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as TaskPriority)
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <Input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Assignee name"
                />
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            ) : (
              <>
                {/* Meta bar */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      priority === 'high'
                        ? 'destructive'
                        : priority === 'medium'
                          ? 'secondary'
                          : 'default'
                    }
                  >
                    {priority}
                  </Badge>
                  <Badge
                    variant={
                      status === 'done'
                        ? 'default'
                        : status === 'in_progress'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {status === 'in_progress'
                      ? 'In Progress'
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                  {overdue && <Badge variant="destructive">Overdue</Badge>}
                </div>

                <h2 className="text-lg font-semibold text-foreground">
                  {task.title}
                </h2>

                {task.description && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {task.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {task.assignee && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Assignee:</span>
                      <span className="font-medium text-foreground">
                        {task.assignee}
                      </span>
                    </div>
                  )}
                  {task.deadline && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Deadline:</span>
                      <span
                        className={
                          overdue
                            ? 'font-medium text-destructive'
                            : 'text-foreground'
                        }
                      >
                        {new Date(task.deadline).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="text-foreground">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {task.tags
                        .filter((t) => !t.startsWith('dep:') && !t.startsWith('blocked-by:'))
                        .map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <TaskDependencies taskId={task.id} allTasks={allTasks} />

                {/* Subtasks */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Subtasks
                    {subtasks.length > 0 &&
                      ` (${doneSubtasks}/${subtasks.length})`}
                  </h3>
                  <div className="space-y-1">
                    {subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 rounded-md border bg-background px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={sub.status === 'done'}
                          onChange={() => handleToggleSubtask(sub)}
                          className="h-3.5 w-3.5"
                        />
                        <span
                          className={`flex-1 text-xs ${
                            sub.status === 'done'
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          }`}
                        >
                          {sub.title}
                        </span>
                        <button
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      placeholder="Add subtask..."
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddSubtask();
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleAddSubtask}
                      disabled={!subtaskTitle.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
