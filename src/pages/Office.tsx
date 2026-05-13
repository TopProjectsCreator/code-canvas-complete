import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

export default function OfficePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <Seo
        title="Word, Excel & PowerPoint Editing | Code Canvas"
        description="Edit .docx, .xlsx, and .pptx files in the browser with full OOXML round-trip — formulas, styles, and embedded media preserved."
        path="/office"
      />
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-primary">Office Suite</p>
          <h1 className="text-4xl font-bold tracking-tight">Office in Code Canvas</h1>
          <p className="text-base text-muted-foreground">
            Edit Word, Excel, and PowerPoint files directly inside the IDE — full round-trip with the original
            <code className="rounded bg-muted px-1">.docx</code>, <code className="rounded bg-muted px-1">.xlsx</code>, and
            <code className="rounded bg-muted px-1">.pptx</code> binaries preserved.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we implement</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li><strong>Specialized editors</strong> for Word, Excel, and PowerPoint, opened automatically by file extension.</li>
            <li><strong>ZIP-aware round-trip.</strong> Office files are OOXML zip bundles; we read the bytes, edit the parts in place, and re-pack so formulas, styles, and embedded media survive.</li>
            <li><strong>Debounced auto-save</strong> via the <code className="rounded bg-muted px-1">lastZipBytesRef</code> pattern — typing never blocks on disk writes.</li>
            <li><strong>Slide / sheet / page navigator</strong> sidebar with thumbnails and reordering.</li>
            <li><strong>Formula recalculation</strong> for spreadsheets and inline chart rendering.</li>
            <li><strong>AI editing.</strong> Ask the assistant to "add a totals row", "rewrite slide 3 in a punchier tone", or "insert a 2x3 comparison table" — edits land directly in the OOXML.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Supported formats</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li><code className="rounded bg-muted px-1">.docx</code> — Word documents (paragraphs, headings, tables, images)</li>
            <li><code className="rounded bg-muted px-1">.xlsx</code> — Excel workbooks (cells, formulas, multi-sheet, formatting)</li>
            <li><code className="rounded bg-muted px-1">.pptx</code> — PowerPoint decks (slides, layouts, images, shapes)</li>
          </ul>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/editor" className="text-primary underline underline-offset-4">Open the editor</Link>
          <Link to="/automations" className="text-primary underline underline-offset-4">Automations</Link>
          <Link to="/scratch" className="text-primary underline underline-offset-4">Scratch</Link>
        </footer>
      </div>
    </main>
  );
}
