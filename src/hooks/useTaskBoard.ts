import { useState, useCallback, useEffect, useRef } from 'react';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';

const STORAGE_KEY = 'taskboard_tasks';
const MAX_UNDO = 30;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

interface Snapshot {
  tasks: Task[];
  description: string;
}

export function useTaskBoard(projectId: string = 'default') {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const currentTasksRef = useRef<Task[]>(tasks);
  const listenersRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    currentTasksRef.current = tasks;
    saveTasks(tasks);
    listenersRef.current.forEach(fn => fn());
  }, [tasks]);

  const subscribe = useCallback((fn: () => void) => {
    listenersRef.current.add(fn);
    return () => { listenersRef.current.delete(fn); };
  }, []);

  const saveSnapshot = useCallback((description: string) => {
    undoStack.current.push({ tasks: JSON.parse(JSON.stringify(currentTasksRef.current)), description });
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    redoStack.current.push({ tasks: JSON.parse(JSON.stringify(currentTasksRef.current)), description: snapshot.description });
    setTasks(snapshot.tasks);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    undoStack.current.push({ tasks: JSON.parse(JSON.stringify(currentTasksRef.current)), description: snapshot.description });
    setTasks(snapshot.tasks);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const addTask = useCallback((data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: string | null;
    deadline?: string | null;
    tags?: string[];
  }) => {
    saveSnapshot(`Add task: ${data.title}`);
    const task: Task = {
      id: generateId(),
      projectId,
      parentId: null,
      title: data.title,
      description: data.description || '',
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      assignee: data.assignee || null,
      deadline: data.deadline || null,
      sortOrder: Date.now(),
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [...prev, task]);
    return task;
  }, [projectId, saveSnapshot]);

  const addSubtask = useCallback((parentId: string, title: string) => {
    saveSnapshot(`Add subtask: ${title}`);
    const task: Task = {
      id: generateId(),
      projectId,
      parentId,
      title,
      description: '',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      deadline: null,
      sortOrder: Date.now(),
      tags: [],
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [...prev, task]);
    return task;
  }, [projectId, saveSnapshot]);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'deadline' | 'tags'>>) => {
    saveSnapshot(`Update task: ${id}`);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, [saveSnapshot]);

  const deleteTask = useCallback((id: string) => {
    saveSnapshot(`Delete task: ${id}`);
    setTasks(prev => prev.filter(t => t.id !== id && t.parentId !== id));
  }, [saveSnapshot]);

  const reorderTask = useCallback((id: string, status: TaskStatus, sortOrder: number) => {
    saveSnapshot(`Reorder task: ${id}`);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, sortOrder } : t));
  }, [saveSnapshot]);

  const moveTaskToColumn = useCallback((id: string, newStatus: TaskStatus) => {
    const siblings = tasks.filter(t => t.status === newStatus && t.id !== id && !t.parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(t => t.sortOrder)) : 0;
    saveSnapshot(`Move task to ${newStatus}`);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, sortOrder: maxOrder + 1 } : t));
  }, [tasks, saveSnapshot]);

  const planFeature = useCallback((featureName: string, taskTitles: string[]) => {
    saveSnapshot(`Plan feature: ${featureName}`);
    const newTasks = taskTitles.map((title, i) => ({
      id: generateId(),
      projectId,
      parentId: null,
      title,
      description: `Part of feature: ${featureName}`,
      status: 'todo' as TaskStatus,
      priority: 'medium' as TaskPriority,
      assignee: null,
      deadline: null,
      sortOrder: Date.now() + i,
      tags: [featureName.toLowerCase().replace(/\s+/g, '-')],
      createdAt: new Date().toISOString(),
    }));
    setTasks(prev => [...prev, ...newTasks]);
    return newTasks;
  }, [projectId, saveSnapshot]);

  const getProjectTasks = useCallback((): Task[] => {
    return currentTasksRef.current.filter(t => t.projectId === projectId && !t.parentId);
  }, [projectId]);

  const getTaskWithRelations = useCallback((id: string): Task | undefined => {
    const task = currentTasksRef.current.find(t => t.id === id);
    if (!task) return undefined;
    const subtasks = currentTasksRef.current.filter(t => t.parentId === id);
    return { ...task, subtasks };
  }, []);

  const reset = useCallback(() => {
    saveSnapshot('Reset board');
    setTasks([]);
  }, [saveSnapshot]);

  const importTasks = useCallback((newTasks: Task[]) => {
    saveSnapshot('Import tasks');
    setTasks(prev => [...prev, ...newTasks.map(t => ({ ...t, id: generateId(), projectId }))]);
  }, [projectId, saveSnapshot]);

  return {
    tasks,
    addTask,
    addSubtask,
    updateTask,
    deleteTask,
    reorderTask,
    moveTaskToColumn,
    planFeature,
    getProjectTasks,
    getTaskWithRelations,
    subscribe,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    importTasks,
  };
}
