import { createFileRoute } from "@tanstack/react-router";
import Compare from "@/pages/Compare";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare — Code Canvas vs other IDEs" },
      { name: "description", content: "See how Code Canvas compares to other browser-based IDEs and cloud development platforms." },
      { property: "og:title", content: "Compare — Code Canvas vs other IDEs" },
      { property: "og:description", content: "See how Code Canvas compares to other browser-based IDEs and cloud development platforms." },
    ],
  }),
  component: Compare,
});
