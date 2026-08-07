import { createFileRoute } from "@tanstack/react-router";
import Docs from "@/pages/Docs";

export const Route = createFileRoute("/docs/$slug")({
  head: () => ({ meta: [{ title: "Docs — Code Canvas" }] }),
  component: Docs,
});
