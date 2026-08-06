import { createFileRoute } from "@tanstack/react-router";
import PrivacyPolicyPage from "@/pages/PrivacyPolicy";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Code Canvas" },
      { name: "description", content: "How Code Canvas collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPolicyPage,
});
