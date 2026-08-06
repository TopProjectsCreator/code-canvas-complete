import { createFileRoute } from "@tanstack/react-router";
import RedactorLanding from "@/pages/redactor/Landing";

export const Route = createFileRoute("/redactor/")({
  head: () => ({
    meta: [
      { title: "Redactor — Privacy-first LLM proxy" },
      { name: "description", content: "Redactor strips sensitive data from prompts before they reach any LLM provider." },
      { property: "og:title", content: "Redactor — Privacy-first LLM proxy" },
      { property: "og:description", content: "Redactor strips sensitive data from prompts before they reach any LLM provider." },
    ],
  }),
  component: RedactorLanding,
});
