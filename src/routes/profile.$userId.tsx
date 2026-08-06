import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "@/pages/Profile";

export const Route = createFileRoute("/profile/$userId")({
  head: () => ({ meta: [{ title: "Profile — Code Canvas" }] }),
  component: ProfilePage,
});
