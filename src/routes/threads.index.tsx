import { createFileRoute } from "@tanstack/react-router";
import ThreadsList from "@/pages/threads/ThreadsList";

export const Route = createFileRoute("/threads/")({
  head: () => ({
    meta: [
      { title: "Threads — Code Canvas Community" },
      { name: "description", content: "Community discussions, questions, and announcements for Code Canvas." },
      { property: "og:title", content: "Threads — Code Canvas Community" },
      { property: "og:description", content: "Community discussions, questions, and announcements for Code Canvas." },
    ],
  }),
  component: ThreadsList,
});
