import { useQuery } from "@tanstack/react-query";
import getWorkspaceOverview from "@/fetchers/project/get-workspace-overview";

function useGetWorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  return useQuery({
    queryFn: () => getWorkspaceOverview({ workspaceId }),
    queryKey: ["workspace-overview", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export default useGetWorkspaceOverview;
