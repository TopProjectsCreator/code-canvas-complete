import { useQuery } from "@tanstack/react-query";
import { listLogs } from "@/redactor/lib/dashboard-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RedactorLogs() {
  const { data: logs } = useQuery({ queryKey: ["redactor-logs"], queryFn: listLogs });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Request logs</h1>
        <p className="text-sm text-muted-foreground">
          Metadata only — never the raw prompt or completion. Last 100 requests.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          {(logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs yet.</p>
          ) : (
            <table className="w-full text-sm font-mono">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="text-left py-2">When</th>
                  <th className="text-left">Provider</th>
                  <th className="text-left">Model</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Tokens</th>
                  <th className="text-right">Latency</th>
                  <th className="text-right">Redacted</th>
                </tr>
              </thead>
              <tbody>
                {logs!.map((l) => {
                  const redactions = l.redactions ?? {};
                  const totalRedactions = Object.values(redactions).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={l.id} className="border-b border-border/20">
                      <td className="py-2">{new Date(l.createdAt).toLocaleString()}</td>
                      <td>{l.provider}</td>
                      <td className="text-muted-foreground">{l.model ?? "—"}</td>
                      <td>
                        <Badge variant={l.status < 400 ? "secondary" : "destructive"}>{l.status}</Badge>
                      </td>
                      <td className="text-right">
                        {(l.inputTokens ?? 0) + (l.outputTokens ?? 0) || "—"}
                      </td>
                      <td className="text-right">{l.latencyMs}ms</td>
                      <td className="text-right text-[oklch(0.86_0.18_165)]">{totalRedactions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
