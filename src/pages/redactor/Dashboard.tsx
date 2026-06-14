import { useQuery } from "@tanstack/react-query";
import { listLogs, listProxyKeys, listProviderKeys } from "@/redactor/lib/dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RedactorDashboard() {
  const logs = useQuery({ queryKey: ["redactor-logs"], queryFn: listLogs });
  const proxyKeys = useQuery({ queryKey: ["redactor-proxy-keys"], queryFn: listProxyKeys });
  const providerKeys = useQuery({ queryKey: ["redactor-provider-keys"], queryFn: listProviderKeys });

  const totalReqs = logs.data?.length ?? 0;
  const totalRedactions = (logs.data ?? []).reduce((sum, l) => {
    const r = l.redactions;
    if (!r) return sum;
    return sum + Object.values(r).reduce((a, b) => a + b, 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Last 100 requests across all proxy keys.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Provider keys" value={providerKeys.data?.length ?? 0} />
        <Stat label="Active proxy keys" value={(proxyKeys.data ?? []).filter((k) => !k.revokedAt).length} />
        <Stat label="Requests (100 most recent)" value={totalReqs} />
        <Stat label="Redactions performed" value={totalRedactions} accent />
      </div>

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
              {logs.data!.slice(0, 20).map((l) => (
                <div key={l.id} className="flex items-center gap-3 py-1 border-b border-border/40">
                  <Badge variant={l.status < 400 ? "secondary" : "destructive"}>{l.status}</Badge>
                  <span className="text-muted-foreground w-32">{l.provider}</span>
                  <span className="flex-1">{l.model ?? "—"}</span>
                  <span className="text-muted-foreground">{l.latencyMs}ms</span>
                  <span className="text-[oklch(0.86_0.18_165)]">
                    {Object.values(l.redactions ?? {}).reduce((a, b) => a + b, 0)} redacted
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 p-4 bg-card/40">
      <div className="text-xs text-muted-foreground uppercase font-mono">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? "text-[oklch(0.86_0.18_165)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
