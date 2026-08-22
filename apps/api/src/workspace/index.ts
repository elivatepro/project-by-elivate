import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import {
  getWorkspaceProjectAccess,
  replaceMemberProjectAccess,
} from "./controllers/project-access";

const workspace = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/:workspaceId/project-access",
    describeRoute({
      operationId: "getWorkspaceProjectAccess",
      tags: ["Workspaces"],
      description: "Get project assignments for workspace members",
      responses: {
        200: {
          description: "Workspace projects and member assignments",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  projects: v.array(
                    v.object({
                      id: v.string(),
                      name: v.string(),
                      icon: v.nullable(v.string()),
                    }),
                  ),
                  assignments: v.array(
                    v.object({
                      userId: v.string(),
                      projectIds: v.array(v.string()),
                    }),
                  ),
                }),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromParam("workspaceId"),
    async (c) => {
      const result = await getWorkspaceProjectAccess(
        c.get("userId"),
        c.get("workspaceId"),
      );
      return c.json(result);
    },
  )
  .put(
    "/:workspaceId/members/:userId/project-access",
    describeRoute({
      operationId: "replaceMemberProjectAccess",
      tags: ["Workspaces"],
      description: "Replace a member's project assignments",
      responses: {
        200: {
          description: "Member project assignments updated",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  userId: v.string(),
                  projectIds: v.array(v.string()),
                }),
              ),
            },
          },
        },
      },
    }),
    validator(
      "param",
      v.object({ workspaceId: v.string(), userId: v.string() }),
    ),
    validator("json", v.object({ projectIds: v.array(v.string()) })),
    workspaceAccess.fromParam("workspaceId"),
    async (c) => {
      const { workspaceId, userId } = c.req.valid("param");
      const { projectIds } = c.req.valid("json");
      const result = await replaceMemberProjectAccess(
        c.get("userId"),
        workspaceId,
        userId,
        projectIds,
      );
      return c.json(result);
    },
  )
  .get(
    "/:workspaceId/members",
    describeRoute({
      operationId: "getWorkspaceMembers",
      tags: ["Workspaces"],
      description: "Get all members of a workspace",
      responses: {
        200: {
          description: "List of workspace members",
          content: {
            "application/json": {
              schema: resolver(
                v.array(
                  v.object({
                    id: v.string(),
                    name: v.string(),
                    email: v.string(),
                    image: v.nullable(v.string()),
                    role: v.string(),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromParam("workspaceId"),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const members = await getWorkspaceMembersCtrl(workspaceId);
      return c.json(members);
    },
  );

export default workspace;
