import { useMutation, useQueryClient } from "@tanstack/react-query";
import replaceProjectAccess from "@/fetchers/workspace-user/replace-project-access";

function useReplaceProjectAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceProjectAccess,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-project-access", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-users", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-overview", variables.workspaceId],
      });
    },
  });
}

export default useReplaceProjectAccess;
