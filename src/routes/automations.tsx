import { createFileRoute } from "@tanstack/react-router";
import AutomationsPage from "@/pages/Automations";

export const Route = createFileRoute("/automations")({
  head: () => ({
    meta: [
      { title: "Automations — Code Canvas" },
      { name: "description", content: "Build trigger-based automation workflows with 70+ blocks in Code Canvas." },
    ],
  }),
  component: AutomationsPage,
});
