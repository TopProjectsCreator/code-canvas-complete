import { createFileRoute } from "@tanstack/react-router";
import ScratchPage from "@/pages/Scratch";

export const Route = createFileRoute("/scratch")({
  head: () => ({
    meta: [
      { title: "Scratch Blocks — Code Canvas" },
      { name: "description", content: "Create Scratch-style block programs in the browser with Code Canvas." },
    ],
  }),
  component: ScratchPage,
});
