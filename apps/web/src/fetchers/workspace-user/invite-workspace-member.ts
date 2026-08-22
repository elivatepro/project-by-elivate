import { authClient } from "@/lib/auth-client";

export type InviteWorkspaceMemberRequest = {
  workspaceId: string;
  email: string;
  role?: "owner" | "admin" | "member";
  projectIds?: string[];
};

const inviteWorkspaceMember = async ({
  workspaceId,
  email,
  role = "member",
  projectIds = [],
}: InviteWorkspaceMemberRequest) => {
  const { data, error } = await authClient.organization.inviteMember({
    organizationId: workspaceId,
    email,
    role,
    projectIds: JSON.stringify(projectIds),
  });

  if (error) {
    throw new Error(error.message || "Failed to invite workspace member");
  }

  return data;
};

export default inviteWorkspaceMember;
