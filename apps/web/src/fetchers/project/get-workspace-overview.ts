import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type WorkspaceOverview = InferResponseType<
  (typeof client.project.overview)["$get"],
  200
>;

type GetWorkspaceOverviewRequest = InferRequestType<
  (typeof client.project.overview)["$get"]
>;

async function getWorkspaceOverview({
  workspaceId,
}: GetWorkspaceOverviewRequest["query"]) {
  const response = await client.project.overview.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getWorkspaceOverview;
