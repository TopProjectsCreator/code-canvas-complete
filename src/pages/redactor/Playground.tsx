import { useState, useRef } from "react";
import { previewRedaction, previewImageRedaction } from "@/redactor/lib/redaction.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightedText } from "@/redactor/components/HighlightedText";

type Tab = "text" | "image";

export default function RedactorPlayground() {
  const [tab, setTab] = useState<Tab>("text");

  // Text redaction
  const [input, setInput] = useState(
    "My API key is sk-proj-abcd1234efgh5678ijkl9012mnop3456. Contact alice@example.com or call +1 415 555 0123.",
  );
  const [out, setOut] = useState<{ redacted: string; matches: { token: string; original: string; type: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  // Image redaction
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [imgOut, setImgOut] = useState<{ redacted: string; matches: { token: string; original: string; type: string }[]; hasPii: boolean } | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function go() {
    setBusy(true);
    try {
      const r = previewRedaction(input);
      setOut({ redacted: r.redacted, matches: r.matches });
    } finally {
      setBusy(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrText("");
    setImgOut(null);

    setOcrBusy(true);
    try {
      const T = await import("tesseract.js");
      const { data } = await T.recognize(file, "eng");
      setOcrText(data.text);
      const r = previewImageRedaction(data.text);
      setImgOut(r);
    } catch (err) {
      setOcrText(`OCR failed: ${(err as Error).message}`);
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Playground</h1>
        <p className="text-sm text-muted-foreground">
          Test what the redactor strips from text or images before forwarding upstream.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border/40 pb-2">
        <button
          onClick={() => setTab("text")}
          className={`px-3 py-1 text-sm rounded-t ${tab === "text" ? "bg-card font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          Text redaction
        </button>
        <button
          onClick={() => setTab("image")}
          className={`px-3 py-1 text-sm rounded-t ${tab === "image" ? "bg-card font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          Image redaction (OCR)
        </button>
      </div>

      {tab === "text" && (
        <>
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
                  {busy ? "Working\u2026" : "Redact"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">What the provider sees</CardTitle></CardHeader>
              <CardContent>
                <div className="w-full h-72 rounded-md border bg-background p-3 font-mono text-sm overflow-auto whitespace-pre-wrap">
                  {out ? <HighlightedText text={out.redacted} /> : <span className="text-muted-foreground">\u2014</span>}
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
        </>
      )}

      {tab === "image" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Upload an image</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleImageUpload}
                  className="block w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Uploaded" className="max-w-full h-auto rounded border max-h-64 object-contain" />
                )}
                {ocrBusy && <p className="text-sm text-muted-foreground">Running OCR\u2026 (first load downloads ~15MB of OCR data)</p>}
                {ocrText && !ocrBusy && (
                  <div>
                    <p className="text-sm font-medium mb-1">OCR extracted text:</p>
                    <pre className="w-full rounded-md border bg-background p-3 font-mono text-xs overflow-auto whitespace-pre-wrap max-h-32">
                      {ocrText}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Redacted result</CardTitle></CardHeader>
              <CardContent>
                {imgOut ? (
                  <div className="space-y-3">
                    <div className="w-full rounded-md border bg-background p-3 font-mono text-sm overflow-auto whitespace-pre-wrap max-h-64">
                      {imgOut.hasPii ? <HighlightedText text={imgOut.redacted} /> : ocrText}
                    </div>
                    {!imgOut.hasPii && ocrText && (
                      <p className="text-sm text-muted-foreground">No PII detected in this image.</p>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Upload an image to test redaction</span>
                )}
              </CardContent>
            </Card>
          </div>

          {imgOut && imgOut.matches.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Detected in image ({imgOut.matches.length})</CardTitle></CardHeader>
              <CardContent className="font-mono text-xs space-y-1">
                {imgOut.matches.map((m, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[oklch(0.86_0.18_165)] w-28">{m.token}</span>
                    <span className="text-muted-foreground w-32">{m.type}</span>
                    <span className="line-through text-destructive/80 break-all">{m.original}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
