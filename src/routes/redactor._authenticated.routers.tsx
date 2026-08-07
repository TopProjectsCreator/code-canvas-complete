import { createFileRoute } from "@tanstack/react-router";
import RedactorRouters from "@/pages/redactor/Routers";

export const Route = createFileRoute("/redactor/_authenticated/routers")({
  head: () => ({ meta: [{ title: "Routers — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorRouters,
});
