import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from './TaskCard';
import { TaskColumn } from './TaskColumn';
import type { Task, TaskStatus } from '@/types/task';
import { COLUMNS } from '@/types/task';

export function SortableTaskCard({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onSelect={onSelect} isDragging={isDragging} />
    </div>
  );
}

interface TaskBoardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onRefresh?: () => void;
  onAddTask: (status: string, title: string) => Promise<void>;
  onReorderTask: (id: string, status: TaskStatus, sortOrder: number) => void;
  addingCol: string | null;
}

export function TaskBoard({ tasks, onSelectTask, onRefresh = () => {}, onAddTask, onReorderTask, addingCol }: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(
    () =>
      COLUMNS.map((col) => ({
        ...col,
        tasks: tasks
          .filter((t) => t.status === col.key && !t.parentId)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    [tasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id;

    let targetStatus: TaskStatus | null = null;
    let targetOrder = 0;

    const col = COLUMNS.find((c) => c.key === overId);
    if (col) {
      targetStatus = col.key;
      const sameColTasks = tasks
        .filter((t) => t.status === targetStatus && !t.parentId && t.id !== taskId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      targetOrder = sameColTasks.length > 0 ? sameColTasks[sameColTasks.length - 1].sortOrder + 1 : 0;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
        const sameColTasks = tasks
          .filter((t) => t.status === targetStatus && !t.parentId && t.id !== taskId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const overIdx = sameColTasks.findIndex((t) => t.id === overId);
        if (overIdx <= 0) {
          targetOrder = sameColTasks.length > 0 ? sameColTasks[0].sortOrder - 1 : 0;
        } else {
          const prev = sameColTasks[overIdx - 1];
          const next = sameColTasks[overIdx];
          targetOrder = prev.sortOrder + (next.sortOrder - prev.sortOrder) / 2;
        }
      }
    }

    if (targetStatus) {
      onReorderTask(taskId, targetStatus, targetOrder);
      onRefresh();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {grouped.map((col) => (
          <TaskColumn
            key={col.key}
            colKey={col.key}
            colLabel={col.label}
            tasks={col.tasks}
            onSelectTask={onSelectTask}
            onAddTask={onAddTask}
            adding={addingCol === col.key}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-3 opacity-85">
            <TaskCard task={activeTask} onSelect={() => {}} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
