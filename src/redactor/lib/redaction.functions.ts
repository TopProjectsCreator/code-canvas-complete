import { redact } from "@/redactor/lib/redaction";

export function previewRedaction(text: string) {
  const r = redact(text, { detectNames: false });
  return {
    redacted: r.text,
    matches: r.matches.map((m) => ({
      type: m.type,
      token: m.token,
      original: m.original,
      start: m.start,
      end: m.end,
    })),
    counts: r.counts,
  };
}
