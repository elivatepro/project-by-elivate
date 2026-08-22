import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

const FULL_PROJECT_ACCESS_ROLES = new Set(["owner", "admin"]);

export type ProjectAccessScope =
  | { all: true; projectIds: null }
  | { all: false; projectIds: string[] };

function isFullAccessRole(role: string | null | undefined) {
  return role ? FULL_PROJECT_ACCESS_ROLES.has(role) : false;
}

async function getWorkspaceMemberRole(userId: string, workspaceId: string) {
  const [member] = await db
    .select({
      role: schema.workspaceUserTable.role,
      instanceRole: schema.userTable.role,
    })
    .from(schema.userTable)
    .leftJoin(
      schema.workspaceUserTable,
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  return member ?? null;
}

export async function getProjectAccessScope(
  userId: string,
  workspaceId: string,
): Promise<ProjectAccessScope> {
  const member = await getWorkspaceMemberRole(userId, workspaceId);

  if (member?.instanceRole === "admin" || isFullAccessRole(member?.role)) {
    return { all: true, projectIds: null };
  }

  if (!member) {
    return { all: false, projectIds: [] };
  }

  const assignments = await db
    .select({ projectId: schema.projectMemberTable.projectId })
    .from(schema.projectMemberTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectMemberTable.projectId, schema.projectTable.id),
    )
    .where(
      and(
        eq(schema.projectMemberTable.userId, userId),
        eq(schema.projectTable.workspaceId, workspaceId),
      ),
    );

  return {
    all: false,
    projectIds: assignments.map((assignment) => assignment.projectId),
  };
}

export async function getAccessibleProjectIdsForWorkspaces(
  userId: string,
  workspaceIds: string[],
): Promise<string[]> {
  if (workspaceIds.length === 0) return [];

  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  if (user?.role === "admin") {
    const projects = await db
      .select({ id: schema.projectTable.id })
      .from(schema.projectTable)
      .where(inArray(schema.projectTable.workspaceId, workspaceIds));
    return projects.map((project) => project.id);
  }

  const projects = await db
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .innerJoin(
      schema.workspaceUserTable,
      and(
        eq(
          schema.workspaceUserTable.workspaceId,
          schema.projectTable.workspaceId,
        ),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .leftJoin(
      schema.projectMemberTable,
      and(
        eq(schema.projectMemberTable.projectId, schema.projectTable.id),
        eq(schema.projectMemberTable.userId, userId),
      ),
    )
    .where(
      and(
        inArray(schema.projectTable.workspaceId, workspaceIds),
        or(
          eq(schema.workspaceUserTable.role, "owner"),
          eq(schema.workspaceUserTable.role, "admin"),
          isNotNull(schema.projectMemberTable.id),
        ),
      ),
    );

  return projects.map((project) => project.id);
}

export async function hasProjectAccess(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const [project] = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);

  if (!project) return false;

  const scope = await getProjectAccessScope(userId, project.workspaceId);
  return scope.all || scope.projectIds.includes(projectId);
}

export async function requireProjectAccess(
  userId: string,
  projectId: string,
): Promise<void> {
  if (!(await hasProjectAccess(userId, projectId))) {
    throw new HTTPException(403, {
      message: "You don't have access to this project",
    });
  }
}

export async function requireProjectAccessForIds(
  userId: string,
  projectIds: string[],
): Promise<void> {
  const uniqueProjectIds = [...new Set(projectIds)];
  if (uniqueProjectIds.length === 0) return;

  const projects = await db
    .select({
      id: schema.projectTable.id,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.projectTable)
    .where(inArray(schema.projectTable.id, uniqueProjectIds));

  if (projects.length !== uniqueProjectIds.length) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const workspaceIds = [
    ...new Set(projects.map((project) => project.workspaceId)),
  ];
  if (workspaceIds.length !== 1) {
    throw new HTTPException(400, {
      message: "All projects must belong to the same workspace",
    });
  }

  const workspaceId = workspaceIds[0];
  if (!workspaceId) return;

  const scope = await getProjectAccessScope(userId, workspaceId);
  if (
    !scope.all &&
    uniqueProjectIds.some((id) => !scope.projectIds.includes(id))
  ) {
    throw new HTTPException(403, {
      message: "You don't have access to one or more projects",
    });
  }
}

export async function requireWorkspaceOwnerOrAdmin(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const member = await getWorkspaceMemberRole(userId, workspaceId);
  if (member?.instanceRole === "admin") return;

  if (!isFullAccessRole(member?.role)) {
    throw new HTTPException(403, {
      message: "Only workspace owners and admins can manage project access",
    });
  }
}

export function parseInvitationProjectIds(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return [
      ...new Set(
        parsed.filter(
          (projectId): projectId is string =>
            typeof projectId === "string" && projectId.length > 0,
        ),
      ),
    ];
  } catch {
    return [];
  }
}
