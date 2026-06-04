import { useCADStore } from '../store'
import { Progress } from '@/components/ui/progress'

export function ProgressIndicator() {
  const tasks = useCADStore(s => s.tasks)
  const running = tasks.filter(t => t.status === 'running')

  if (running.length === 0) return null

  return (
    <div className="fixed bottom-8 right-4 z-50 space-y-1">
      {running.map(task => (
        <div
          key={task.id}
          className="bg-background border rounded-md shadow-md p-2 min-w-[200px]"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{task.name}</span>
            <span className="text-[10px] text-muted-foreground">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1" />
          {task.message && (
            <p className="text-[10px] text-muted-foreground mt-1">{task.message}</p>
          )}
        </div>
      ))}
    </div>
  )
}
