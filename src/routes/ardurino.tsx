import { createFileRoute } from "@tanstack/react-router";
import ArduinoPage from "@/pages/Arduino";

// Legacy misspelled alias kept from the original route table.
export const Route = createFileRoute("/ardurino")({
  head: () => ({ meta: [{ title: "Arduino — Code Canvas" }] }),
  component: ArduinoPage,
});
