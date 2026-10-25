import { describe, it, expect, vi } from 'vitest';

const query = vi.hoisted(() => ({
  select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => query } }));
vi.mock('@/lib/platform', () => ({ detectDeploymentPlatform: () => 'generic', isReplitLikePlatform: () => false }));

import { createDataProvider, PROJECT_LIST_COLUMNS } from '@/integrations/data/provider';

describe('project metadata listing', () => {
  it('excludes file contents and preserves all 1345 projects beyond the API row limit', async () => {
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockImplementation(async (from: number) => ({
      data: Array.from({ length: from === 0 ? 1000 : 345 }, (_, i) => ({ id: String(from + i), folder_names: ['src', 'Root'] })),
      error: null,
    }));
    const projects = await createDataProvider().listProjects('demo-user');
    expect(PROJECT_LIST_COLUMNS.split(',')).not.toContain('files');
    expect(query.select).toHaveBeenCalledWith(PROJECT_LIST_COLUMNS);
    expect(projects).toHaveLength(1345);
    expect(projects[1344].id).toBe('1344');
    expect(projects[0].folder_names).toEqual(['src', 'Root']);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});