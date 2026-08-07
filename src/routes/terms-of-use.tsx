import { createFileRoute } from "@tanstack/react-router";
import TermsOfUsePage from "@/pages/TermsOfUse";

export const Route = createFileRoute("/terms-of-use")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Code Canvas" },
      { name: "description", content: "The terms and conditions for using Code Canvas." },
    ],
  }),
  component: TermsOfUsePage,
});
