import { createFileRoute } from "@tanstack/react-router";
import WorkspaceOverview from "@/components/workspace-overview";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/",
)({
  component: WorkspaceOverview,
});
