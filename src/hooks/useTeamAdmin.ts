import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  email: string | null;
  role: string;
  spending_limit_cents: number | null;
  display_name: string | null;
  accepted: boolean;
  created_at: string;
}

export interface TeamPolicy {
  id: string;
  team_id: string;
  policy_type: string;
  policy_value: Record<string, unknown>;
  is_enforced: boolean;
  created_at: string;
}

export interface TeamForm {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'rating';
  options?: string[];
  required?: boolean;
}

export interface TeamFormResponse {
  id: string;
  form_id: string;
  user_id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
}

export interface TeamCustomTemplate {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  files: unknown[];
  language: string;
  is_required: boolean;
  created_by: string;
  created_at: string;
}

export interface TeamSpending {
  id: string;
  team_id: string;
  user_id: string;
  amount_cents: number;
  category: string;
  description: string | null;
  recorded_at: string;
}

export function useTeamAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [policies, setPolicies] = useState<TeamPolicy[]>([]);
  const [forms, setForms] = useState<TeamForm[]>([]);
  const [formResponses, setFormResponses] = useState<TeamFormResponse[]>([]);
  const [customTemplates, setCustomTemplates] = useState<TeamCustomTemplate[]>([]);
  const [spending, setSpending] = useState<TeamSpending[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('teams')
      .select('*')
      .or(`owner_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    const teamList = (data || []) as unknown as Team[];
    setTeams(teamList);
    if (teamList.length > 0 && !activeTeam) {
      setActiveTeam(teamList[0]);
    }
    setLoading(false);
  }, [user, activeTeam]);

  const fetchTeamData = useCallback(async (teamId: string) => {
    const [membersRes, policiesRes, formsRes, templatesRes, spendingRes] = await Promise.all([
      supabase.from('team_members').select('*').eq('team_id', teamId).order('created_at'),
      supabase.from('team_policies').select('*').eq('team_id', teamId),
      supabase.from('team_forms').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('team_custom_templates').select('*').eq('team_id', teamId),
      supabase.from('team_spending').select('*').eq('team_id', teamId).order('recorded_at', { ascending: false }),
    ]);
    setMembers((membersRes.data || []) as unknown as TeamMember[]);
    setPolicies((policiesRes.data || []) as unknown as TeamPolicy[]);
    setForms((formsRes.data || []) as unknown as TeamForm[]);
    setCustomTemplates((templatesRes.data || []) as unknown as TeamCustomTemplate[]);
    setSpending((spendingRes.data || []) as unknown as TeamSpending[]);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  useEffect(() => {
    if (activeTeam) fetchTeamData(activeTeam.id);
  }, [activeTeam, fetchTeamData]);

  const createTeam = async (name: string, description?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('teams')
      .insert({ name, description, owner_id: user.id })
      .select()
      .single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return null; }
    toast({ title: 'Team created' });
    const team = data as unknown as Team;
    setTeams(prev => [team, ...prev]);
    setActiveTeam(team);
    return team;
  };

  const bulkAddMembers = async (teamId: string, membersList: { email: string; display_name?: string; role?: string }[]) => {
    if (!user) return false;
    const rows = membersList.map(m => ({
      team_id: teamId,
      user_id: user.id, // placeholder, will be resolved on accept
      email: m.email,
      display_name: m.display_name || m.email.split('@')[0],
      role: m.role || 'member',
    }));
    const { error } = await supabase.from('team_members').insert(rows);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: `${membersList.length} members added` });
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const updateMemberSpendingLimit = async (memberId: string, limitCents: number | null) => {
    const { error } = await supabase.from('team_members').update({ spending_limit_cents: limitCents }).eq('id', memberId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Member removed' });
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const addPolicy = async (teamId: string, policyType: string, policyValue: Record<string, unknown>) => {
    const { error } = await supabase.from('team_policies').insert({ team_id: teamId, policy_type: policyType, policy_value: policyValue });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Policy added' });
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const removePolicy = async (policyId: string) => {
    const { error } = await supabase.from('team_policies').delete().eq('id', policyId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const createForm = async (teamId: string, title: string, description: string | null, fields: FormField[]) => {
    if (!user) return false;
    const { error } = await supabase.from('team_forms').insert({
      team_id: teamId, title, description, fields: JSON.parse(JSON.stringify(fields)), created_by: user.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Form created' });
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const fetchFormResponses = async (formId: string) => {
    const { data } = await supabase.from('team_form_responses').select('*').eq('form_id', formId);
    setFormResponses((data || []) as unknown as TeamFormResponse[]);
  };

  const addCustomTemplate = async (teamId: string, template: { name: string; description?: string; files: unknown[]; language: string; is_required: boolean }) => {
    if (!user) return false;
    const { error } = await supabase.from('team_custom_templates').insert({
      team_id: teamId, ...template, files: JSON.parse(JSON.stringify(template.files)), created_by: user.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Template added' });
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const removeCustomTemplate = async (templateId: string) => {
    const { error } = await supabase.from('team_custom_templates').delete().eq('id', templateId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    if (activeTeam) fetchTeamData(activeTeam.id);
    return true;
  };

  const updateTeamSettings = async (teamId: string, settings: Record<string, unknown>) => {
    const { error } = await supabase.from('teams').update({ settings }).eq('id', teamId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Settings updated' });
    fetchTeams();
    return true;
  };

  return {
    teams, activeTeam, setActiveTeam, members, policies, forms, formResponses, customTemplates, spending, loading,
    createTeam, bulkAddMembers, updateMemberSpendingLimit, removeMember,
    addPolicy, removePolicy, createForm, fetchFormResponses,
    addCustomTemplate, removeCustomTemplate, updateTeamSettings, fetchTeams, fetchTeamData,
  };
}
