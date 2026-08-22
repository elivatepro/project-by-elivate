import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type WorkspaceProjectAccess = InferResponseType<
  (typeof client.workspace)[":workspaceId"]["project-access"]["$get"],
  200
>;

async function getProjectAccess(workspaceId: string) {
  const response = await client.workspace[":workspaceId"][
    "project-access"
  ].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getProjectAccess;
