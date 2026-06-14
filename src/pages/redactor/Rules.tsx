import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addRule, deleteRule, listRules } from "@/redactor/lib/dashboard-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function RedactorRules() {
  const qc = useQueryClient();

  const { data: rules } = useQuery({ queryKey: ["redactor-rules"], queryFn: listRules });
  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addRule({ pattern, label });
      setPattern("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["redactor-rules"] });
      toast.success("Rule added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Custom redaction rules</h1>
        <p className="text-sm text-muted-foreground">
          Built-in patterns already cover OpenAI/Anthropic/Google/AWS/GitHub/Slack/Stripe keys, JWTs,
          emails, IPs, MAC addresses, credit cards (Luhn-validated), IBANs, SSNs, phone numbers, env-var
          assignments, and high-entropy tokens. Add your own regex below.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add rule</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <Label>Regex pattern</Label>
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="font-mono"
                placeholder="ACME-[A-Z0-9]{10}"
                required
              />
            </div>
            <div>
              <Label>Label (uppercase, used as token name)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value.toUpperCase())}
                placeholder="INTERNAL_ID"
                required
                pattern="[A-Z_][A-Z0-9_]*"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Matches will be replaced with <code>[{label || "LABEL"}_1]</code>, <code>[…_2]</code>, etc.
              </p>
            </div>
            <Button type="submit">Add rule</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active</CardTitle></CardHeader>
        <CardContent>
          {(rules ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom rules.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {rules!.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between">
                  <div className="font-mono text-sm">
                    <span className="text-[oklch(0.86_0.18_165)]">[{r.label}_n]</span> ← {r.pattern}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the pattern <code className="text-xs">{r.pattern}</code>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            await deleteRule(r.id);
                            qc.invalidateQueries({ queryKey: ["redactor-rules"] });
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
