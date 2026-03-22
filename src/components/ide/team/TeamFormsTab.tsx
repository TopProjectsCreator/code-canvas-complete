import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Send } from 'lucide-react';
import type { useTeamAdmin, FormField } from '@/hooks/useTeamAdmin';

interface Props {
  teamAdmin: ReturnType<typeof useTeamAdmin>;
}

export const TeamFormsTab = ({ teamAdmin }: Props) => {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [viewingResponses, setViewingResponses] = useState<string | null>(null);

  const addField = () => {
    setFields(prev => [...prev, { id: crypto.randomUUID(), label: '', type: 'text', required: false }]);
  };

  const updateField = (idx: number, updates: Partial<FormField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));

  const handleCreate = async () => {
    if (!title.trim() || !teamAdmin.activeTeam) return;
    await teamAdmin.createForm(teamAdmin.activeTeam.id, title.trim(), description.trim() || null, fields);
    setCreating(false);
    setTitle('');
    setDescription('');
    setFields([]);
  };

  const handleViewResponses = (formId: string) => {
    setViewingResponses(formId);
    teamAdmin.fetchFormResponses(formId);
  };

  return (
    <div className="space-y-4 pt-4">
      {!creating ? (
        <Button onClick={() => setCreating(true)} className="gap-1"><Plus className="w-3 h-3" /> Create Form</Button>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <Input placeholder="Form title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />

          <div className="space-y-2">
            <p className="text-sm font-medium">Fields</p>
            {fields.map((f, i) => (
              <div key={f.id} className="flex gap-2 items-center">
                <Input className="flex-1" placeholder="Question" value={f.label} onChange={e => updateField(i, { label: e.target.value })} />
                <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={f.type} onChange={e => updateField(i, { type: e.target.value as FormField['type'] })}>
                  <option value="text">Text</option>
                  <option value="textarea">Long Text</option>
                  <option value="select">Multiple Choice</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="rating">Rating</option>
                </select>
                <Button variant="ghost" size="sm" onClick={() => removeField(i)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addField} className="gap-1"><Plus className="w-3 h-3" /> Add Field</Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>Create Form</Button>
            <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {teamAdmin.forms.map(form => (
          <Card key={form.id}>
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{form.title}</CardTitle>
                <div className="flex gap-1">
                  <Badge variant={form.is_active ? 'default' : 'secondary'}>{form.is_active ? 'Active' : 'Closed'}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleViewResponses(form.id)}><Eye className="w-3 h-3" /></Button>
                </div>
              </div>
            </CardHeader>
            {form.description && <CardContent className="p-3 pt-0"><p className="text-xs text-muted-foreground">{form.description}</p></CardContent>}
            {viewingResponses === form.id && (
              <CardContent className="p-3 pt-0 border-t">
                <p className="text-xs font-medium mb-2">Responses ({teamAdmin.formResponses.length})</p>
                {teamAdmin.formResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No responses yet</p>
                ) : teamAdmin.formResponses.map(r => (
                  <div key={r.id} className="text-xs p-2 border rounded mb-1">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(r.answers, null, 2)}</pre>
                    <span className="text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
