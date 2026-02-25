import { supabase } from '@/integrations/supabase/client';
import { detectDeploymentPlatform, type DeploymentPlatform } from '@/lib/platform';
import { FileNode } from '@/types/ide';

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  files: FileNode[];
  language: string;
  is_public: boolean;
  forked_from: string | null;
  stars_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  provider: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  model_tier: string;
  request_count: number;
  usage_date: string;
  created_at: string;
  updated_at: string;
}

interface CreateProjectInput {
  user_id: string;
  name: string;
  description: string | null;
  files: FileNode[];
  language: string;
  is_public: boolean;
  forked_from?: string | null;
}

interface UpdateProjectInput {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  files: FileNode[];
  language: string;
  is_public: boolean;
}

export interface DataProvider {
  platform: DeploymentPlatform;
  listProjects: (userId: string) => Promise<ProjectRecord[]>;
  createProject: (payload: CreateProjectInput) => Promise<ProjectRecord>;
  updateProject: (payload: UpdateProjectInput) => Promise<ProjectRecord>;
  getProjectById: (projectId: string) => Promise<ProjectRecord>;
  deleteProject: (projectId: string, userId: string) => Promise<void>;
  getExistingStar: (projectId: string, userId: string) => Promise<{ id: string } | null>;
  createStar: (projectId: string, userId: string) => Promise<void>;
  deleteStarById: (starId: string) => Promise<void>;
  listApiKeys: (userId: string) => Promise<ApiKeyRecord[]>;
  upsertApiKey: (userId: string, provider: string, apiKey: string) => Promise<void>;
  deleteApiKey: (userId: string, provider: string) => Promise<void>;
  listUsageForDate: (userId: string, date: string) => Promise<UsageRecord[]>;
}

const normalizeProjectFiles = (project: { files: unknown } & Record<string, unknown>): ProjectRecord => ({
  ...(project as unknown as ProjectRecord),
  files: Array.isArray(project.files) ? (project.files as FileNode[]) : [],
});

const supabaseProvider: DataProvider = {
  platform: 'generic',
  async listProjects(userId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((project) => normalizeProjectFiles(project as any));
  },
  async createProject(payload) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...payload, files: JSON.parse(JSON.stringify(payload.files)) })
      .select()
      .single();
    if (error) throw error;
    return normalizeProjectFiles(data as any);
  },
  async updateProject(payload) {
    const { data, error } = await supabase
      .from('projects')
      .update({
        name: payload.name,
        files: JSON.parse(JSON.stringify(payload.files)),
        language: payload.language,
        description: payload.description,
        is_public: payload.is_public,
      })
      .eq('id', payload.id)
      .eq('user_id', payload.user_id)
      .select()
      .single();
    if (error) throw error;
    return normalizeProjectFiles(data as any);
  },
  async getProjectById(projectId) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) throw error;
    return normalizeProjectFiles(data as any);
  },
  async deleteProject(projectId, userId) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', userId);
    if (error) throw error;
  },
  async getExistingStar(projectId, userId) {
    const { data, error } = await supabase
      .from('project_stars')
      .select('id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string } | null;
  },
  async createStar(projectId, userId) {
    const { error } = await supabase.from('project_stars').insert({ user_id: userId, project_id: projectId });
    if (error) throw error;
  },
  async deleteStarById(starId) {
    const { error } = await supabase.from('project_stars').delete().eq('id', starId);
    if (error) throw error;
  },
  async listApiKeys(userId) {
    const { data, error } = await supabase.from('user_api_keys').select('*').eq('user_id', userId);
    if (error) throw error;
    return (data || []) as unknown as ApiKeyRecord[];
  },
  async upsertApiKey(userId, provider, apiKey) {
    const { error } = await supabase
      .from('user_api_keys')
      .upsert({ user_id: userId, provider, api_key: apiKey }, { onConflict: 'user_id,provider' });
    if (error) throw error;
  },
  async deleteApiKey(userId, provider) {
    const { error } = await supabase.from('user_api_keys').delete().eq('user_id', userId).eq('provider', provider);
    if (error) throw error;
  },
  async listUsageForDate(userId, date) {
    const { data, error } = await supabase
      .from('ai_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('usage_date', date);
    if (error) throw error;
    return (data || []) as unknown as UsageRecord[];
  },
};

const createManagedDataProvider = (platform: 'replit' | 'lovable'): DataProvider => {
  const base = platform === 'replit' ? import.meta.env.VITE_REPLIT_DB_BASE_URL : import.meta.env.VITE_LOVABLE_DB_BASE_URL;
  if (!base) {
    return { ...supabaseProvider, platform };
  }

  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = platform === 'replit' ? import.meta.env.VITE_REPLIT_DB_TOKEN : import.meta.env.VITE_LOVABLE_DB_TOKEN;
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `DB request failed (${response.status})`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };

  return {
    platform,
    listProjects: (userId) => call<ProjectRecord[]>(`/projects?user_id=${encodeURIComponent(userId)}`),
    createProject: (payload) => call<ProjectRecord>('/projects', { method: 'POST', body: JSON.stringify(payload) }),
    updateProject: ({ id, ...payload }) => call<ProjectRecord>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    getProjectById: (projectId) => call<ProjectRecord>(`/projects/${projectId}`),
    deleteProject: (projectId, userId) => call<void>(`/projects/${projectId}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    getExistingStar: (projectId, userId) => call<{ id: string } | null>(`/project-stars/find?project_id=${encodeURIComponent(projectId)}&user_id=${encodeURIComponent(userId)}`),
    createStar: (projectId, userId) => call<void>('/project-stars', { method: 'POST', body: JSON.stringify({ project_id: projectId, user_id: userId }) }),
    deleteStarById: (starId) => call<void>(`/project-stars/${starId}`, { method: 'DELETE' }),
    listApiKeys: (userId) => call<ApiKeyRecord[]>(`/user-api-keys?user_id=${encodeURIComponent(userId)}`),
    upsertApiKey: (userId, provider, apiKey) => call<void>('/user-api-keys', { method: 'PUT', body: JSON.stringify({ user_id: userId, provider, api_key: apiKey }) }),
    deleteApiKey: (userId, provider) => call<void>(`/user-api-keys?user_id=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`, { method: 'DELETE' }),
    listUsageForDate: (userId, date) => call<UsageRecord[]>(`/ai-usage?user_id=${encodeURIComponent(userId)}&usage_date=${encodeURIComponent(date)}`),
  };
};

export const createDataProvider = (): DataProvider => {
  const platform = detectDeploymentPlatform();
  if (platform === 'replit') return createManagedDataProvider('replit');
  if (platform === 'lovable') return createManagedDataProvider('lovable');
  return supabaseProvider;
};
