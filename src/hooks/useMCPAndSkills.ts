import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

export function useMCPAndSkills() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: servers }, { data: sk }] = await Promise.all([
      supabase.from('mcp_servers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('agent_skills').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setMcpServers((servers as MCPServer[]) || []);
    setSkills((sk as AgentSkill[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addMCPServer = async (server: { name: string; url: string; description?: string; api_key?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from('mcp_servers').insert({ ...server, user_id: user.id });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'MCP server added' });
    fetchAll();
    return true;
  };

  const updateMCPServer = async (id: string, updates: Partial<MCPServer>) => {
    const { error } = await supabase.from('mcp_servers').update(updates).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    fetchAll();
    return true;
  };

  const deleteMCPServer = async (id: string) => {
    const { error } = await supabase.from('mcp_servers').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'MCP server removed' });
    fetchAll();
    return true;
  };

  const addSkill = async (skill: { name: string; instruction: string; description?: string; icon?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from('agent_skills').insert({ ...skill, user_id: user.id });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Skill added' });
    fetchAll();
    return true;
  };

  const updateSkill = async (id: string, updates: Partial<AgentSkill>) => {
    const { error } = await supabase.from('agent_skills').update(updates).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    fetchAll();
    return true;
  };

  const deleteSkill = async (id: string) => {
    const { error } = await supabase.from('agent_skills').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Skill removed' });
    fetchAll();
    return true;
  };

  return { mcpServers, skills, loading, fetchAll, addMCPServer, updateMCPServer, deleteMCPServer, addSkill, updateSkill, deleteSkill };
}
