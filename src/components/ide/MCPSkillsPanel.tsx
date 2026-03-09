import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useMCPAndSkills, MCPServer, AgentSkill } from '@/hooks/useMCPAndSkills';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Server, Sparkles, Globe, Eye, EyeOff,
  Loader2, Pencil, Check, X, Zap, Brain, Code, FileText,
  Lightbulb, Wrench, Shield, Bug, Library
} from 'lucide-react';
import { SkillsLibraryDialog } from './SkillsLibraryDialog';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  brain: <Brain className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
  'file-text': <FileText className="w-4 h-4" />,
  lightbulb: <Lightbulb className="w-4 h-4" />,
  wrench: <Wrench className="w-4 h-4" />,
  shield: <Shield className="w-4 h-4" />,
  bug: <Bug className="w-4 h-4" />,
};

const ICON_OPTIONS = Object.keys(SKILL_ICONS);

// ─── MCP Servers Tab ───
export function MCPServersPanel() {
  const { user } = useAuth();
  const { mcpServers, loading, addMCPServer, updateMCPServer, deleteMCPServer } = useMCPAndSkills();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Server className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Sign in to manage MCP servers</p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    const ok = await addMCPServer({
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || undefined,
      api_key: apiKey.trim() || undefined,
    });
    setSaving(false);
    if (ok) {
      setShowForm(false);
      setName(''); setUrl(''); setDescription(''); setApiKey('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">MCP Servers</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect Model Context Protocol servers to extend agent capabilities
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="p-4 rounded-lg border border-border bg-card/50 space-y-3">
          <Input placeholder="Server name" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="Server URL (e.g. https://mcp.example.com)" value={url} onChange={e => setUrl(e.target.value)} />
          <Input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              placeholder="API key (optional)"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="pr-10"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setName(''); setUrl(''); setDescription(''); setApiKey(''); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !url.trim() || saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Add Server
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : mcpServers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Globe className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No MCP servers configured</p>
          <p className="text-xs mt-1">Add a server to give the agent access to external tools</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mcpServers.map(server => (
            <MCPServerCard
              key={server.id}
              server={server}
              onToggle={(enabled) => updateMCPServer(server.id, { is_enabled: enabled })}
              onDelete={() => deleteMCPServer(server.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MCPServerCard({ server, onToggle, onDelete }: { server: MCPServer; onToggle: (v: boolean) => void; onDelete: () => void }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
      server.is_enabled ? "border-border bg-card/50" : "border-border/50 bg-muted/30 opacity-60"
    )}>
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Server className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{server.name}</p>
        <p className="text-xs text-muted-foreground truncate">{server.url}</p>
      </div>
      <Switch checked={server.is_enabled} onCheckedChange={onToggle} />
      <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Agent Skills Tab ───
export function AgentSkillsPanel() {
  const { user } = useAuth();
  const { skills, loading, addSkill, updateSkill, deleteSkill } = useMCPAndSkills();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [icon, setIcon] = useState('sparkles');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Sparkles className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Sign in to manage agent skills</p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!name.trim() || !instruction.trim()) return;
    setSaving(true);
    const ok = await addSkill({
      name: name.trim(),
      instruction: instruction.trim(),
      description: description.trim() || undefined,
      icon,
    });
    setSaving(false);
    if (ok) {
      setShowForm(false);
      setName(''); setDescription(''); setInstruction(''); setIcon('sparkles');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Agent Skills</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Custom instructions and capabilities for the AI agent
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="p-4 rounded-lg border border-border bg-card/50 space-y-3">
          <Input placeholder="Skill name (e.g. Code Reviewer)" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="Short description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          <Textarea
            placeholder="Instructions for the agent (e.g. Always follow accessibility best practices when generating HTML...)"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            rows={4}
          />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Icon</p>
            <div className="flex gap-1.5 flex-wrap">
              {ICON_OPTIONS.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                    icon === ic ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"
                  )}
                >
                  {SKILL_ICONS[ic]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setName(''); setDescription(''); setInstruction(''); setIcon('sparkles'); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !instruction.trim() || saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Add Skill
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No custom skills defined</p>
          <p className="text-xs mt-1">Add skills to customize how the agent behaves</p>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={(enabled) => updateSkill(skill.id, { is_enabled: enabled })}
              onDelete={() => deleteSkill(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillCard({ skill, onToggle, onDelete }: { skill: AgentSkill; onToggle: (v: boolean) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      skill.is_enabled ? "border-border bg-card/50" : "border-border/50 bg-muted/30 opacity-60"
    )}>
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          {SKILL_ICONS[skill.icon] || <Sparkles className="w-4 h-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <p className="text-sm font-medium truncate">{skill.name}</p>
          {skill.description && <p className="text-xs text-muted-foreground truncate">{skill.description}</p>}
        </div>
        <Switch checked={skill.is_enabled} onCheckedChange={onToggle} />
        <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="p-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
            {skill.instruction}
          </div>
        </div>
      )}
    </div>
  );
}
