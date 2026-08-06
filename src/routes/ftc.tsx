import { createFileRoute } from "@tanstack/react-router";
import FTCPage from "@/pages/FTC";

export const Route = createFileRoute("/ftc")({
  head: () => ({
    meta: [
      { title: "FTC Robotics — Code Canvas" },
      { name: "description", content: "Program and flash FTC robots from the browser with Code Canvas." },
    ],
  }),
  component: FTCPage,
});
