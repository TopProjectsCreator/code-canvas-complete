import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listRouters, createRouter, deleteRouter, updateRouter,
  listRouterSteps, addRouterStep, updateRouterStep, deleteRouterStep,
  reorderRouterSteps, listProviderKeys,
  type ModelRouter, type RouterStep,
} from "@/redactor/lib/dashboard-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { GripVertical, Plus, Trash2, ArrowDown, Zap, Check, X, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API_SHAPES = [
  { value: "auto", label: "Auto-detect (try all formats)" },
  { value: "openai", label: "OpenAI Completions (/chat/completions)" },
  { value: "openai-responses", label: "OpenAI Responses (/responses)" },
  { value: "anthropic", label: "Anthropic Messages (/messages)" },
  { value: "gemini", label: "Gemini generateContent" },
] as const;

const FALLBACK_MODES = [
  { value: "all", label: "All errors (HTTP >= 400 + timeouts)" },
  { value: "server_errors", label: "Server errors only (5xx)" },
  { value: "timeout", label: "Timeouts only" },
  { value: "custom", label: "Custom status codes" },
] as const;

function getShapeColor(shape: string): string {
  switch (shape) {
    case "openai": return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    case "openai-responses": return "bg-purple-500/10 text-purple-500 border-purple-500/30";
    case "anthropic": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "gemini": return "bg-green-500/10 text-green-500 border-green-500/30";
    default: return "bg-gray-500/10 text-gray-500 border-gray-500/30";
  }
}

function getShapeLabel(shape: string): string {
  switch (shape) {
    case "openai": return "OpenAI";
    case "openai-responses": return "Responses";
    case "anthropic": return "Anthropic";
    case "gemini": return "Gemini";
    default: return shape;
  }
}

