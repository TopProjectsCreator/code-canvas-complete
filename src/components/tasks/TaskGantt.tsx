import { useState, useMemo } from 'react';
import type { Task, TaskStatus } from '@/types/task';
import { COLUMNS, PRIORITY_COLORS } from '@/types/task';

interface TaskGanttProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

type GroupBy = 'status' | 'assignee' | 'none';

export function TaskGantt({ tasks, onSelectTask }: TaskGanttProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('status');

  const rootTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = useMemo(() => {
    if (rootTasks.length === 0) return today;
    const dates = rootTasks
      .filter((t) => t.deadline)
      .map((t) => new Date(t.deadline + 'T00:00:00'));
    if (dates.length === 0) return today;
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 3);
    return min;
  }, [rootTasks]);

  const endDate = useMemo(() => {
    if (rootTasks.length === 0) {
      const d = new Date(today);
      d.setDate(d.getDate() + 14);
      return d;
    }
    const dates = rootTasks
      .filter((t) => t.deadline)
      .map((t) => new Date(t.deadline + 'T00:00:00'));
    if (dates.length === 0) {
      const d = new Date(today);
      d.setDate(d.getDate() + 14);
      return d;
    }
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    max.setDate(max.getDate() + 3);
    return max;
  }, [rootTasks]);

  const dayCount = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startDate, dayCount]);

  const getDayOffset = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const diff = d.getTime() - startDate.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  const groups = useMemo(() => {
    if (groupBy === 'none')
      return [{ label: 'All Tasks', tasks: rootTasks }];
    if (groupBy === 'assignee') {
      const map = new Map<string, Task[]>();
      map.set('Unassigned', []);
      for (const t of rootTasks) {
        const key = t.assignee || 'Unassigned';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
      return Array.from(map.entries()).map(([label, ts]) => ({
        label,
        tasks: ts,
      }));
    }
    return COLUMNS.map((col) => ({
      label: col.label,
      tasks: rootTasks.filter((t) => t.status === col.key),
    }));
  }, [rootTasks, groupBy]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Group by:</span>
        <select
          className="flex h-7 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="status">Status</option>
          <option value="assignee">Assignee</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[600px]">
          {/* Day headers */}
          <div className="flex border-b bg-muted/30">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">
              Task
            </div>
            <div className="flex flex-1">
              {days.map((d, i) => (
                <div
                  key={i}
                  className={`flex-1 border-l py-2 text-center text-[10px] ${
                    d.getDay() === 0 || d.getDay() === 6
                      ? 'bg-muted/20 text-muted-foreground/50'
                      : d.toDateString() === today.toDateString()
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground'
                  }`}
                >
                  {d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Groups */}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex border-b bg-muted/20">
                <div className="w-40 shrink-0 px-3 py-1.5 text-xs font-medium text-foreground">
                  {group.label}
                </div>
                <div className="flex-1" />
              </div>
              {group.tasks.length === 0 && (
                <div className="flex border-b">
                  <div className="w-40 shrink-0 px-3 py-2 text-xs text-muted-foreground/50">
                    No tasks
                  </div>
                  <div className="flex-1" />
                </div>
              )}
              {group.tasks.map((task) => {
                const offset = task.deadline ? getDayOffset(task.deadline) : -1;
                const barWidth = task.deadline ? 1 : 1;
                return (
                  <div
                    key={task.id}
                    className="flex cursor-pointer border-b last:border-0 hover:bg-muted/20 transition-colors"
                    onClick={() => onSelectTask(task)}
                  >
                    <div className="flex w-40 shrink-0 items-center gap-2 px-3 py-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: PRIORITY_COLORS[task.priority],
                        }}
                      />
                      <span className="truncate text-xs font-medium text-foreground">
                        {task.title}
                      </span>
                    </div>
                    <div className="relative flex-1" style={{ height: 32 }}>
                      {offset >= 0 && (
                        <div
                          className="absolute top-1/2 h-3 -translate-y-1/2 rounded bg-primary/60"
                          style={{
                            left: `${(offset / dayCount) * 100}%`,
                            width: `${(barWidth / dayCount) * 100}%`,
                            minWidth: 4,
                          }}
                        />
                      )}
                      {offset < 0 && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          No deadline
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
