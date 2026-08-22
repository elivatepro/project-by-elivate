import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { requireWorkspaceOwnerOrAdmin } from "../../utils/project-access";
import { closeProjectConnectionsForUser } from "../../ws";

export async function getWorkspaceProjectAccess(
  userId: string,
  workspaceId: string,
) {
  await requireWorkspaceOwnerOrAdmin(userId, workspaceId);

  const [projects, assignments] = await Promise.all([
    db
      .select({
        id: schema.projectTable.id,
        name: schema.projectTable.name,
        icon: schema.projectTable.icon,
      })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.workspaceId, workspaceId))
      .orderBy(
        asc(schema.projectTable.position),
        asc(schema.projectTable.name),
      ),
    db
      .select({
        userId: schema.projectMemberTable.userId,
        projectId: schema.projectMemberTable.projectId,
      })
      .from(schema.projectMemberTable)
      .innerJoin(
        schema.projectTable,
        eq(schema.projectMemberTable.projectId, schema.projectTable.id),
      )
      .where(eq(schema.projectTable.workspaceId, workspaceId)),
  ]);

  const projectIdsByUser = new Map<string, string[]>();
  for (const assignment of assignments) {
    const projectIds = projectIdsByUser.get(assignment.userId) ?? [];
    projectIds.push(assignment.projectId);
    projectIdsByUser.set(assignment.userId, projectIds);
  }

  return {
    projects,
    assignments: [...projectIdsByUser.entries()].map(
      ([userId, projectIds]) => ({
        userId,
        projectIds,
      }),
    ),
  };
}

export async function replaceMemberProjectAccess(
  actorUserId: string,
  workspaceId: string,
  targetUserId: string,
  requestedProjectIds: string[],
) {
  await requireWorkspaceOwnerOrAdmin(actorUserId, workspaceId);

  const [targetMember] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    throw new HTTPException(404, { message: "Workspace member not found" });
  }

  if (targetMember.role === "owner") {
    throw new HTTPException(400, {
      message: "Workspace owners have implicit access to every project",
    });
  }

  const projectIds = [...new Set(requestedProjectIds)];
  const projects =
    projectIds.length > 0
      ? await db
          .select({ id: schema.projectTable.id })
          .from(schema.projectTable)
          .where(
            and(
              eq(schema.projectTable.workspaceId, workspaceId),
              inArray(schema.projectTable.id, projectIds),
            ),
          )
      : [];

  if (projects.length !== projectIds.length) {
    throw new HTTPException(400, {
      message: "One or more selected projects do not belong to this workspace",
    });
  }

  const existing = await db
    .select({ projectId: schema.projectMemberTable.projectId })
    .from(schema.projectMemberTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectMemberTable.projectId, schema.projectTable.id),
    )
    .where(
      and(
        eq(schema.projectMemberTable.userId, targetUserId),
        eq(schema.projectTable.workspaceId, workspaceId),
      ),
    );

  await db.transaction(async (tx) => {
    if (existing.length > 0) {
      await tx.delete(schema.projectMemberTable).where(
        and(
          eq(schema.projectMemberTable.userId, targetUserId),
          inArray(
            schema.projectMemberTable.projectId,
            existing.map((row) => row.projectId),
          ),
        ),
      );
    }

    if (projectIds.length > 0) {
      await tx.insert(schema.projectMemberTable).values(
        projectIds.map((projectId) => ({
          projectId,
          userId: targetUserId,
        })),
      );
    }
  });

  closeProjectConnectionsForUser(
    existing
      .map((row) => row.projectId)
      .filter((projectId) => !projectIds.includes(projectId)),
    targetUserId,
  );

  return { userId: targetUserId, projectIds };
}
