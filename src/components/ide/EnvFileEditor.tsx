import { useEffect, useMemo, useState } from 'react';
import { FileNode } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { icons, LucideIcon, FolderPlus, Plus, Trash2 } from 'lucide-react';

interface EnvFileEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

type EnvFolder = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

type EnvSecret = {
  id: string;
  key: string;
  value: string;
  name: string;
  color: string;
  icon: string;
  folderId: string;
};

const META_PREFIX = '# code-canvas:';
const DEFAULT_FOLDER_ID = 'unassigned';
const ICON_OPTIONS = ['Key', 'Lock', 'Shield', 'Database', 'Globe', 'Server', 'Cloud', 'Folder', 'FolderLock', 'Package'];

const safeJsonParse = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `env-${Math.random().toString(36).slice(2, 10)}`;
};

const parseEnvFile = (content: string): { folders: EnvFolder[]; secrets: EnvSecret[] } => {
  const lines = content.split('\n');
  const folders = new Map<string, EnvFolder>();
  const secrets: EnvSecret[] = [];

  let pendingSecretMeta: Partial<EnvSecret> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith(`${META_PREFIX}folder`)) {
      const payload = trimmed.replace(`${META_PREFIX}folder`, '').trim();
      const meta = safeJsonParse<Partial<EnvFolder>>(payload);
      if (meta?.id) {
        folders.set(meta.id, {
          id: meta.id,
          name: meta.name || 'Folder',
          color: meta.color || '#6366f1',
          icon: meta.icon || 'Folder',
        });
      }
      continue;
    }

    if (trimmed.startsWith(`${META_PREFIX}secret`)) {
      const payload = trimmed.replace(`${META_PREFIX}secret`, '').trim();
      pendingSecretMeta = safeJsonParse<Partial<EnvSecret>>(payload) || null;
      continue;
    }

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (!key) continue;

    const secret: EnvSecret = {
      id: createId(),
      key,
      value,
      name: pendingSecretMeta?.name || key,
      color: pendingSecretMeta?.color || '#64748b',
      icon: pendingSecretMeta?.icon || 'Key',
      folderId: pendingSecretMeta?.folderId || DEFAULT_FOLDER_ID,
    };

    secrets.push(secret);
    pendingSecretMeta = null;
  }

  return { folders: Array.from(folders.values()), secrets };
};

const serializeEnvFile = (folders: EnvFolder[], secrets: EnvSecret[]) => {
  const lines: string[] = [];

  folders.forEach((folder) => {
    lines.push(`${META_PREFIX}folder ${JSON.stringify(folder)}`);
  });

  const grouped = [...secrets].sort((a, b) => {
    if (a.folderId !== b.folderId) return a.folderId.localeCompare(b.folderId);
    return a.name.localeCompare(b.name);
  });

  grouped.forEach((secret) => {
    const secretMeta = {
      name: secret.name,
      folderId: secret.folderId,
      color: secret.color,
      icon: secret.icon,
    };
    lines.push(`${META_PREFIX}secret ${JSON.stringify(secretMeta)}`);
    lines.push(`${secret.key}=${secret.value}`);
  });

  return `${lines.join('\n')}\n`;
};

const iconForName = (name: string): LucideIcon => {
  const Icon = (icons as Record<string, LucideIcon>)[name];
  return Icon || icons.Key;
};

