import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProxyKey,
  listProxyKeys,
  revokeProxyKey,
} from "@/redactor/lib/dashboard-api";
import { PROVIDERS } from "@/redactor/lib/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function RedactorProxyKeys() {
  const qc = useQueryClient();

  const { data: keys } = useQuery({ queryKey: ["redactor-proxy-keys"], queryFn: listProxyKeys });

  const [name, setName] = useState("");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [logRequests, setLogRequests] = useState(true);
  const [rateLimitRpm, setRateLimitRpm] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleProvider(id: string) {
    setAllowed((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await createProxyKey({
        name,
        allowedProviders: allowed,
        logRequests,
        rateLimitRpm: rateLimitRpm ? parseInt(rateLimitRpm, 10) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setNewKey(r.fullKey);
      setName("");
      setAllowed([]);
      setLogRequests(true);
      setRateLimitRpm("");
      setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["redactor-proxy-keys"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Proxy keys</h1>
        <p className="text-sm text-muted-foreground">
          Use these as the <code>apiKey</code> in your AI SDK. Each one is stored as a SHA-256 hash —
          we cannot show it again after creation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create new key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="my-app prod" />
            </div>
            <div>
              <Label>Allowed providers (empty = all you've configured)</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {PROVIDERS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={allowed.includes(p.id)}
                      onCheckedChange={() => toggleProvider(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rate limit (RPM)</Label>
                <Input
                  type="number"
                  min="1"
                  value={rateLimitRpm}
                  onChange={(e) => setRateLimitRpm(e.target.value)}
                  placeholder="e.g. 60"
                />
                <p className="text-xs text-muted-foreground mt-1">Max requests per minute. Empty = unlimited.</p>
              </div>
              <div>
                <Label>Expires at</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Empty = never expires.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={logRequests}
                onCheckedChange={(v) => setLogRequests(v === true)}
              />
              Log request metadata
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Generate key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          {(keys ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No proxy keys yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {keys!.map((k) => (
                <li key={k.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {k.name}{" "}
                      {k.revokedAt && <Badge variant="destructive">revoked</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {k.keyPrefix}… · {k.allowedProviders.length || "all"} providers
                      {k.rateLimitRpm != null && ` · ${k.rateLimitRpm} RPM`}
                      {k.expiresAt && ` · expires ${new Date(k.expiresAt).toLocaleDateString()}`}
                      {!k.logRequests && " · no logging"}
                      {k.lastUsedAt &&
                        ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`}
                    </div>
                  </div>
                  {!k.revokedAt && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">Revoke</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke proxy key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately invalidate <strong>{k.name}</strong> ({k.keyPrefix}…).
                            Any services using this key will stop working.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              await revokeProxyKey(k.id);
                              qc.invalidateQueries({ queryKey: ["redactor-proxy-keys"] });
                            }}
                          >
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new proxy key</DialogTitle>
            <DialogDescription>
              Copy it now. We only store a hash — this is the only time you'll see it.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border/60 bg-card/40 p-3 font-mono text-sm break-all">
            {newKey}
          </div>
          <Button
            onClick={() => {
              if (newKey) navigator.clipboard.writeText(newKey);
              toast.success("Copied");
            }}
          >
            <Copy className="size-4 mr-2" /> Copy
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
