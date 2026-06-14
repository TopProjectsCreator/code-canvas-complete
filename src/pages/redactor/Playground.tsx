import { useState } from "react";
import { previewRedaction } from "@/redactor/lib/redaction.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightedText } from "@/redactor/components/HighlightedText";

export default function RedactorPlayground() {
  const [input, setInput] = useState(
    "My API key is sk-proj-abcd1234efgh5678ijkl9012mnop3456. Contact alice@example.com or call +1 415 555 0123.",
  );
  const [out, setOut] = useState<{ redacted: string; matches: { token: string; original: string; type: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  function go() {
    setBusy(true);
    try {
      const r = previewRedaction(input);
      setOut({ redacted: r.redacted, matches: r.matches });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Playground</h1>
        <p className="text-sm text-muted-foreground">
          Test what the redactor would strip from a prompt before forwarding upstream.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Your prompt</CardTitle></CardHeader>
          <CardContent>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-72 rounded-md border bg-background p-3 font-mono text-sm resize-none"
            />
            <Button onClick={go} disabled={busy} className="mt-3">
              {busy ? "Working…" : "Redact"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">What the provider sees</CardTitle></CardHeader>
          <CardContent>
            <div className="w-full h-72 rounded-md border bg-background p-3 font-mono text-sm overflow-auto whitespace-pre-wrap">
              {out ? <HighlightedText text={out.redacted} /> : <span className="text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {out && out.matches.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Detected ({out.matches.length})</CardTitle></CardHeader>
          <CardContent className="font-mono text-xs space-y-1">
            {out.matches.map((m, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-[oklch(0.86_0.18_165)] w-28">{m.token}</span>
                <span className="text-muted-foreground w-32">{m.type}</span>
                <span className="line-through text-destructive/80 break-all">{m.original}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


