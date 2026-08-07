import { createFileRoute } from "@tanstack/react-router";
import RedactorAuthenticatedLayout from "@/pages/redactor/AuthenticatedLayout";

// Auth-gated layout: renders sidebar + <Outlet /> only for signed-in users,
// redirects to /redactor/auth otherwise (preserved from the original route table).
export const Route = createFileRoute("/redactor/_authenticated")({
  component: RedactorAuthenticatedLayout,
});
