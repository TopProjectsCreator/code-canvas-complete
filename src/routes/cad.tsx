import { createFileRoute } from "@tanstack/react-router";
import CadPage from "@/pages/CadPage";

export const Route = createFileRoute("/cad")({
  head: () => ({
    meta: [
      { title: "CAD Designer — Code Canvas" },
      { name: "description", content: "Parametric 3D CAD modeling in the browser, built into Code Canvas." },
    ],
  }),
  component: CadPage,
});
