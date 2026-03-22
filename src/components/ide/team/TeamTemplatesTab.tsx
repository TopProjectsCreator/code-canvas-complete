import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Lock } from 'lucide-react';
import type { useTeamAdmin } from '@/hooks/useTeamAdmin';

interface Props {
  teamAdmin: ReturnType<typeof useTeamAdmin>;
}

export const TeamTemplatesTab = ({ teamAdmin }: Props) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [isRequired, setIsRequired] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !teamAdmin.activeTeam) return;
    await teamAdmin.addCustomTemplate(teamAdmin.activeTeam.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      files: [],
      language,
      is_required: isRequired,
    });
    setCreating(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-4 pt-4">
      {!creating ? (
        <Button onClick={() => setCreating(true)} className="gap-1"><Plus className="w-3 h-3" /> Add Template</Button>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <Input placeholder="Template name" value={name} onChange={e => setName(e.target.value)} />
          <Textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="html">HTML</option>
            <option value="arduino">Arduino</option>
          </select>
          <div className="flex items-center gap-2">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            <span className="text-sm">Force all members to use this template</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!name.trim()}>Add</Button>
            <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {teamAdmin.customTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No custom templates</p>
        ) : teamAdmin.customTemplates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {t.is_required && <Lock className="w-3 h-3 text-destructive" />}
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.language} {t.description && `— ${t.description}`}</p>
                </div>
                {t.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => teamAdmin.removeCustomTemplate(t.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
