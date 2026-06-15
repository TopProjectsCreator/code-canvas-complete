import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLogsPaginated, listProxyKeys } from "@/redactor/lib/dashboard-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 50;

export default function RedactorLogs() {
  const [page, setPage] = useState(0);
  const [filterProvider, setFilterProvider] = useState("");
  const [filterKey, setFilterKey] = useState("");
  const [filterModel, setFilterModel] = useState("");

  const proxyKeys = useQuery({ queryKey: ["redactor-proxy-keys"], queryFn: listProxyKeys });

  const filters: { provider?: string; proxyKeyId?: string; model?: string } = {};
  if (filterProvider) filters.provider = filterProvider;
  if (filterKey) filters.proxyKeyId = filterKey;
  if (filterModel) filters.model = filterModel;

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: logs, isFetching } = useQuery({
    queryKey: ["redactor-logs-paginated", from, to, filters],
    queryFn: () => listLogsPaginated(from, to, filters),
  });

  const providers = new Set((logs ?? []).map((l) => l.provider));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Request logs</h1>
        <p className="text-sm text-muted-foreground">
          Metadata only — never the raw prompt or completion.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterProvider} onValueChange={(v) => { setFilterProvider(v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All providers</SelectItem>
            {Array.from(providers).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterKey} onValueChange={(v) => { setFilterKey(v); setPage(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All proxy keys" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All proxy keys</SelectItem>
            {(proxyKeys.data ?? []).map((k) => (
              <SelectItem key={k.id} value={k.id}>{k.name} ({k.keyPrefix}…)</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by model…"
          className="w-48"
          value={filterModel}
          onChange={(e) => { setFilterModel(e.target.value); setPage(0); }}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isFetching ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs match your filters.</p>
          ) : (
            <>
              <table className="w-full text-sm font-mono">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="text-left py-2">When</th>
                    <th className="text-left">Provider</th>
                    <th className="text-left">Model</th>
                    <th className="text-left">Status</th>
                    <th className="text-right">Tokens</th>
                    <th className="text-right">Cost</th>
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
                        <td className="py-2 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                        <td>{l.provider}</td>
                        <td className="text-muted-foreground">{l.model ?? "—"}</td>
                        <td>
                          <Badge variant={l.status < 400 ? "secondary" : "destructive"}>{l.status}</Badge>
                        </td>
                        <td className="text-right">
                          {(l.inputTokens ?? 0) + (l.outputTokens ?? 0) || "—"}
                        </td>
                        <td className="text-right text-[oklch(0.86_0.18_165)]">
                          {l.costUsd != null ? `$${l.costUsd.toFixed(6)}` : "—"}
                        </td>
                        <td className="text-right">{l.latencyMs}ms</td>
                        <td className="text-right text-[oklch(0.86_0.18_165)]">{totalRedactions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} · {(logs ?? []).length < PAGE_SIZE && page === 0 ? "all results" : `${from + 1}–${from + (logs?.length ?? 0)}`}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(logs ?? []).length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
