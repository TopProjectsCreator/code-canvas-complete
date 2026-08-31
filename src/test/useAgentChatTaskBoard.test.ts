import { beforeEach, describe, expect, it } from 'vitest';
import { loadTaskBoardTasks, taskBoardStorageKey } from '@/hooks/useAgentChat';

describe('task board storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads tasks from the project-scoped storage key', () => {
    const task = { id: 'task-1', title: 'Fix bug', status: 'todo' };
    localStorage.setItem(taskBoardStorageKey('project-a'), JSON.stringify([task]));

    expect(loadTaskBoardTasks('project-a')).toEqual([task]);
    expect(loadTaskBoardTasks('project-b')).toEqual([]);
  });

  it('uses the default project key when projectId is missing', () => {
    const task = { id: 'task-default', title: 'Default task', status: 'in_progress' };
    localStorage.setItem(taskBoardStorageKey(), JSON.stringify([task]));

    expect(loadTaskBoardTasks(undefined)).toEqual([task]);
    expect(loadTaskBoardTasks(null)).toEqual([task]);
  });
});
