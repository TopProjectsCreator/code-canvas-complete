import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Lock, FileCode, X, icons, LucideIcon } from 'lucide-react';
import { LucideIconPicker } from './LucideIconPicker';
import type { useTeamAdmin } from '@/hooks/useTeamAdmin';

interface TemplateFile {
  name: string;
  content: string;
}

interface Props {
  teamAdmin: ReturnType<typeof useTeamAdmin>;
}

export const TeamTemplatesTab = ({ teamAdmin }: Props) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [isRequired, setIsRequired] = useState(false);
  const [icon, setIcon] = useState('');
  const [files, setFiles] = useState<TemplateFile[]>([{ name: 'index.ts', content: '' }]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);

  const resetForm = () => {
    setCreating(false);
    setName('');
    setDescription('');
    setIcon('');
    setFiles([{ name: 'index.ts', content: '' }]);
    setActiveFileIdx(0);
    setIsRequired(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !teamAdmin.activeTeam) return;
    await teamAdmin.addCustomTemplate(teamAdmin.activeTeam.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      files: files.filter(f => f.name.trim()),
      language,
      is_required: isRequired,
      icon: icon || undefined,
    });
    resetForm();
  };

  const addFile = () => {
    setFiles(prev => [...prev, { name: '', content: '' }]);
    setActiveFileIdx(files.length);
  };

  const removeFile = (idx: number) => {
    if (files.length <= 1) return;
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setActiveFileIdx(Math.max(0, activeFileIdx >= idx ? activeFileIdx - 1 : activeFileIdx));
  };

  const updateFile = (idx: number, field: 'name' | 'content', value: string) => {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  };

  const handleIconUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setIcon(reader.result as string);
    reader.readAsDataURL(file);
  };

  const getTemplateIcon = (t: { icon?: string | null }) => {
    if (!t.icon) return <FileCode className="w-5 h-5 text-muted-foreground" />;
    const isUrl = t.icon.startsWith('http') || t.icon.startsWith('data:');
    if (isUrl) return <img src={t.icon} alt="" className="w-5 h-5 object-contain" />;
    const Icon = (icons as Record<string, LucideIcon>)[t.icon];
    return Icon ? <Icon className="w-5 h-5 text-foreground" /> : <FileCode className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 pt-4">
      {!creating ? (
        <Button onClick={() => setCreating(true)} className="gap-1"><Plus className="w-3 h-3" /> Add Template</Button>
      ) : (
        <div className="border rounded-md p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="pt-1">
              <LucideIconPicker value={icon} onChange={setIcon} onUploadIcon={handleIconUpload} />
              <p className="text-[10px] text-muted-foreground mt-1 text-center">Icon</p>
            </div>
            <div className="flex-1 space-y-2">
              <Input placeholder="Template name" value={name} onChange={e => setName(e.target.value)} />
              <Textarea placeholder="Description — explain when members should use this template" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="arduino">Arduino</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
            <div className="flex items-center gap-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              <span className="text-xs text-muted-foreground">Required for all members</span>
            </div>
          </div>

          {/* Template files editor */}
          <div className="border rounded-md overflow-hidden">
            <div className="flex items-center gap-1 bg-muted/30 px-2 py-1 border-b overflow-x-auto">
              {files.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveFileIdx(idx)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                    idx === activeFileIdx ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileCode className="w-3 h-3" />
                  {f.name || 'untitled'}
                  {files.length > 1 && (
                    <X className="w-3 h-3 ml-1 opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); removeFile(idx); }} />
                  )}
                </button>
              ))}
              <button onClick={addFile} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 space-y-2">
              <Input
                placeholder="Filename (e.g. src/index.ts)"
                value={files[activeFileIdx]?.name || ''}
                onChange={e => updateFile(activeFileIdx, 'name', e.target.value)}
                className="text-xs h-8 font-mono"
              />
              <textarea
                placeholder="File content..."
                value={files[activeFileIdx]?.content || ''}
                onChange={e => updateFile(activeFileIdx, 'content', e.target.value)}
                className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!name.trim()}>Create Template</Button>
            <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {teamAdmin.customTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No custom templates yet</p>
        ) : teamAdmin.customTemplates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getTemplateIcon(t as { icon?: string | null })}
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.language}
                    {t.description && ` — ${t.description}`}
                    {Array.isArray(t.files) && t.files.length > 0 && ` · ${t.files.length} file${t.files.length > 1 ? 's' : ''}`}
                  </p>
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
