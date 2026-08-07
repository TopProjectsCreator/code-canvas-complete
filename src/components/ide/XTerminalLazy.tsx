import * as React from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { ProjectFile } from "./XTerminal";

// xterm is a CommonJS, browser-only module: its import must stay out of the SSR
// graph, so the whole terminal is loaded lazily on the client.
const XTerminalImpl = React.lazy(async () => {
  const mod = await import("./XTerminal");
  return { default: mod.XTerminal };
});

interface XTerminalProps {
  projectFiles?: ProjectFile[];
  projectId?: string;
  projectName?: string;
  isActive?: boolean;
  onFilesUpdate?: (files: ProjectFile[]) => void;
  onPortDetected?: (port: number) => void;
}

const Fallback = () => (
  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
    Starting terminal…
  </div>
);

export type { ProjectFile };

export const XTerminal = (props: XTerminalProps) => (
  <ClientOnly fallback={<Fallback />}>
    <React.Suspense fallback={<Fallback />}>
      <XTerminalImpl {...props} />
    </React.Suspense>
  </ClientOnly>
);
