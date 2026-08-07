import { createFileRoute } from "@tanstack/react-router";
import ArduinoPage from "@/pages/Arduino";

export const Route = createFileRoute("/arduino")({
  head: () => ({
    meta: [
      { title: "Arduino — Code Canvas" },
      { name: "description", content: "Write, compile, and flash Arduino sketches directly from the browser with Code Canvas." },
    ],
  }),
  component: ArduinoPage,
});
