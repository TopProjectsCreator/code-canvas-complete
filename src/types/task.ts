export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  deadline: string | null;
  sortOrder: number;
  tags: string[];
  createdAt: string;
  subtasks?: Task[];
}

export const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

export type ViewMode = 'board' | 'table' | 'gantt';

export const TASKBOARD_EVENTS = {
  PLAN_FEATURE: 'taskboard:plan_feature',
  UPDATE_TASK: 'taskboard:update_task',
} as const;
