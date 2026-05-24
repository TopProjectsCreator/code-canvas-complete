import { useState, useMemo } from 'react';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';
import { Badge } from '@/components/ui/badge';

interface TaskTableProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

const STATUS_BADGE: Record<TaskStatus, 'default' | 'secondary' | 'outline'> = {
  todo: 'default',
  in_progress: 'secondary',
  done: 'outline',
};

const PRIORITY_BADGE: Record<TaskPriority, 'default' | 'secondary' | 'destructive'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
};

export function TaskTable({ tasks, onSelectTask }: TaskTableProps) {
  const [sortKey, setSortKey] = useState<string>('sortOrder');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let result = tasks.filter((t) => !t.parentId);

    if (statusFilter) result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }

    return result.sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? '';
      const bVal = (b as any)[sortKey] ?? '';
      const cmp =
        typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tasks, statusFilter, priorityFilter, search, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="flex h-8 w-48 rounded-md border border-input bg-background px-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="flex h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select
          className="flex h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              {[
                { key: 'title', label: 'Title' },
                { key: 'status', label: 'Status' },
                { key: 'priority', label: 'Priority' },
                { key: 'deadline', label: 'Deadline' },
                { key: 'assignee', label: 'Assignee' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="cursor-pointer px-3 py-2 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort(key)}
                >
                  {label}
                  {sortKey === key && (
                    <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <tr
                key={task.id}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/30 transition-colors"
                onClick={() => onSelectTask(task)}
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {task.title}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_BADGE[task.status]}>
                    {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={PRIORITY_BADGE[task.priority]}>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {task.deadline
                    ? new Date(task.deadline).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {task.assignee || '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
