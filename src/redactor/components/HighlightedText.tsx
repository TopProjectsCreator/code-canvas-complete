export function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z]+_\d+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[A-Z]+_\d+\]$/.test(p) ? (
          <span key={i} className="px-1 rounded bg-[oklch(0.86_0.18_165)]/15 text-[oklch(0.86_0.18_165)]">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
