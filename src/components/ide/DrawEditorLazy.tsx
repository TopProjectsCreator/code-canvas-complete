import * as React from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { FileNode } from "@/types/ide";

// Excalidraw reads `window` at module scope, so the import itself must stay out
// of the SSR graph — not just its rendering.
const DrawEditorImpl = React.lazy(async () => {
  const mod = await import("./DrawEditor");
  return { default: mod.DrawEditor };
});

interface DrawEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

const Fallback = () => (
  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
    Loading canvas…
  </div>
);

export const DrawEditor = (props: DrawEditorProps) => (
  <ClientOnly fallback={<Fallback />}>
    <React.Suspense fallback={<Fallback />}>
      <DrawEditorImpl {...props} />
    </React.Suspense>
  </ClientOnly>
);
