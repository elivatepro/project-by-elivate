import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  notificationTable,
  projectTable,
  taskTable,
  workspaceTable,
} from "../../database/schema";
import { getAccessibleProjectIdsForWorkspaces } from "../../utils/project-access";

async function getNotifications(userId: string) {
  const rows = await db
    .select({
      notification: notificationTable,
      projectId: projectTable.id,
      workspaceId: workspaceTable.id,
    })
    .from(notificationTable)
    .leftJoin(
      taskTable,
      and(
        eq(notificationTable.resourceId, taskTable.id),
        eq(notificationTable.resourceType, "task"),
      ),
    )
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(eq(notificationTable.userId, userId))
    .orderBy(desc(notificationTable.createdAt))
    .limit(50);

  const eventProjectIds = rows.flatMap(({ notification }) => {
    const data = notification.eventData;
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    const projectId = (data as Record<string, unknown>).projectId;
    return typeof projectId === "string" ? [projectId] : [];
  });
  const joinedProjectIds = rows.flatMap(({ projectId }) =>
    projectId ? [projectId] : [],
  );
  const candidateProjectIds = [
    ...new Set([...eventProjectIds, ...joinedProjectIds]),
  ];
  const projectContexts =
    candidateProjectIds.length > 0
      ? await db
          .select({
            id: projectTable.id,
            workspaceId: projectTable.workspaceId,
          })
          .from(projectTable)
          .where(inArray(projectTable.id, candidateProjectIds))
      : [];
  const accessibleProjectIds = new Set(
    await getAccessibleProjectIdsForWorkspaces(userId, [
      ...new Set(projectContexts.map((project) => project.workspaceId)),
    ]),
  );

  return rows.flatMap(({ notification, projectId, workspaceId }) => {
    const eventData = notification.eventData;
    const eventProjectId =
      eventData && typeof eventData === "object" && !Array.isArray(eventData)
        ? (eventData as Record<string, unknown>).projectId
        : null;
    const relatedProjectId =
      projectId ?? (typeof eventProjectId === "string" ? eventProjectId : null);

    if (relatedProjectId && !accessibleProjectIds.has(relatedProjectId)) {
      return [];
    }

    if (!projectId && !workspaceId) {
      return [notification];
    }

    const existing =
      notification.eventData &&
      typeof notification.eventData === "object" &&
      !Array.isArray(notification.eventData)
        ? (notification.eventData as Record<string, unknown>)
        : {};

    return [
      {
        ...notification,
        eventData: {
          ...existing,
          projectId: projectId ?? existing.projectId ?? null,
          workspaceId: workspaceId ?? existing.workspaceId ?? null,
        },
      },
    ];
  });
}

export default getNotifications;