export const EnvFileEditor = ({ file, onContentChange }: EnvFileEditorProps) => {
  const [folders, setFolders] = useState<EnvFolder[]>([]);
  const [secrets, setSecrets] = useState<EnvSecret[]>([]);

  useEffect(() => {
    const parsed = parseEnvFile(file.content || '');
    setFolders(parsed.folders);
    setSecrets(parsed.secrets);
  }, [file.id, file.content]);

  const persist = (nextFolders: EnvFolder[], nextSecrets: EnvSecret[]) => {
    setFolders(nextFolders);
    setSecrets(nextSecrets);
    onContentChange(file.id, serializeEnvFile(nextFolders, nextSecrets));
  };

  const folderOptions = useMemo(
    () => [{ id: DEFAULT_FOLDER_ID, name: 'No folder', color: '#334155', icon: 'Folder' }, ...folders],
    [folders],
  );

  const groupedSecrets = useMemo(() => {
    const groups = new Map<string, EnvSecret[]>();
    secrets.forEach((secret) => {
      const key = secret.folderId || DEFAULT_FOLDER_ID;
      const existing = groups.get(key) || [];
      existing.push(secret);
      groups.set(key, existing);
    });
    return groups;
  }, [secrets]);

  const addFolder = () => {
    const nextFolders = [
      ...folders,
      { id: createId(), name: `Folder ${folders.length + 1}`, color: '#6366f1', icon: 'Folder' },
    ];
    persist(nextFolders, secrets);
  };

  const addSecret = () => {
    const nextSecrets = [
      ...secrets,
      {
        id: createId(),
        key: 'NEW_SECRET',
        value: '',
        name: 'New Secret',
        color: '#64748b',
        icon: 'Key',
        folderId: DEFAULT_FOLDER_ID,
      },
    ];
    persist(folders, nextSecrets);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden bg-editor p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">.env Visual Manager</h3>
          <p className="text-xs text-muted-foreground">Add key/value secrets with labels, icons, colors, and folders.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addFolder} className="gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Folder
          </Button>
          <Button size="sm" onClick={addSecret} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Secret
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Folders</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-320px)] pr-2">
              <div className="space-y-3">
                {folders.map((folder) => {
                  const Icon = iconForName(folder.icon);
                  return (
                    <div key={folder.id} className="space-y-2 rounded-md border border-border p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded" style={{ backgroundColor: `${folder.color}33` }}>
                          <Icon className="h-4 w-4" style={{ color: folder.color }} />
                        </div>
                        <Input
                          value={folder.name}
                          onChange={(e) => {
                            const nextFolders = folders.map((item) => (item.id === folder.id ? { ...item, name: e.target.value } : item));
                            persist(nextFolders, secrets);
                          }}
                          className="h-7 text-xs"
                        />
                        <button
                          onClick={() => {
                            const nextFolders = folders.filter((item) => item.id !== folder.id);
                            const nextSecrets = secrets.map((item) =>
                              item.folderId === folder.id ? { ...item, folderId: DEFAULT_FOLDER_ID } : item,
                            );
                            persist(nextFolders, nextSecrets);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Select
                          value={folder.icon}
                          onValueChange={(value) => {
                            const nextFolders = folders.map((item) => (item.id === folder.id ? { ...item, icon: value } : item));
                            persist(nextFolders, secrets);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ICON_OPTIONS.map((iconName) => (
                              <SelectItem key={iconName} value={iconName} className="text-xs">
                                {iconName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="color"
                          value={folder.color}
                          onChange={(e) => {
                            const nextFolders = folders.map((item) => (item.id === folder.id ? { ...item, color: e.target.value } : item));
                            persist(nextFolders, secrets);
                          }}
                          className="h-7 w-10 p-1"
                        />
                      </div>
                    </div>
                  );
                })}
                {folders.length === 0 && <p className="text-xs text-muted-foreground">No folders yet. Create one to organize secrets.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Secrets</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-320px)] pr-2">
              <div className="space-y-4">
                {folderOptions.map((folder) => {
                  const folderSecrets = groupedSecrets.get(folder.id) || [];
                  if (folderSecrets.length === 0) return null;
                  const FolderIcon = iconForName(folder.icon);

                  return (
                    <div key={folder.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FolderIcon className="h-4 w-4" style={{ color: folder.color }} />
                        <p className="text-xs font-medium">{folder.name}</p>
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {folderSecrets.length}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {folderSecrets.map((secret) => {
                          const SecretIcon = iconForName(secret.icon);
                          return (
                            <div key={secret.id} className="rounded-md border border-border p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded" style={{ backgroundColor: `${secret.color}33` }}>
                                    <SecretIcon className="h-4 w-4" style={{ color: secret.color }} />
                                  </div>
                                  <Input
                                    value={secret.name}
                                    onChange={(e) => {
                                      const nextSecrets = secrets.map((item) =>
                                        item.id === secret.id ? { ...item, name: e.target.value } : item,
                                      );
                                      persist(folders, nextSecrets);
                                    }}
                                    className="h-7 w-52 text-xs"
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    const nextSecrets = secrets.filter((item) => item.id !== secret.id);
                                    persist(folders, nextSecrets);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Key</Label>
                                  <Input
                                    value={secret.key}
                                    onChange={(e) => {
                                      const nextSecrets = secrets.map((item) =>
                                        item.id === secret.id ? { ...item, key: e.target.value.toUpperCase().replace(/\s+/g, '_') } : item,
                                      );
                                      persist(folders, nextSecrets);
                                    }}
                                    className="h-8 font-mono text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Value</Label>
                                  <Input
                                    value={secret.value}
                                    onChange={(e) => {
                                      const nextSecrets = secrets.map((item) =>
                                        item.id === secret.id ? { ...item, value: e.target.value } : item,
                                      );
                                      persist(folders, nextSecrets);
                                    }}
                                    className="h-8 font-mono text-xs"
                                  />
                                </div>
                              </div>

                              <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
                                <Select
                                  value={secret.folderId || DEFAULT_FOLDER_ID}
                                  onValueChange={(value) => {
                                    const nextSecrets = secrets.map((item) =>
                                      item.id === secret.id ? { ...item, folderId: value } : item,
                                    );
                                    persist(folders, nextSecrets);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Folder" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {folderOptions.map((option) => (
                                      <SelectItem key={option.id} value={option.id} className="text-xs">
                                        {option.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Select
                                  value={secret.icon}
                                  onValueChange={(value) => {
                                    const nextSecrets = secrets.map((item) =>
                                      item.id === secret.id ? { ...item, icon: value } : item,
                                    );
                                    persist(folders, nextSecrets);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ICON_OPTIONS.map((iconName) => (
                                      <SelectItem key={iconName} value={iconName} className="text-xs">
                                        {iconName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Input
                                  type="color"
                                  value={secret.color}
                                  onChange={(e) => {
                                    const nextSecrets = secrets.map((item) =>
                                      item.id === secret.id ? { ...item, color: e.target.value } : item,
                                    );
                                    persist(folders, nextSecrets);
                                  }}
                                  className="h-7 p-1"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {secrets.length === 0 && <p className="text-xs text-muted-foreground">No secrets yet. Click Secret to add your first entry.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
