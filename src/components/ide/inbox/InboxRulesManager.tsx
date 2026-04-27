import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InboxRule, RuleAction, RuleCondition, RuleField, RuleOp } from '@/lib/inboxRules';

const FIELDS: { value: RuleField; label: string }[] = [
  { value: 'from', label: 'From' },
  { value: 'subject', label: 'Subject' },
  { value: 'body', label: 'Body' },
];
const OPS: { value: RuleOp; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
];
const ACTIONS: { value: RuleAction['type']; label: string }[] = [
  { value: 'add_label', label: 'Add label' },
  { value: 'mark_read', label: 'Mark as read' },
  { value: 'forward', label: 'Forward to (user id)' },
  { value: 'delete', label: 'Delete' },
];

const blankCondition = (): RuleCondition => ({ field: 'from', op: 'contains', value: '' });
const blankAction = (): RuleAction => ({ type: 'add_label', value: '' });

export const InboxRulesManager = ({
  knownLabels,
}: {
  knownLabels: string[];
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<InboxRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesTable = () => (supabase as any).from('inbox_rules');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await rulesTable()
      .select('*')
      .order('position', { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: 'Could not load rules', description: error.message, variant: 'destructive' });
      return;
    }
    setRules((data || []) as InboxRule[]);
  };

  useEffect(() => { load(); }, [user]);

  const addRule = async () => {
    if (!user) return;
    const draft = {
      user_id: user.id,
      name: 'New rule',
      enabled: true,
      match: 'all' as const,
      conditions: [blankCondition()],
      actions: [blankAction()],
      position: rules.length,
    };
    const { data, error } = await rulesTable()
      .insert(draft)
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Could not create rule', description: error.message, variant: 'destructive' });
      return;
    }
    const created = data as InboxRule;
    setRules((prev) => [...prev, created]);
    setExpanded((prev) => ({ ...prev, [created.id]: true }));
  };

  const persist = async (rule: InboxRule, patch: Partial<InboxRule>) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, ...patch } : r)));
    const { error } = await rulesTable()
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      load();
    }
  };

  const remove = async (rule: InboxRule) => {
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    await rulesTable().delete().eq('id', rule.id);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-sm font-semibold">Inbox rules</div>
          <div className="text-xs text-muted-foreground">
            Automatically label, mark, forward, or delete incoming messages.
          </div>
        </div>
        <Button size="sm" onClick={addRule}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New rule
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rules.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No rules yet. Create one to auto-label or organize incoming messages.
          </div>
        )}
        <div className="p-3 space-y-2">
          {rules.map((rule) => {
            const isOpen = expanded[rule.id] ?? false;
            return (
              <div key={rule.id} className="border border-border rounded-md bg-card">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [rule.id]: !isOpen }))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <Input
                    value={rule.name}
                    onChange={(e) => setRules((p) => p.map((r) => (r.id === rule.id ? { ...r, name: e.target.value } : r)))}
                    onBlur={(e) => persist(rule, { name: e.target.value || 'Untitled rule' })}
                    className="h-8 max-w-xs"
                  />
                  <div className="flex-1" />
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(v) => persist(rule, { enabled: v })}
                  />
                  <Button size="sm" variant="ghost" onClick={() => remove(rule)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/60 pt-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">When</span>
                        <Select
                          value={rule.match}
                          onValueChange={(v) => persist(rule, { match: v as InboxRule['match'] })}
                        >
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">all</SelectItem>
                            <SelectItem value="any">any</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs">conditions match:</span>
                      </div>
                      <div className="space-y-2">
                        {rule.conditions.map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Select
                              value={c.field}
                              onValueChange={(v) => {
                                const next = [...rule.conditions];
                                next[i] = { ...next[i], field: v as RuleField };
                                persist(rule, { conditions: next });
                              }}
                            >
                              <SelectTrigger className="h-8 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select
                              value={c.op}
                              onValueChange={(v) => {
                                const next = [...rule.conditions];
                                next[i] = { ...next[i], op: v as RuleOp };
                                persist(rule, { conditions: next });
                              }}
                            >
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              value={c.value}
                              placeholder="value"
                              className="h-8 text-xs flex-1"
                              onChange={(e) => {
                                const next = [...rule.conditions];
                                next[i] = { ...next[i], value: e.target.value };
                                setRules((p) => p.map((r) => (r.id === rule.id ? { ...r, conditions: next } : r)));
                              }}
                              onBlur={() => persist(rule, { conditions: rule.conditions })}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                const next = rule.conditions.filter((_, idx) => idx !== i);
                                persist(rule, { conditions: next.length ? next : [blankCondition()] });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => persist(rule, { conditions: [...rule.conditions, blankCondition()] })}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add condition
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium mb-1">Then</div>
                      <div className="space-y-2">
                        {rule.actions.map((a, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Select
                              value={a.type}
                              onValueChange={(v) => {
                                const next = [...rule.actions];
                                const t = v as RuleAction['type'];
                                next[i] = (t === 'mark_read' || t === 'delete')
                                  ? ({ type: t } as RuleAction)
                                  : ({ type: t, value: '' } as RuleAction);
                                persist(rule, { actions: next });
                              }}
                            >
                              <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTIONS.map((act) => <SelectItem key={act.value} value={act.value}>{act.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {a.type === 'add_label' && (
                              <Input
                                list={`labels-${rule.id}`}
                                value={a.value}
                                placeholder="label name"
                                className="h-8 text-xs flex-1"
                                onChange={(e) => {
                                  const next = [...rule.actions];
                                  next[i] = { type: 'add_label', value: e.target.value };
                                  setRules((p) => p.map((r) => (r.id === rule.id ? { ...r, actions: next } : r)));
                                }}
                                onBlur={() => persist(rule, { actions: rule.actions })}
                              />
                            )}
                            {a.type === 'forward' && (
                              <Input
                                value={a.value}
                                placeholder="recipient user id"
                                className="h-8 text-xs flex-1"
                                onChange={(e) => {
                                  const next = [...rule.actions];
                                  next[i] = { type: 'forward', value: e.target.value };
                                  setRules((p) => p.map((r) => (r.id === rule.id ? { ...r, actions: next } : r)));
                                }}
                                onBlur={() => persist(rule, { actions: rule.actions })}
                              />
                            )}
                            {(a.type === 'mark_read' || a.type === 'delete') && (
                              <div className="flex-1" />
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                const next = rule.actions.filter((_, idx) => idx !== i);
                                persist(rule, { actions: next.length ? next : [blankAction()] });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => persist(rule, { actions: [...rule.actions, blankAction()] })}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add action
                        </Button>
                        <datalist id={`labels-${rule.id}`}>
                          {knownLabels.map((l) => <option key={l} value={l} />)}
                        </datalist>
                      </div>
                    </div>
                  </div>
                )}
                {!isOpen && (
                  <div className={cn('px-3 pb-2 text-xs text-muted-foreground', !rule.enabled && 'opacity-60')}>
                    {rule.conditions.length} condition{rule.conditions.length === 1 ? '' : 's'} · {rule.actions.length} action{rule.actions.length === 1 ? '' : 's'} · {rule.enabled ? 'enabled' : 'disabled'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
