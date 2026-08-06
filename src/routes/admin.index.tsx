import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/admin/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});
