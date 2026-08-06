import { createFileRoute } from "@tanstack/react-router";
import LinkDiscord from "@/pages/LinkDiscord";

export const Route = createFileRoute("/link-discord")({
  head: () => ({ meta: [{ title: "Link Discord — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: LinkDiscord,
});
