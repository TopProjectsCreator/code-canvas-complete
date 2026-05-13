import { Link } from "react-router-dom";

export default function ScratchPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-primary">Visual Programming</p>
          <h1 className="text-4xl font-bold tracking-tight">Scratch in Code Canvas</h1>
          <p className="text-base text-muted-foreground">
            A from-scratch implementation of a Scratch-style block editor — drag blocks together, run them in the
            browser, and export to the standard <code className="rounded bg-muted px-1">.sb3</code> format.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we implement</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li><strong>Custom block engine.</strong> Pointer-based drag-and-drop with snap targets, shadow inputs, and nested C-blocks — no Blockly dependency.</li>
            <li><strong>Native browser bridging.</strong> <code className="rounded bg-muted px-1">ask</code>/<code className="rounded bg-muted px-1">prompt</code> blocks bridge to native browser dialogs.</li>
            <li><strong>Stage runtime.</strong> Sprites, costumes, sound, motion, looks, control, sensing, operators, and variables — all the standard categories.</li>
            <li><strong>SB3 import/export.</strong> Round-trip with the official <code className="rounded bg-muted px-1">.sb3</code> zip format so projects move in and out of scratch.mit.edu.</li>
            <li><strong>Library dialog</strong> for sprites, backdrops, and sounds.</li>
            <li><strong>AI assistance.</strong> Ask the assistant to "add a sprite that follows the mouse" or "make the cat say hello on green flag" — it edits the block tree directly.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Why a custom engine</h2>
          <p className="text-sm text-muted-foreground">
            Embedding the official Scratch GUI brings heavy iframe overhead and breaks our AI editing model. By
            owning the block representation, the assistant can read and write programs the same way it edits any
            other source file in the IDE.
          </p>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/editor" className="text-primary underline underline-offset-4">Open the editor</Link>
          <Link to="/office" className="text-primary underline underline-offset-4">Office</Link>
          <Link to="/automations" className="text-primary underline underline-offset-4">Automations</Link>
        </footer>
      </div>
    </main>
  );
}
