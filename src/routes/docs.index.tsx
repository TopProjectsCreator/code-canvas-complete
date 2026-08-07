import { createFileRoute } from "@tanstack/react-router";
import Docs from "@/pages/Docs";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Docs — Code Canvas" },
      { name: "description", content: "Documentation for Code Canvas: getting started, IDE features, hardware flashing, automations, and more." },
      { property: "og:title", content: "Docs — Code Canvas" },
      { property: "og:description", content: "Documentation for Code Canvas: getting started, IDE features, hardware flashing, automations, and more." },
    ],
  }),
  component: Docs,
});