function SortableStepCard({ step, index, onEdit, onDelete, onToggle }: {
  step: RouterStep; index: number; onEdit: () => void; onDelete: () => void; onToggle: (enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 0 };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {index > 0 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowDown className="size-3" /><span>fallback</span>
        </div>
      )}
      <div className={`border rounded-lg p-4 ${step.enabled ? "bg-card" : "bg-muted/30 opacity-60"}`}>
        <div className="flex items-start gap-3">
          <button className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
            <GripVertical className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{index + 1}.</span>
              <Badge className={getShapeColor(step.apiShape)} variant="outline">{getShapeLabel(step.apiShape)}</Badge>
              <span className="font-medium truncate">{step.model}</span>
              {!step.enabled && <Badge variant="secondary">disabled</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {step.providerLabel ? `via "${step.providerLabel}" (${step.providerName})` : step.baseUrl ? `via ${step.baseUrl}` : "no key configured"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={step.enabled} onCheckedChange={onToggle} />
            <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost"><Trash2 className="size-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete step?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove step {index + 1} ({step.model}) from the router.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestResults({ results, isOpen }: { results: any[]; isOpen: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [results]);
  if (!isOpen || results.length === 0) return null;
  const doneEvent = results.find((r) => r.type === "done");
  const stepResults = results.filter((r) => r.type !== "done");

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 font-medium text-sm">Test Results</div>
      <div ref={scrollRef} className="max-h-96 overflow-y-auto p-4 space-y-4">
        {stepResults.map((result, i) => {
          if (result.type === "probe") return (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /><span>Trying step {result.step}: {result.model} ({result.shape})...</span>
            </div>
          );
          if (result.type === "error") return (
            <div key={i} className="border border-red-500/30 rounded-lg p-3 bg-red-500/5">
              <div className="flex items-center gap-2">
                <X className="size-4 text-red-500" /><span className="font-medium">Step {result.step} failed</span>
                <Badge variant="outline" className="text-red-500">{result.status}</Badge>
                <span className="text-xs text-muted-foreground">{result.latency_ms}ms</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground font-mono break-all">{result.message?.slice(0, 200)}</div>
            </div>
          );
          if (result.type === "success") return (
            <div key={i} className="border border-green-500/30 rounded-lg p-3 bg-green-500/5">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-green-500" /><span className="font-medium">Step {result.step} succeeded</span>
                <Badge variant="outline" className="text-green-500">{result.status}</Badge>
                <span className="text-xs text-muted-foreground">{result.latency_ms}ms</span>
              </div>
              <div className="mt-2 text-sm bg-background rounded p-2 font-mono">{result.response_text?.slice(0, 500)}</div>
              {result.usage && <div className="mt-2 text-xs text-muted-foreground">Tokens: {result.usage.input_tokens ?? 0} in / {result.usage.output_tokens ?? 0} out</div>}
            </div>
          );
          return null;
        })}
        {doneEvent && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-4 text-sm">
              <span>Tried {doneEvent.steps_tried.length} step(s){doneEvent.succeeded_at ? `, succeeded at step ${doneEvent.succeeded_at}` : " — all failed"}</span>
              <span className="text-muted-foreground">Total: {doneEvent.total_latency_ms}ms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RedactorRouters() {
  const qc = useQueryClient();
  const { data: routers } = useQuery({ queryKey: ["redactor-routers"], queryFn: listRouters });
  const { data: providerKeys } = useQuery({ queryKey: ["redactor-provider-keys"], queryFn: listProviderKeys });
  const [routerName, setRouterName] = useState("");
  const [routerBusy, setRouterBusy] = useState(false);
  const [selectedRouter, setSelectedRouter] = useState<ModelRouter | null>(null);
  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: ["redactor-router-steps", selectedRouter?.id],
    queryFn: () => listRouterSteps(selectedRouter!.id),
    enabled: !!selectedRouter,
  });
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<RouterStep | null>(null);
  const [useExistingKey, setUseExistingKey] = useState(true);
  const [selectedProviderKeyId, setSelectedProviderKeyId] = useState("");
  const [stepBaseUrl, setStepBaseUrl] = useState("");
  const [stepApiKey, setStepApiKey] = useState("");
  const [stepModel, setStepModel] = useState("");
  const [stepApiShape, setStepApiShape] = useState("auto");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testRunning, setTestRunning] = useState(false);
  const [testMessage, setTestMessage] = useState("Say hello in one word");
  const sensors = useSensors(useSensor(PointerSensor));

  async function handleCreateRouter(e: React.FormEvent) {
    e.preventDefault(); setRouterBusy(true);
    try { const router = await createRouter({ name: routerName }); setSelectedRouter(router); setRouterName(""); qc.invalidateQueries({ queryKey: ["redactor-routers"] }); toast.success("Router created"); }
    catch (e) { toast.error((e as Error).message); } finally { setRouterBusy(false); }
  }

  async function handleDeleteRouter() {
    if (!selectedRouter) return;
    await deleteRouter(selectedRouter.id); setSelectedRouter(null);
    qc.invalidateQueries({ queryKey: ["redactor-routers"] }); toast.success("Router deleted");
  }

  async function handleSaveRouterSettings() {
    if (!selectedRouter) return;
    await updateRouter(selectedRouter.id, { name: selectedRouter.name, fallbackOn: selectedRouter.fallbackOn, fallbackStatusCodes: selectedRouter.fallbackStatusCodes });
    qc.invalidateQueries({ queryKey: ["redactor-routers"] }); toast.success("Settings saved");
  }

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault(); if (!selectedRouter) return;
    try {
      const stepData: any = { routerId: selectedRouter.id, model: stepModel, apiShape: stepApiShape };
      if (useExistingKey && selectedProviderKeyId) stepData.providerKeyId = selectedProviderKeyId;
      else if (!useExistingKey && stepApiKey) { stepData.apiKey = stepApiKey; if (stepBaseUrl) stepData.baseUrl = stepBaseUrl; }
      await addRouterStep(stepData); setStepDialogOpen(false); resetStepForm();
      qc.invalidateQueries({ queryKey: ["redactor-router-steps", selectedRouter.id] }); toast.success("Step added");
    } catch (e) { toast.error((e as Error).message); }
  }

  function handleEditStep(step: RouterStep) {
    setEditingStep(step); setStepModel(step.model); setStepApiShape(step.apiShape);
    if (step.providerKeyId) { setUseExistingKey(true); setSelectedProviderKeyId(step.providerKeyId); }
    else { setUseExistingKey(false); setStepBaseUrl(step.baseUrl ?? ""); }
    setStepDialogOpen(true);
  }

  async function handleSaveStep(e: React.FormEvent) {
    e.preventDefault(); if (!editingStep) return;
    try { await updateRouterStep(editingStep.id, { model: stepModel, apiShape: stepApiShape }); setStepDialogOpen(false); resetStepForm(); qc.invalidateQueries({ queryKey: ["redactor-router-steps", selectedRouter?.id] }); toast.success("Step updated"); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function handleDeleteStep(stepId: string) {
    await deleteRouterStep(stepId); qc.invalidateQueries({ queryKey: ["redactor-router-steps", selectedRouter?.id] }); toast.success("Step deleted");
  }

  async function handleToggleStep(step: RouterStep) {
    await updateRouterStep(step.id, { enabled: !step.enabled }); qc.invalidateQueries({ queryKey: ["redactor-router-steps", selectedRouter?.id] });
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!steps || !selectedRouter) return;
    const { active, over } = event; if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const newSteps = arrayMove(steps, oldIndex, newIndex);
    qc.setQueryData(["redactor-router-steps", selectedRouter.id], newSteps);
    await reorderRouterSteps(selectedRouter.id, newSteps.map((s) => s.id));
  }

  async function handleRunTest() {
    if (!selectedRouter) return; setTestRunning(true); setTestResults([]);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token; if (!token) throw new Error("Not authenticated");
      const response = await fetch(`/functions/v1/redactor-proxy/router/${selectedRouter.id}/test`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: testMessage }] }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader(); if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) { if (line.startsWith("data: ")) { try { setTestResults((prev) => [...prev, JSON.parse(line.slice(6))]); } catch {} } }
      }
    } catch (e) { toast.error((e as Error).message); } finally { setTestRunning(false); }
  }

  function resetStepForm() { setEditingStep(null); setUseExistingKey(true); setSelectedProviderKeyId(""); setStepBaseUrl(""); setStepApiKey(""); setStepModel(""); setStepApiShape("auto"); }

  if (!selectedRouter) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold">Routers</h1>
          <p className="text-sm text-muted-foreground">Chain multiple providers with automatic fallback. Use <code>router/&lt;name&gt;</code> as your model in API calls.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Create new router</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRouter} className="flex gap-3">
              <Input value={routerName} onChange={(e) => setRouterName(e.target.value)} placeholder="my-fallback-chain" required className="flex-1" />
              <Button type="submit" disabled={routerBusy}>{routerBusy ? "Creating..." : "Create router"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Your routers</CardTitle></CardHeader>
          <CardContent>
            {(routers ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No routers yet.</p> : (
              <ul className="divide-y divide-border/40">
                {routers!.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between cursor-pointer hover:bg-accent/50 -mx-2 px-2 rounded" onClick={() => setSelectedRouter(r)}>
                    <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">Fallback: {r.fallbackOn}</div></div>
                    <div className="text-xs text-muted-foreground">Click to edit</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setSelectedRouter(null)}><ChevronLeft className="size-4 mr-2" />Back to routers</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete router</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete router?</AlertDialogTitle><AlertDialogDescription>This will permanently delete <strong>{selectedRouter.name}</strong> and all its steps.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteRouter}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Router: {selectedRouter.name}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Name</Label><Input value={selectedRouter.name} onChange={(e) => setSelectedRouter({ ...selectedRouter, name: e.target.value })} /></div>
          <div><Label>Fallback trigger</Label>
            <Select value={selectedRouter.fallbackOn} onValueChange={(v) => setSelectedRouter({ ...selectedRouter, fallbackOn: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FALLBACK_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedRouter.fallbackOn === "custom" && (
            <div><Label>Custom status codes (comma-separated)</Label>
              <Input value={selectedRouter.fallbackStatusCodes?.join(", ") ?? ""} onChange={(e) => { const codes = e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)); setSelectedRouter({ ...selectedRouter, fallbackStatusCodes: codes }); }} placeholder="429, 500, 503" />
            </div>
          )}
          <Button onClick={handleSaveRouterSettings}>Save settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Steps (drag to reorder)</CardTitle>
          <Button size="sm" onClick={() => { resetStepForm(); setStepDialogOpen(true); }}><Plus className="size-4 mr-2" />Add step</Button>
        </CardHeader>
        <CardContent>
          {stepsLoading ? <p className="text-sm text-muted-foreground">Loading steps...</p> :
            (steps ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No steps yet. Add a step to start building your fallback chain.</p> : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={steps!.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {steps!.map((step, i) => (
                      <SortableStepCard key={step.id} step={step} index={i} onEdit={() => handleEditStep(step)} onDelete={() => handleDeleteStep(step.id)} onToggle={(enabled) => handleToggleStep({ ...step, enabled })} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test router</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Test message</Label><Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Say hello in one word" /></div>
          <Button onClick={handleRunTest} disabled={testRunning || (steps ?? []).length === 0}>
            {testRunning ? <><Loader2 className="size-4 mr-2 animate-spin" />Testing...</> : <><Zap className="size-4 mr-2" />Run test</>}
          </Button>
          <TestResults results={testResults} isOpen={testResults.length > 0} />
        </CardContent>
      </Card>

      <Dialog open={stepDialogOpen} onOpenChange={(open) => { setStepDialogOpen(open); if (!open) resetStepForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingStep ? "Edit step" : "Add step"}</DialogTitle><DialogDescription>Configure the upstream endpoint for this step in the fallback chain.</DialogDescription></DialogHeader>
          <form onSubmit={editingStep ? handleSaveStep : handleAddStep} className="space-y-4">
            {!editingStep && (
              <div className="flex items-center gap-2"><Switch checked={useExistingKey} onCheckedChange={setUseExistingKey} /><Label className="text-sm">{useExistingKey ? "Use existing provider key" : "Enter key directly"}</Label></div>
            )}
            {useExistingKey ? (
              <div><Label>Provider key</Label>
                <Select value={selectedProviderKeyId} onValueChange={setSelectedProviderKeyId}>
                  <SelectTrigger><SelectValue placeholder="Select a provider key" /></SelectTrigger>
                  <SelectContent>{(providerKeys ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.label} ({k.provider})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div><Label>Base URL</Label><Input value={stepBaseUrl} onChange={(e) => setStepBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" /></div>
                <div><Label>API key</Label><Input type="password" value={stepApiKey} onChange={(e) => setStepApiKey(e.target.value)} placeholder="sk-..." className="font-mono" /></div>
              </>
            )}
            <div><Label>Model</Label><Input value={stepModel} onChange={(e) => setStepModel(e.target.value)} placeholder="gpt-4o" required /></div>
            <div><Label>API shape</Label>
              <Select value={stepApiShape} onValueChange={setStepApiShape}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{API_SHAPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              {stepApiShape === "auto" && <p className="text-xs text-muted-foreground mt-1">The proxy will try each format and use the first that works.</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setStepDialogOpen(false); resetStepForm(); }}>Cancel</Button>
              <Button type="submit">{editingStep ? "Save changes" : "Add step"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}