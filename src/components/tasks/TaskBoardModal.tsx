import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTaskBoard } from '@/hooks/useTaskBoard';
import { TaskBoard } from './TaskBoard';
import { TaskTable } from './TaskTable';
import { TaskGantt } from './TaskGantt';
import { TaskDetail } from './TaskDetail';
import type { Task, TaskStatus, TaskPriority, ViewMode } from '@/types/task';
import { TASKBOARD_EVENTS } from '@/types/task';

interface TaskBoardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

export function TaskBoardModal({
  open,
  onOpenChange,
  projectId = 'default',
}: TaskBoardModalProps) {
  const {
    tasks,
    addTask,
    addSubtask,
    updateTask,
    deleteTask,
    reorderTask,
    planFeature,
  } = useTaskBoard(projectId);

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [featureInput, setFeatureInput] = useState('');

  const handleAddTask = useCallback(
    async (status: string, title: string) => {
      setAddingCol(status);
      try {
        addTask({ title, status: status as TaskStatus });
      } finally {
        setAddingCol(null);
      }
    },
    [addTask],
  );

  const handleCreateDetailedTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc,
      priority: newTaskPriority,
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowNewTaskForm(false);
  }, [newTaskTitle, newTaskDesc, newTaskPriority, addTask]);

  const handlePlanFeature = useCallback(() => {
    if (!featureInput.trim()) return;
    const lines = featureInput.trim().split('\n').filter(Boolean);
    const featureName = lines[0];
    const taskTitles = lines.slice(1);
    if (taskTitles.length === 0) {
      addTask({ title: featureName });
    } else {
      planFeature(featureName, taskTitles);
    }
    setFeatureInput('');
  }, [featureInput, addTask, planFeature]);

  // Listen for AI events
  useEffect(() => {
    const handlePlanFeature = (e: CustomEvent) => {
      const { featureName, tasks: taskTitles } = e.detail;
      planFeature(featureName || 'Feature', taskTitles || []);
    };

    const handleUpdateTask = (e: CustomEvent) => {
      const { id, updates } = e.detail;
      updateTask(id, updates);
    };

    window.addEventListener(TASKBOARD_EVENTS.PLAN_FEATURE, handlePlanFeature as EventListener);
    window.addEventListener(TASKBOARD_EVENTS.UPDATE_TASK, handleUpdateTask as EventListener);

    return () => {
      window.removeEventListener(TASKBOARD_EVENTS.PLAN_FEATURE, handlePlanFeature as EventListener);
      window.removeEventListener(TASKBOARD_EVENTS.UPDATE_TASK, handleUpdateTask as EventListener);
    };
  }, [planFeature, updateTask]);

  const totalTasks = tasks.filter((t) => !t.parentId).length;
  const doneTasks = tasks.filter(
    (t) => t.status === 'done' && !t.parentId,
  ).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Task Board</DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {doneTasks}/{totalTasks} tasks done
                </span>
                <div className="flex rounded-md border">
                  {(['board', 'table', 'gantt'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                        viewMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                {viewMode === 'board' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewTaskForm(true)}
                  >
                    + New Task
                  </Button>
                )}
              </div>
            </div>

            {/* Quick plan feature input */}
            <div className="mt-2 flex gap-2">
              <input
                className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Plan a feature: type feature name, then subtasks on new lines..."
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) handlePlanFeature();
                }}
              />
              <Button
                size="sm"
                onClick={handlePlanFeature}
                disabled={!featureInput.trim()}
              >
                Plan
              </Button>
            </div>

            {/* New task form */}
            {showNewTaskForm && (
              <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3">
                <input
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
                <input
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Description (optional)..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <select
                    className="flex h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <div className="flex gap-1 ml-auto">
                    <Button size="sm" onClick={handleCreateDetailedTask} disabled={!newTaskTitle.trim()}>
                      Create
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowNewTaskForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {viewMode === 'board' && (
              <TaskBoard
                tasks={tasks}
                onSelectTask={setSelectedTask}
                onRefresh={undefined}
                onAddTask={handleAddTask}
                onReorderTask={reorderTask}
                addingCol={addingCol}
              />
            )}
            {viewMode === 'table' && (
              <TaskTable tasks={tasks} onSelectTask={setSelectedTask} />
            )}
            {viewMode === 'gantt' && (
              <TaskGantt tasks={tasks} onSelectTask={setSelectedTask} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TaskDetail
        task={selectedTask}
        allTasks={tasks}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={updateTask}
        onAddSubtask={addSubtask}
        onDelete={deleteTask}
      />
    </>
  );
}
