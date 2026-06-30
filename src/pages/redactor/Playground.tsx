import { useState, useRef, useEffect } from "react";
import { previewRedaction, previewImageRedaction, pixelateImageOnCanvas, type OCRWord } from "@/redactor/lib/redaction.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightedText } from "@/redactor/components/HighlightedText";
import { supabase } from "@/integrations/supabase/client";

type Tab = "text" | "image" | "video" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function RedactorPlayground() {
  const [tab, setTab] = useState<Tab>("text");

  // Text redaction
  const [input, setInput] = useState(
    "My API key is sk-proj-abcd1234efgh5678ijkl9012mnop3456. Contact alice@example.com or call +1 415 555 0123.",
  );
  const [out, setOut] = useState<{ redacted: string; matches: { token: string; original: string; type: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  // Image redaction
  const [, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [, setOcrWords] = useState<OCRWord[]>([]);
  const [redactedImageUrl, setRedactedImageUrl] = useState<string | null>(null);
  const [imgOut, setImgOut] = useState<{ redacted: string; matches: { token: string; original: string; type: string }[]; hasPii: boolean } | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [chatModel, setChatModel] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("redactor_model_pricing")
      .select("model_id, provider_id")
      .order("model_id")
      .then(({ data, error }) => {
        if (error) return;
        const models = [...new Set(data?.map((r) => r.provider_id + "/" + r.model_id) ?? [])];
        const bare = [...new Set(data?.map((r) => r.model_id) ?? [])];
        const all = [...new Set([...bare, ...models])].sort();
        setChatModels(all);
        if (all.length > 0) setChatModel(all[0]);
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function sendChat() {
    if (!chatInput.trim() || chatBusy) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/oauth/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: chatModel,
          messages: [...chatMessages, userMsg],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg: string;
        try { msg = JSON.parse(text).error; } catch { msg = text; }
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();

      const reply = data?.choices?.[0]?.message?.content ?? data?.content?.[0]?.text ?? JSON.stringify(data);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${(err as Error).message}` }]);
    } finally {
      clearTimeout(timeout);
      setChatBusy(false);
    }
  }

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
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setOcrText("");
    setOcrWords([]);
    setRedactedImageUrl(null);
    setImgOut(null);

    setOcrBusy(true);
    try {
      const T = await import("tesseract.js");
      const { data } = await T.recognize(file, "eng");
      const words: OCRWord[] = ((data as any).words ?? []).map((w: any) => ({
        text: w.text,
        bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
      }));
      setOcrText(data.text);
      setOcrWords(words);

      const r = previewImageRedaction(data.text);
      setImgOut(r);

      // Generate pixelated image preview when PII is found
      if (r.hasPii && words.length > 0) {
        pixelateImageOnCanvas(url, words, r.matches, data.text).then(
          (redactedUrl) => setRedactedImageUrl(redactedUrl),
        );
      }
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
        <button
          onClick={() => setTab("video")}
          className={`px-3 py-1 text-sm rounded-t ${tab === "video" ? "bg-card font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          Video redaction (I-frame)
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-3 py-1 text-sm rounded-t ${tab === "chat" ? "bg-card font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          Chat
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
              <CardHeader><CardTitle className="text-base">What the provider sees</CardTitle></CardHeader>
              <CardContent>
                {imgOut ? (
                  <div className="space-y-3">
                    {redactedImageUrl ? (
                      <img src={redactedImageUrl} alt="Redacted image" className="max-w-full h-auto rounded border max-h-64 object-contain" />
                    ) : imgOut.hasPii ? (
                      <div className="w-full rounded-md border bg-background p-3 font-mono text-sm overflow-auto whitespace-pre-wrap max-h-64">
                        <HighlightedText text={imgOut.redacted} />
                      </div>
                    ) : null}
                    {imgOut.hasPii && redactedImageUrl && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Show redacted OCR text
                        </summary>
                        <div className="mt-2 rounded-md border bg-background p-3 font-mono text-xs overflow-auto whitespace-pre-wrap max-h-32">
                          <HighlightedText text={imgOut.redacted} />
                        </div>
                      </details>
                    )}
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

      {tab === "video" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">How video redaction works</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                When a chat request contains a <code>file_uri</code> or data URI pointing to a video,
                the proxy downloads it in chunks, extracts <strong>I-frames</strong> (1 per GOP, ~1/sec),
                runs OCR + pixelation + token overlay, and re-encodes only the I-frames. The
                P/B-frames naturally propagate the pixelation through motion prediction.
              </p>
              <p>
                The proxy replaces the video URL with a streaming endpoint that serves the
                progressively-redacted video to the AI provider during inference. Zero extra
                wall-clock time for the user.
              </p>
              <div className="rounded-md border bg-card/40 p-4 font-mono text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">1.</span>
                  <span>Download video in chunks from source URL</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">2.</span>
                  <span>mp4box demux → h264 decode I-frames → OCR → pixelate → re-encode</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">3.</span>
                  <span>mp4box remux redacted I-frames with original P/B-frames</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">4.</span>
                  <span>Stream redacted MP4 to AI provider via chunked transfer</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm max-w-xs"
            >
              {chatModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {chatModels.length === 0 && <span className="text-xs text-muted-foreground">Loading models\u2026</span>}
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="h-80 overflow-y-auto space-y-3 border rounded-md bg-background p-3">
                {chatMessages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center pt-8">Send a message to start chatting</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); sendChat(); }}
                className="flex gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message\u2026"
                  disabled={chatBusy}
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" disabled={chatBusy || !chatInput.trim() || chatModels.length === 0}>
                  {chatBusy ? "Thinking\u2026" : "Send"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
