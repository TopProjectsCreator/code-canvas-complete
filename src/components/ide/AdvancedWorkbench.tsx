import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Database,
  Diff,
  FileCode2,
  FlaskConical,
  FolderGit2,
  Highlighter,
  Link2,
  Mic,
  Palette,
  Pin,
  PlayCircle,
  Radar,
  Regex,
  Replace,
  Rocket,
  ScrollText,
  SearchCode,
  Sparkles,
  TestTube2,
  Video,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  applySuggestion,
  buildRegexPreview,
  extractColorPalette,
  extractDependencyGraph,
  extractScopeHeaders,
  extractSymbols,
  generateReviewSuggestions,
  generateUnitTestFile,
  getScopeForLine,
} from '@/lib/advancedWorkbench';
import { FileNode } from '@/types/ide';
import { useCollaboration } from '@/hooks/useCollaboration';

interface AdvancedWorkbenchProps {
  file: FileNode;
  allFiles: FileNode[];
  currentFilePath?: string | null;
  selectedLine: number | null;
  onContentChange: (fileId: string, content: string) => void;
  onCreateOrUpdateFile: (name: string, content: string, language?: string) => void;
  collab?: ReturnType<typeof useCollaboration>;
}

const storageKey = 'advanced-workbench-prompts-v1';

const templateGallery = [
  { name: 'Next.js SaaS', stack: 'Next.js · Prisma · Stripe', action: 'Scaffold app shell, auth, billing, and dashboard.' },
  { name: 'FastAPI AI API', stack: 'FastAPI · Celery · Redis', action: 'Create async endpoints, workers, and telemetry.' },
  { name: 'Realtime Supabase', stack: 'Vite · Supabase · Edge Functions', action: 'Bootstrap auth, storage, presence, and RLS.' },
  { name: 'Electron Desktop', stack: 'Electron · React · SQLite', action: 'Generate desktop shell, preload bridge, and packaging.' },
];

const dockerGraph = [
  { name: 'web', detail: 'Vite preview / reverse proxy', links: ['api', 'worker'] },
  { name: 'api', detail: 'REST + GraphQL', links: ['postgres', 'redis'] },
  { name: 'worker', detail: 'queue consumers / cron', links: ['redis', 'postgres'] },
  { name: 'postgres', detail: 'primary relational store', links: [] },
  { name: 'redis', detail: 'cache / jobs / presence', links: [] },
];

const pipelineSteps = [
  { name: 'Build', duration: '2m 14s', status: 'success' },
  { name: 'Test', duration: '3m 08s', status: 'success' },
  { name: 'Security Scan', duration: '1m 04s', status: 'running' },
  { name: 'Deploy', duration: 'Pending', status: 'idle' },
];

const flamegraph = [
  { label: 'renderEditorFrame', width: 92, color: 'bg-violet-500' },
  { label: 'tokenizeBuffer', width: 74, color: 'bg-fuchsia-500' },
  { label: 'syncPresence', width: 56, color: 'bg-cyan-500' },
  { label: 'compilePreview', width: 40, color: 'bg-emerald-500' },
  { label: 'persistDraft', width: 28, color: 'bg-amber-500' },
];

const apiPresets = [
  { method: 'GET', name: 'Health check', url: '/api/health' },
  { method: 'POST', name: 'Generate tests', url: '/functions/v1/ai-generate-tests' },
  { method: 'POST', name: 'Explain symbol', url: '/functions/v1/ai-explain-symbol' },
];

const schemaTables = [
  { name: 'prompt_history', columns: ['id uuid pk', 'project_id uuid', 'prompt text', 'result jsonb', 'created_at timestamptz'] },
  { name: 'context_pins', columns: ['id uuid pk', 'project_id uuid', 'file_path text', 'symbol text', 'note text'] },
  { name: 'session_recordings', columns: ['id uuid pk', 'project_id uuid', 'events jsonb', 'duration_ms int', 'created_at timestamptz'] },
  { name: 'env_secrets', columns: ['id uuid pk', 'project_id uuid', 'key text', 'ciphertext text', 'scope text'] },
];

