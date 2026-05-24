import type { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';

interface TaskDependenciesProps {
  taskId: string;
  allTasks: Task[];
}

export function TaskDependencies({ taskId, allTasks }: TaskDependenciesProps) {
  const task = allTasks.find((t) => t.id === taskId);
  const depTags = task?.tags.filter((t) => t.startsWith('dep:')) || [];
  const blockedTags = task?.tags.filter((t) => t.startsWith('blocked-by:')) || [];

  const dependencyIds = depTags.map((t) => t.replace('dep:', ''));
  const blockedByIds = blockedTags.map((t) => t.replace('blocked-by:', ''));

  const dependencies = dependencyIds
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];
  const blockedByTasks = blockedByIds
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];

  return (
    <div className="space-y-3">
      <div>
        {dependencies.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Blocks</span>
            {dependencies.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border bg-background px-2 py-1"
              >
                <span className="text-xs text-foreground">{t.title}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {blockedByTasks.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Blocked by</span>
            {blockedByTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border bg-background px-2 py-1"
              >
                <span className="text-xs text-foreground">{t.title}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {dependencies.length === 0 && blockedByTasks.length === 0 && (
          <p className="text-xs text-muted-foreground">No dependencies</p>
        )}
      </div>
    </div>
  );
}
