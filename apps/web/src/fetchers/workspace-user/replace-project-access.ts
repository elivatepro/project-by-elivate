import { client } from "@kaneo/libs";

async function replaceProjectAccess({
  workspaceId,
  userId,
  projectIds,
}: {
  workspaceId: string;
  userId: string;
  projectIds: string[];
}) {
  const response = await client.workspace[":workspaceId"].members[":userId"][
    "project-access"
  ].$put({
    param: { workspaceId, userId },
    json: { projectIds },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default replaceProjectAccess;