const envDefaults = [
  { key: 'OPENAI_API_KEY', value: '••••••••••', scope: 'preview', encrypted: true },
  { key: 'SUPABASE_URL', value: 'https://project.supabase.co', scope: 'shared', encrypted: false },
  { key: 'SENTRY_DSN', value: '••••••••••', scope: 'production', encrypted: true },
];

const buildReviewSummary = (content: string) => {
  const suggestions = generateReviewSuggestions(content);
  return {
    suggestions,
    score: Math.max(68, 100 - suggestions.length * 7),
  };
};

export const AdvancedWorkbench = ({
  file,
  allFiles,
  currentFilePath,
  selectedLine,
  onContentChange,
  onCreateOrUpdateFile,
  collab,
}: AdvancedWorkbenchProps) => {
  const [promptDraft, setPromptDraft] = useState('Explain the failure mode and generate tests for the selected function.');
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [pinnedContexts, setPinnedContexts] = useState<string[]>(currentFilePath ? [currentFilePath] : []);
  const [regexPattern, setRegexPattern] = useState('console\\.log');
  const [regexReplacement, setRegexReplacement] = useState('logger.debug');
  const [regexTesterInput, setRegexTesterInput] = useState(file.content || '');
  const [apiBody, setApiBody] = useState('{\n  "symbol": "renderEditorFrame"\n}');
  const [bookmarks, setBookmarks] = useState<Array<{ name: string; line: number; note: string }>>([]);
  const [annotation, setAnnotation] = useState('');
  const [reviewDismissed, setReviewDismissed] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setPromptHistory(JSON.parse(saved));
      } catch {
        setPromptHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    if (currentFilePath) {
      setPinnedContexts((prev) => Array.from(new Set([currentFilePath, ...prev])));
    }
  }, [currentFilePath]);

  const reviewSummary = useMemo(() => buildReviewSummary(file.content || ''), [file.content]);
  const visibleSuggestions = useMemo(
    () => reviewSummary.suggestions.filter((suggestion) => !reviewDismissed.includes(suggestion.id)),
    [reviewDismissed, reviewSummary.suggestions],
  );
  const regexPreview = useMemo(() => buildRegexPreview(allFiles, regexPattern, regexReplacement), [allFiles, regexPattern, regexReplacement]);
  const dependencyGraph = useMemo(() => extractDependencyGraph(allFiles), [allFiles]);
  const palette = useMemo(() => extractColorPalette(allFiles), [allFiles]);
  const scopes = useMemo(() => extractScopeHeaders(file.content || ''), [file.content]);
  const currentScope = useMemo(() => getScopeForLine(file.content || '', selectedLine || 1), [file.content, selectedLine]);
  const symbols = useMemo(() => extractSymbols(file.content || ''), [file.content]);
  const currentThreads = useMemo(
    () => collab?.comments.filter((comment) => comment.file_path === currentFilePath && !comment.parent_id) || [],
    [collab?.comments, currentFilePath],
  );
  const activeRoomMembers = useMemo(
    () => collab?.presence.filter((member) => member.currentFile === currentFilePath) || [],
    [collab?.presence, currentFilePath],
  );

  const selectedInsight = useMemo(
    () => symbols.find((symbol) => symbol.symbol === selectedSymbol) || symbols[0] || null,
    [selectedSymbol, symbols],
  );

  const savePrompt = () => {
    const next = [promptDraft, ...promptHistory.filter((entry) => entry !== promptDraft)].slice(0, 8);
    setPromptHistory(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addBookmark = () => {
    if (!selectedLine) return;
    setBookmarks((prev) => [
      { name: `Bookmark ${prev.length + 1}`, line: selectedLine, note: annotation || 'Focus area' },
      ...prev,
    ]);
    setAnnotation('');
  };

  const applyReviewSuggestion = (suggestionId: string) => {
    const suggestion = visibleSuggestions.find((entry) => entry.id === suggestionId);
    if (!suggestion) return;
    onContentChange(file.id, applySuggestion(file.content || '', suggestion));
    setReviewDismissed((prev) => [...prev, suggestionId]);
  };

  const rejectReviewSuggestion = (suggestionId: string) => {
    setReviewDismissed((prev) => [...prev, suggestionId]);
  };

  const generateTests = () => {
    const generated = generateUnitTestFile(file.name, file.content || '');
    onCreateOrUpdateFile(generated.fileName, generated.content, 'typescript');
  };

  const regexTesterMatches = useMemo(() => {
    try {
      const regex = new RegExp(regexPattern, 'g');
      return Array.from(regexTesterInput.matchAll(regex)).map((match) => match[0]);
    } catch {
      return [];
    }
  }, [regexPattern, regexTesterInput]);

  return (
    <Tabs defaultValue="ai" className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/70 md:grid-cols-6">
          <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-3.5 w-3.5" />AI</TabsTrigger>
          <TabsTrigger value="editor" className="gap-1.5"><FileCode2 className="h-3.5 w-3.5" />Editor</TabsTrigger>
          <TabsTrigger value="collab" className="gap-1.5"><Mic className="h-3.5 w-3.5" />Collab</TabsTrigger>
          <TabsTrigger value="devops" className="gap-1.5"><Rocket className="h-3.5 w-3.5" />DevOps</TabsTrigger>
          <TabsTrigger value="project" className="gap-1.5"><FolderGit2 className="h-3.5 w-3.5" />Project</TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5"><Wrench className="h-3.5 w-3.5" />Tools</TabsTrigger>
        </TabsList>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Diff className="h-4 w-4" /> AI code review</CardTitle>
                    <CardDescription>Inline per-line suggestions with accept/reject controls.</CardDescription>
                  </div>
                  <Badge variant="secondary">Score {reviewSummary.score}/100</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleSuggestions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">No outstanding suggestions for this file.</div>
                ) : visibleSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-xl border border-border bg-muted/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">Ln {suggestion.line} · {suggestion.title}</p>
                          <Badge variant={suggestion.severity === 'high' ? 'destructive' : 'outline'}>{suggestion.severity}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      <div className="rounded-lg bg-background p-2 font-mono">- {suggestion.before}</div>
                      <div className="rounded-lg bg-emerald-500/10 p-2 font-mono text-emerald-700 dark:text-emerald-300">+ {suggestion.after}</div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => rejectReviewSuggestion(suggestion.id)}><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
                      <Button size="sm" onClick={() => applyReviewSuggestion(suggestion.id)}><Check className="mr-1 h-3.5 w-3.5" />Accept</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4" /> Prompt history</CardTitle>
                  <CardDescription>Save, replay, and iterate on previous AI prompts in one click.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} className="min-h-[110px]" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={savePrompt}><Check className="mr-1 h-3.5 w-3.5" />Save prompt</Button>
                    <Button size="sm" variant="outline" onClick={() => setPromptDraft(promptHistory[0] || promptDraft)}>Replay latest</Button>
                  </div>
                  <div className="space-y-2">
                    {promptHistory.map((entry) => (
                      <button key={entry} type="button" className="w-full rounded-lg border border-border p-2 text-left text-xs hover:bg-muted/40" onClick={() => setPromptDraft(entry)}>
                        {entry}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Pin className="h-4 w-4" /> AI context pinning</CardTitle>
                  <CardDescription>Keep critical files and scopes resident in the AI working set.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {pinnedContexts.map((context) => <Badge key={context} variant="outline">{context}</Badge>)}
                    {currentScope && <Badge variant="secondary">Scope · {currentScope.name}</Badge>}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {scopes.slice(0, 6).map((scope) => (
                      <button key={`${scope.name}-${scope.line}`} type="button" className="rounded-lg border border-border p-2 text-left text-xs hover:bg-muted/40" onClick={() => setPinnedContexts((prev) => Array.from(new Set([`${file.name}:${scope.name}`, ...prev])))}>
                        <div className="font-medium">{scope.name}</div>
                        <div className="text-muted-foreground">{scope.kind} · lines {scope.line}-{scope.endLine}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> Explain on hover</CardTitle>
                  <CardDescription>Hoverable symbol knowledge cards for the current file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {symbols.slice(0, 10).map((symbol) => (
                      <button key={symbol.symbol} type="button" className={cn('rounded-full border px-3 py-1 text-xs', selectedInsight?.symbol === symbol.symbol ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/40')} onMouseEnter={() => setSelectedSymbol(symbol.symbol)}>
                        {symbol.symbol}
                      </button>
                    ))}
                  </div>
                  {selectedInsight && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="secondary">{selectedInsight.kind}</Badge>
                        <span className="font-semibold">{selectedInsight.symbol}</span>
                        <span className="text-xs text-muted-foreground">line {selectedInsight.line}</span>
                      </div>
                      <p className="text-muted-foreground">{selectedInsight.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> AI-generated unit tests</CardTitle>
                  <CardDescription>Generate a ready-to-edit Vitest file for the current function set.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    Targets detected: {symbols.filter((symbol) => symbol.kind === 'function').map((symbol) => symbol.symbol).join(', ') || 'No functions found'}
                  </div>
                  <Button className="w-full" onClick={generateTests}><TestTube2 className="mr-2 h-4 w-4" />Generate tests for {file.name}</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Multi-cursor column editing</CardTitle>
                  <CardDescription>Block mode preview for aligned edits and rectangular selections.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-border bg-background p-3 font-mono text-xs">
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      {[1, 2, 3, 4].map((row) => (
                        <>
                          <span key={`line-${row}`} className="text-muted-foreground">{row}</span>
                          <span key={`value-${row}`}>user_{row} <span className="bg-primary/15 px-1 text-primary">| email_{row}@demo.dev</span></span>
                        </>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <span>Column mode</span>
                    <Switch checked />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Regex find & replace live preview</CardTitle>
                  <CardDescription>See replacement impact across the entire workspace before applying.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} placeholder="Regex pattern" />
                    <Input value={regexReplacement} onChange={(event) => setRegexReplacement(event.target.value)} placeholder="Replacement" />
                  </div>
                  <div className="space-y-2">
                    {regexPreview.slice(0, 6).map((entry) => (
                      <div key={entry.fileId} className="rounded-lg border border-border p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between"><span className="font-medium">{entry.fileName}</span><Badge variant="outline">{entry.matches.length} matches</Badge></div>
                        {entry.matches.slice(0, 2).map((match) => <div key={`${entry.fileId}-${match.line}`} className="text-muted-foreground">Ln {match.line}: {match.preview}</div>)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Editor intelligence rail</CardTitle>
                <CardDescription>Minimap, sticky scopes, and code folding metadata from the current buffer.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Radar className="h-4 w-4" />Minimap stats</div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>{(file.content || '').split('\n').length} visible lines</div>
                    <div>{scopes.length} foldable scopes</div>
                    <div>{symbols.length} explainable symbols</div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Highlighter className="h-4 w-4" />Sticky scope header</div>
                  <div className="rounded-lg bg-muted/30 p-3 text-sm">
                    <div className="font-semibold">{currentScope?.name || 'Global scope'}</div>
                    <div className="text-muted-foreground">{currentScope ? `${currentScope.kind} · lines ${currentScope.line}-${currentScope.endLine}` : 'Top-level declarations'}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium"><ChevronRight className="h-4 w-4" />Folding sidebar</div>
                  <div className="space-y-2 text-xs">
                    {scopes.slice(0, 6).map((scope) => <div key={`${scope.name}-${scope.line}`} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"><span>{scope.name}</span><span className="text-muted-foreground">Ln {scope.line}</span></div>)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collab" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Video className="h-4 w-4" />Voice / video room</CardTitle>
                  <CardDescription>WebRTC room orchestration embedded in the IDE.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between"><span className="font-medium">Daily standup room</span><Badge variant="secondary">WebRTC ready</Badge></div>
                    <div className="text-muted-foreground">Room URL: /rooms/{(currentFilePath || file.name).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm"><Mic className="mr-1 h-3.5 w-3.5" />Join audio</Button>
                    <Button size="sm" variant="outline"><Video className="mr-1 h-3.5 w-3.5" />Enable camera</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Live cursor presence</CardTitle>
                  <CardDescription>Named labels and cursor metadata anchored to this file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(activeRoomMembers.length > 0 ? activeRoomMembers : [{ userId: 'demo', displayName: 'Pairing Bot', color: '#7c3aed', cursorLine: selectedLine || 1 }]).map((member) => (
                    <div key={member.userId} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} /><span className="font-medium">{member.displayName}</span></div>
                      <span className="text-muted-foreground">Ln {member.cursorLine || 1}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Session recording & replay</CardTitle>
                  <CardDescription>Capture edits, selections, runs, and comments as a replayable timeline.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">Recording timeline</p>
                      <p className="text-muted-foreground">Track cursor moves, edits, terminal runs, and review events.</p>
                    </div>
                    <Switch checked={recordingEnabled} onCheckedChange={setRecordingEnabled} />
                  </div>
                  <div className="space-y-2 text-xs">
                    {['Opened file', 'Accepted AI suggestion', 'Ran preview', 'Commented on line'].map((step, index) => (
                      <div key={step} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2"><PlayCircle className="h-3.5 w-3.5 text-primary" />{index * 18}s · {step}</div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Code review threads</CardTitle>
                  <CardDescription>GitHub-style threaded feedback synced to exact lines.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(currentThreads.length > 0 ? currentThreads : [{ id: 'demo-thread', line_number: selectedLine || 1, content: '<p>Consider extracting this into a pure helper.</p>', resolved: false } as never]).slice(0, 4).map((thread) => (
                    <div key={thread.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between"><span className="font-medium">Line {thread.line_number}</span><Badge variant={thread.resolved ? 'outline' : 'secondary'}>{thread.resolved ? 'Resolved' : 'Open'}</Badge></div>
                      <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: thread.content }} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="devops" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Environment variable manager</CardTitle>
                  <CardDescription>Set, encrypt, rotate, and scope .env values visually.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {envDefaults.map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                      <div>
                        <div className="font-medium">{entry.key}</div>
                        <div className="text-muted-foreground">{entry.value}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{entry.scope}</Badge>
                        {entry.encrypted && <Badge variant="secondary">Encrypted</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Docker Compose visualizer</CardTitle>
                  <CardDescription>Render services as a dependency graph for quick topology reviews.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dockerGraph.map((service) => (
                    <div key={service.name} className="rounded-lg border border-border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between"><span className="font-medium">{service.name}</span><Badge variant="outline">{service.links.length} links</Badge></div>
                      <div className="text-muted-foreground">{service.detail}</div>
                      {service.links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{service.links.map((target) => <Badge key={target} variant="secondary">{service.name} → {target}</Badge>)}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Deployment pipeline builder</CardTitle>
                  <CardDescription>Compose build → test → deploy stages with drag-ready step cards.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-2">
                  {pipelineSteps.map((step) => (
                    <div key={step.name} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">{step.name}</span><Badge variant={step.status === 'success' ? 'secondary' : 'outline'}>{step.status}</Badge></div>
                      <div className="text-muted-foreground">{step.duration}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance profiler</CardTitle>
                  <CardDescription>Run code and visualize hotspots as flamecharts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {flamegraph.map((frame) => (
                    <div key={frame.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs"><span>{frame.label}</span><span className="text-muted-foreground">{frame.width}ms</span></div>
                      <div className="h-6 rounded-md bg-muted/40"><div className={cn('h-6 rounded-md', frame.color)} style={{ width: `${frame.width}%` }} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="project" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Project templates gallery</CardTitle>
                  <CardDescription>One-click scaffolding for popular stacks and product archetypes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {templateGallery.map((template) => (
                    <div key={template.name} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">{template.name}</span><Badge variant="outline">{template.stack}</Badge></div>
                      <p className="mt-1 text-muted-foreground">{template.action}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>File diff viewer</CardTitle>
                  <CardDescription>Compare the live file against the AI-reviewed variant or a prior revision.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-3 font-mono">{(file.content || '').split('\n').slice(0, 8).join('\n')}</div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 font-mono text-emerald-800 dark:text-emerald-200">{visibleSuggestions.length > 0 ? applySuggestion(file.content || '', visibleSuggestions[0]).split('\n').slice(0, 8).join('\n') : (file.content || '').split('\n').slice(0, 8).join('\n')}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Bookmarks & annotations</CardTitle>
                  <CardDescription>Save named hotspots across files for faster return-to-context flows.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={annotation} onChange={(event) => setAnnotation(event.target.value)} placeholder="Add an annotation for the selected line..." className="min-h-[90px]" />
                  <Button size="sm" onClick={addBookmark} disabled={!selectedLine}><Pin className="mr-1 h-3.5 w-3.5" />Save bookmark</Button>
                  <div className="space-y-2">
                    {bookmarks.map((bookmark) => (
                      <div key={`${bookmark.name}-${bookmark.line}`} className="rounded-lg border border-border p-3 text-sm">
                        <div className="font-medium">{bookmark.name} · Ln {bookmark.line}</div>
                        <div className="text-muted-foreground">{bookmark.note}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dependency graph viewer</CardTitle>
                  <CardDescription>Visualize imports and exports between project files.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dependencyGraph.slice(0, 6).map((node) => (
                    <div key={node.fileName} className="rounded-lg border border-border p-3">
                      <div className="font-medium">{node.fileName}</div>
                      <div className="mt-1 flex flex-wrap gap-2">{node.imports.length > 0 ? node.imports.map((target) => <Badge key={target} variant="secondary">{target}</Badge>) : <span className="text-muted-foreground">No imports</span>}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" />Database schema designer</CardTitle>
                  <CardDescription>Design ERD-like tables and export SQL.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2">
                    {schemaTables.map((table) => (
                      <div key={table.name} className="rounded-lg border border-border p-3 text-sm">
                        <div className="mb-2 flex items-center justify-between"><span className="font-medium">{table.name}</span><Badge variant="outline">{table.columns.length} cols</Badge></div>
                        <div className="space-y-1 text-xs text-muted-foreground">{table.columns.map((column) => <div key={column}>{column}</div>)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-background p-3 font-mono text-xs">{schemaTables.map((table) => `create table ${table.name} (\n  ${table.columns.join(',\n  ')}\n);`).join('\n\n')}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />API playground</CardTitle>
                  <CardDescription>Built-in REST / GraphQL client for project APIs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    {apiPresets.map((preset) => (
                      <button key={preset.name} type="button" className="rounded-lg border border-border p-2 text-left text-xs hover:bg-muted/40" onClick={() => setApiBody(`{\n  "url": "${preset.url}"\n}`)}>
                        <div className="font-medium">{preset.method}</div>
                        <div className="text-muted-foreground">{preset.name}</div>
                      </button>
                    ))}
                  </div>
                  <Textarea value={apiBody} onChange={(event) => setApiBody(event.target.value)} className="min-h-[140px] font-mono text-xs" />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Regex className="h-4 w-4" />Regex tester</CardTitle>
                  <CardDescription>Interactive test bed with highlighted matches.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} placeholder="Pattern" />
                  <Textarea value={regexTesterInput} onChange={(event) => setRegexTesterInput(event.target.value)} className="min-h-[140px] font-mono text-xs" />
                  <div className="flex flex-wrap gap-2">{regexTesterMatches.map((match, index) => <Badge key={`${match}-${index}`} variant="secondary">{match}</Badge>)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" />Color palette manager</CardTitle>
                  <CardDescription>Extract colors from your project and keep them in a reusable swatch library.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {palette.map((color) => (
                      <div key={color} className="rounded-xl border border-border p-2 text-xs">
                        <div className="mb-2 h-12 rounded-lg border border-border" style={{ background: color }} />
                        <div className="truncate">{color}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  );
};
