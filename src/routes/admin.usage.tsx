import { createFileRoute } from "@tanstack/react-router";
import UsageAnalytics from "@/pages/admin/UsageAnalytics";

export const Route = createFileRoute("/admin/usage")({
  head: () => ({ meta: [{ title: "Usage Analytics — Admin — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: UsageAnalytics,
});
