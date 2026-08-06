import { createFileRoute } from "@tanstack/react-router";
import OnlineUsersAdmin from "@/pages/admin/OnlineUsers";

export const Route = createFileRoute("/admin/online-users")({
  head: () => ({ meta: [{ title: "Online Users — Admin — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: OnlineUsersAdmin,
});
