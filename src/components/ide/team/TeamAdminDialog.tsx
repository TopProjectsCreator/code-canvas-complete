import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeamAdmin } from '@/hooks/useTeamAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Shield, FileText, BarChart3, Layout, Plus } from 'lucide-react';
import { TeamMembersTab } from './TeamMembersTab';
import { TeamPoliciesTab } from './TeamPoliciesTab';
import { TeamFormsTab } from './TeamFormsTab';
import { TeamAnalyticsTab } from './TeamAnalyticsTab';
import { TeamTemplatesTab } from './TeamTemplatesTab';

interface TeamAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TeamAdminDialog = ({ open, onOpenChange }: TeamAdminDialogProps) => {
  const { user } = useAuth();
  const teamAdmin = useTeamAdmin();
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  if (!user) return null;

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    await teamAdmin.createTeam(newTeamName.trim(), newTeamDesc.trim() || undefined);
    setNewTeamName('');
    setNewTeamDesc('');
    setShowCreate(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Management
          </DialogTitle>
        </DialogHeader>

        {teamAdmin.teams.length === 0 && !showCreate ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Users className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">No teams yet. Create one to manage your organization.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Team
            </Button>
          </div>
        ) : showCreate ? (
          <div className="space-y-4 py-4">
            <Input placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
            <Input placeholder="Description (optional)" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Create</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={teamAdmin.activeTeam?.id || ''}
                onChange={e => {
                  const t = teamAdmin.teams.find(t => t.id === e.target.value);
                  if (t) teamAdmin.setActiveTeam(t);
                }}
              >
                {teamAdmin.teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {teamAdmin.activeTeam && (
              <Tabs defaultValue="members">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="members" className="gap-1 text-xs">
                    <Users className="w-3 h-3" /> Members
                  </TabsTrigger>
                  <TabsTrigger value="policies" className="gap-1 text-xs">
                    <Shield className="w-3 h-3" /> Policies
                  </TabsTrigger>
                  <TabsTrigger value="forms" className="gap-1 text-xs">
                    <FileText className="w-3 h-3" /> Forms
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="gap-1 text-xs">
                    <BarChart3 className="w-3 h-3" /> Analytics
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="gap-1 text-xs">
                    <Layout className="w-3 h-3" /> Templates
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="members">
                  <TeamMembersTab teamAdmin={teamAdmin} />
                </TabsContent>
                <TabsContent value="policies">
                  <TeamPoliciesTab teamAdmin={teamAdmin} />
                </TabsContent>
                <TabsContent value="forms">
                  <TeamFormsTab teamAdmin={teamAdmin} />
                </TabsContent>
                <TabsContent value="analytics">
                  <TeamAnalyticsTab teamAdmin={teamAdmin} />
                </TabsContent>
                <TabsContent value="templates">
                  <TeamTemplatesTab teamAdmin={teamAdmin} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
