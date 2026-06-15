import { useQuery } from "@tanstack/react-query";
import { listLogs, listProxyKeys, listProviderKeys, getMonthlyStats } from "@/redactor/lib/dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function RedactorDashboard() {
  const logs = useQuery({ queryKey: ["redactor-logs"], queryFn: listLogs });
  const proxyKeys = useQuery({ queryKey: ["redactor-proxy-keys"], queryFn: listProxyKeys });
  const providerKeys = useQuery({ queryKey: ["redactor-provider-keys"], queryFn: listProviderKeys });
  const monthly = useQuery({ queryKey: ["redactor-monthly-stats"], queryFn: getMonthlyStats });

  const totalReqs = logs.data?.length ?? 0;
  const totalRedactions = (logs.data ?? []).reduce((sum, l) => {
    const r = l.redactions;
    if (!r) return sum;
    return sum + Object.values(r).reduce((a, b) => a + b, 0);
  }, 0);

  // Hourly request counts for chart
  const hourlyCounts = buildHourlyCounts(logs.data ?? []);

  // Per-key stats
  const keyStats = buildKeyStats(logs.data ?? [], proxyKeys.data ?? []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Last 100 requests across all proxy keys.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Provider keys" value={providerKeys.data?.length ?? 0} />
        <Stat label="Active proxy keys" value={(proxyKeys.data ?? []).filter((k) => !k.revokedAt).length} />
        <Stat label="Requests (current month)" value={monthly.data?.totalRequests ?? 0} />
        <Stat label="Month cost" value={`$${(monthly.data?.totalCostUsd ?? 0).toFixed(4)}`} accent />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests over time</CardTitle>
        </CardHeader>
        <CardContent>
          {hourlyCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlyCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="count" stroke="oklch(0.86 0.18 165)" fill="oklch(0.86 0.18 165 / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-key usage (current month)</CardTitle>
        </CardHeader>
        <CardContent>
          {keyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="text-sm space-y-2">
              {keyStats.map((ks) => (
                <div key={ks.id} className="flex items-center justify-between py-2 border-b border-border/20">
                  <div>
                    <span className="font-medium">{ks.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{ks.keyPrefix}…</span>
                  </div>
                  <div className="flex gap-4 text-xs tabular-nums">
                    <span>{ks.requests} req</span>
                    <span>{ks.tokens.toLocaleString()} tokens</span>
                    <span className="text-[oklch(0.86_0.18_165)]">${ks.cost.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent requests</CardTitle>
        </CardHeader>
        <CardContent>
          {(logs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No requests yet. Create a proxy key and point your AI SDK at it to get started.
            </p>
          ) : (
            <div className="font-mono text-xs space-y-1">
              {logs.data!.slice(0, 20).map((l) => {
                const redactedCount = Object.values(l.redactions ?? {}).reduce((a, b) => a + b, 0);
                return (
                  <div key={l.id} className="flex items-center gap-3 py-1 border-b border-border/40">
                    <Badge variant={l.status < 400 ? "secondary" : "destructive"}>{l.status}</Badge>
                    <span className="text-muted-foreground w-28">{l.provider}</span>
                    <span className="flex-1 truncate">{l.model ?? "—"}</span>
                    <span className="text-muted-foreground w-16 text-right">{l.latencyMs}ms</span>
                    <span className="w-20 text-right">{l.costUsd != null ? `$${l.costUsd.toFixed(6)}` : ""}</span>
                    <span className="text-[oklch(0.86_0.18_165)] w-20 text-right">{redactedCount} redacted</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 p-4 bg-card/40">
      <div className="text-xs text-muted-foreground uppercase font-mono">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? "text-[oklch(0.86_0.18_165)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function buildHourlyCounts(logs: { createdAt: string }[]): { label: string; count: number }[] {
  const buckets = new Map<string, number>();
  for (const l of logs) {
    const d = new Date(l.createdAt);
    const key = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:00`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));
}

function buildKeyStats(
  logs: { proxyKeyId?: string; inputTokens?: number | null; outputTokens?: number | null; costUsd?: number | null }[],
  keys: { id: string; name: string; keyPrefix: string }[],
): { id: string; name: string; keyPrefix: string; requests: number; tokens: number; cost: number }[] {
  const map = new Map<string, { name: string; keyPrefix: string; requests: number; tokens: number; cost: number }>();
  for (const k of keys) {
    map.set(k.id, { name: k.name, keyPrefix: k.keyPrefix, requests: 0, tokens: 0, cost: 0 });
  }
  for (const l of logs) {
    if (!l.proxyKeyId) continue;
    const s = map.get(l.proxyKeyId);
    if (!s) continue;
    s.requests++;
    s.tokens += (l.inputTokens ?? 0) + (l.outputTokens ?? 0);
    s.cost += l.costUsd ?? 0;
  }
  return Array.from(map.entries())
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.requests > 0)
    .sort((a, b) => b.requests - a.requests);
}
