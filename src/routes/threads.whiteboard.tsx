import * as React from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";

// Excalidraw touches `window` at import time, so keep it out of the SSR graph.
const GlobalWhiteboard = React.lazy(() => import("@/pages/threads/GlobalWhiteboard"));

export const Route = createFileRoute("/threads/whiteboard")({
  head: () => ({
    meta: [
      { title: "Whiteboard — Code Canvas" },
      {
        name: "description",
        content: "A shared infinite whiteboard for Code Canvas threads with live collaborative editing.",
      },
      { property: "og:title", content: "Whiteboard — Code Canvas" },
      {
        property: "og:description",
        content: "A shared infinite whiteboard for Code Canvas threads with live collaborative editing.",
      },
    ],
  }),
  component: WhiteboardRoute,
});

function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center text-sm text-muted-foreground">
      Loading whiteboard…
    </div>
  );
}

function WhiteboardRoute() {
  return (
    <ClientOnly fallback={<Loading />}>
      <React.Suspense fallback={<Loading />}>
        <GlobalWhiteboard />
      </React.Suspense>
    </ClientOnly>
  );
}
