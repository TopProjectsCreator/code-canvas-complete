import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addProviderKey, deleteProviderKey, listProviderKeys } from "@/redactor/lib/dashboard-api";
import { PROVIDERS } from "@/redactor/lib/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
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

export default function RedactorProviderKeys() {
  const qc = useQueryClient();

  const { data: keys } = useQuery({ queryKey: ["redactor-provider-keys"], queryFn: listProviderKeys });
  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addProviderKey({
        provider,
        label: label || PROVIDERS.find((p) => p.id === provider)?.name || provider,
        apiKey,
        baseUrl: baseUrl || undefined,
      });
      setApiKey("");
      setLabel("");
      setBaseUrl("");
      qc.invalidateQueries({ queryKey: ["redactor-provider-keys"] });
      toast.success("Key saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Provider keys</h1>
        <p className="text-sm text-muted-foreground">
          Your real upstream API keys. Never shown after saving.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="optional nickname" />
              </div>
            </div>
            <div>
              <Label>API key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                className="font-mono"
                placeholder="sk-…"
              />
            </div>
            {provider === "custom" && (
              <div>
                <Label>Base URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured</CardTitle>
        </CardHeader>
        <CardContent>
          {(keys ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {keys!.map((k) => (
                <li key={k.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{k.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {k.provider} {k.baseUrl ? `· ${k.baseUrl}` : ""}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete provider key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the key for <strong>{k.label}</strong> ({k.provider}).
                          Any proxy keys relying on this provider will no longer function.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            await deleteProviderKey(k.id);
                            qc.invalidateQueries({ queryKey: ["redactor-provider-keys"] });
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
