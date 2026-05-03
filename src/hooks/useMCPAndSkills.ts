import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { detectDeploymentPlatform, isReplitLikePlatform } from '@/lib/platform';

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  description: string | null;
  api_key: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string | null;
  instruction: string;
  icon: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const isReplit = () => isReplitLikePlatform();

async function replitFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function useMCPAndSkills() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isReplit()) {
        const [servers, sk] = await Promise.all([
          replitFetch('/api/replit/ai/mcp-servers'),
          replitFetch('/api/replit/ai/skills'),
        ]);
        setMcpServers((servers as MCPServer[]) || []);
        setSkills((sk as AgentSkill[]) || []);
      } else {
        const [{ data: servers }, { data: sk }] = await Promise.all([
          supabase.from('mcp_servers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('agent_skills').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        ]);
        setMcpServers((servers as MCPServer[]) || []);
        setSkills((sk as AgentSkill[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addMCPServer = async (server: { name: string; url: string; description?: string; api_key?: string }) => {
    if (!user) return false;
    try {
      if (isReplit()) {
        await replitFetch('/api/replit/ai/mcp-servers', { method: 'POST', body: JSON.stringify(server) });
      } else {
        const { error } = await supabase.from('mcp_servers').insert({ ...server, user_id: user.id });
        if (error) throw new Error(error.message);
      }
      toast({ title: 'MCP server added' });
      fetchAll();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to add server', variant: 'destructive' });
      return false;
    }
  };

  const updateMCPServer = async (id: string, updates: Partial<MCPServer>) => {
    try {
      if (isReplit()) {
        await replitFetch(`/api/replit/ai/mcp-servers/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
      } else {
        const { error } = await supabase.from('mcp_servers').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
      }
      fetchAll();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update server', variant: 'destructive' });
      return false;
    }
  };

  const deleteMCPServer = async (id: string) => {
    try {
      if (isReplit()) {
        await replitFetch(`/api/replit/ai/mcp-servers/${id}`, { method: 'DELETE' });
      } else {
        const { error } = await supabase.from('mcp_servers').delete().eq('id', id);
        if (error) throw new Error(error.message);
      }
      toast({ title: 'MCP server removed' });
      fetchAll();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to remove server', variant: 'destructive' });
      return false;
    }
  };

  const addSkill = async (skill: { name: string; instruction: string; description?: string; icon?: string }) => {
    if (!user) return false;
    try {
      if (isReplit()) {
        await replitFetch('/api/replit/ai/skills', { method: 'POST', body: JSON.stringify(skill) });
      } else {
        const { error } = await supabase.from('agent_skills').insert({ ...skill, user_id: user.id });
        if (error) throw new Error(error.message);
      }
      toast({ title: 'Skill added' });
      fetchAll();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to add skill', variant: 'destructive' });
      return false;
    }
  };

  const updateSkill = async (id: string, updates: Partial<AgentSkill>) => {
    try {
      if (isReplit()) {
        await replitFetch(`/api/replit/ai/skills/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
      } else {
        const { error } = await supabase.from('agent_skills').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
      }
      fetchAll();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update skill', variant: 'destructive' });
      return false;
    }
  };

  const deleteSkill = async (id: string) => {
    try {
      if (isReplit()) {
        await replitFetch(`/api/replit/ai/skills/${id}`, { method: 'DELETE' });
      } else {
        const { error } = await supabase.from('agent_skills').delete().eq('id', id);
        if (error) throw new Error(error.message);
      }
      toast({ title: 'Skill removed' });
      fetchAll();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to remove skill', variant: 'destructive' });
      return false;
    }
  };

  return { mcpServers, skills, loading, fetchAll, addMCPServer, updateMCPServer, deleteMCPServer, addSkill, updateSkill, deleteSkill };
}
