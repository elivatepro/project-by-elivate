import { useQuery } from "@tanstack/react-query";
import getProjectAccess from "@/fetchers/workspace-user/get-project-access";

function useGetProjectAccess(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-project-access", workspaceId],
    queryFn: () => getProjectAccess(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export default useGetProjectAccess;
