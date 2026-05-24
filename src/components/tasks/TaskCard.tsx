import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';
import { PRIORITY_COLORS } from '@/types/task';

interface TaskCardProps {
  task: Task;
  onSelect: () => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onSelect, isDragging }: TaskCardProps) {
  const overdue =
    task.deadline &&
    task.status !== 'done' &&
    new Date(task.deadline + 'T00:00:00') < new Date();

  const formattedDeadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-pointer',
        isDragging && 'opacity-50 ring-2 ring-primary',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: PRIORITY_COLORS[task.priority] }}
        />
        <h4 className="text-sm font-medium leading-snug text-card-foreground">
          {task.title}
        </h4>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.tags.length > 0 && (
          <div className="flex gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {formattedDeadline && (
          <span className={cn(overdue && 'font-semibold text-destructive')}>
            {formattedDeadline}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-1">
            <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[8px] font-medium text-muted-foreground">
              {task.assignee.charAt(0).toUpperCase()}
            </span>
            {task.assignee}
          </span>
        )}
      </div>
    </div>
  );
}
