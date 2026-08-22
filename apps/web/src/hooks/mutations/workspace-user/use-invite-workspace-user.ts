import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import queryClient from "@/query-client";

type InviteWorkspaceUserRequest = {
  workspaceId: string;
  email: string;
  role: "admin" | "member" | "owner";
  projectIds?: string[];
  resend?: boolean;
};

function useInviteWorkspaceUser() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      email,
      role,
      projectIds,
      resend,
    }: InviteWorkspaceUserRequest) => {
      const { data, error } = await authClient.organization.inviteMember({
        email,
        role,
        organizationId: workspaceId,
        projectIds: JSON.stringify(projectIds ?? []),
        resend,
      });

      if (error) {
        throw new Error(error.message || "Failed to invite workspace member");
      }

      return data;
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-invites", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-project-access", workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-overview", workspaceId],
      });
    },
  });
}

export default useInviteWorkspaceUser;
