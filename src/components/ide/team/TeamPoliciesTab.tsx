import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GitBranch, Code, Package, Palette } from 'lucide-react';
import type { useTeamAdmin } from '@/hooks/useTeamAdmin';

const POLICY_TYPES = [
  { id: 'force_git', label: 'Require Git Setup', icon: GitBranch, desc: 'Members must configure git before working' },
  { id: 'force_language', label: 'Required Language', icon: Code, desc: 'Force a specific language/template' },
  { id: 'force_library', label: 'Required Libraries', icon: Package, desc: 'Force specific packages to be installed' },
  { id: 'force_theme', label: 'IDE Theme', icon: Palette, desc: 'Enforce a specific IDE theme for all members' },
  { id: 'force_template', label: 'Required Template', icon: Code, desc: 'Force members to use a specific project template' },
  { id: 'disable_mcp', label: 'MCP Control', icon: Package, desc: 'Control which MCP servers are allowed' },
  { id: 'disable_skills', label: 'Skills Control', icon: Code, desc: 'Control which agent skills are allowed' },
];

interface Props {
  teamAdmin: ReturnType<typeof useTeamAdmin>;
}

export const TeamPoliciesTab = ({ teamAdmin }: Props) => {
  const [addingType, setAddingType] = useState<string | null>(null);
  const [policyValue, setPolicyValue] = useState('');

  const handleAddPolicy = async () => {
    if (!addingType || !teamAdmin.activeTeam) return;
    const value: Record<string, unknown> = {};
    if (addingType === 'force_git') value.required = true;
    else if (addingType === 'force_language') value.language = policyValue;
    else if (addingType === 'force_library') value.packages = policyValue.split(',').map(p => p.trim());
    else if (addingType === 'force_theme') value.theme = policyValue;
    else if (addingType === 'force_template') value.template = policyValue;
    else value.config = policyValue;

    await teamAdmin.addPolicy(teamAdmin.activeTeam.id, addingType, value);
    setAddingType(null);
    setPolicyValue('');
  };

  const existingTypes = new Set(teamAdmin.policies.map(p => p.policy_type));

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {POLICY_TYPES.filter(pt => !existingTypes.has(pt.id)).map(pt => (
          <Card key={pt.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setAddingType(pt.id)}>
            <CardContent className="flex items-center gap-3 p-3">
              <pt.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{pt.label}</p>
                <p className="text-xs text-muted-foreground">{pt.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {addingType && (
        <div className="border rounded-md p-4 space-y-3">
          <p className="text-sm font-medium">Configure: {POLICY_TYPES.find(p => p.id === addingType)?.label}</p>
          {addingType !== 'force_git' && (
            <Input placeholder={addingType === 'force_library' ? 'pkg1, pkg2, pkg3' : 'Value'} value={policyValue} onChange={e => setPolicyValue(e.target.value)} />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddPolicy}>Add Policy</Button>
            <Button size="sm" variant="outline" onClick={() => setAddingType(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Active Policies</p>
        {teamAdmin.policies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No policies configured</p>
        ) : teamAdmin.policies.map(p => {
          const meta = POLICY_TYPES.find(pt => pt.id === p.policy_type);
          return (
            <div key={p.id} className="flex items-center justify-between p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Badge variant={p.is_enforced ? 'default' : 'secondary'}>{p.is_enforced ? 'Enforced' : 'Optional'}</Badge>
                <span className="text-sm">{meta?.label || p.policy_type}</span>
                <span className="text-xs text-muted-foreground">{JSON.stringify(p.policy_value)}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => teamAdmin.removePolicy(p.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
