import { createFileRoute } from "@tanstack/react-router";
import OfficePage from "@/pages/Office";

export const Route = createFileRoute("/office")({
  head: () => ({
    meta: [
      { title: "Office Editors — Code Canvas" },
      { name: "description", content: "Edit documents, spreadsheets, and presentations right inside the Code Canvas IDE." },
    ],
  }),
  component: OfficePage,
});
