import { and, eq, inArray, isNull, or } from "drizzle-orm";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { getProjectAccessScope } from "../../utils/project-access";

async function getLabelsByWorkspaceId(workspaceId: string, userId?: string) {
  const scope = userId
    ? await getProjectAccessScope(userId, workspaceId)
    : { all: true as const, projectIds: null };

  const where = scope.all
    ? eq(labelTable.workspaceId, workspaceId)
    : and(
        eq(labelTable.workspaceId, workspaceId),
        or(
          isNull(labelTable.taskId),
          inArray(projectTable.id, scope.projectIds),
        ),
      );

  return db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
      createdAt: labelTable.createdAt,
      taskId: labelTable.taskId,
      workspaceId: labelTable.workspaceId,
    })
    .from(labelTable)
    .leftJoin(taskTable, eq(labelTable.taskId, taskTable.id))
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(where);
}

export default getLabelsByWorkspaceId;
