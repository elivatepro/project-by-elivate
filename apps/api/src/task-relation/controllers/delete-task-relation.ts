import { eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { requireProjectAccess } from "../../utils/project-access";

async function deleteTaskRelation(id: string, userId: string) {
  const [rel] = await db
    .select({
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
    })
    .from(taskRelationTable)
    .where(eq(taskRelationTable.id, id))
    .limit(1);

  if (!rel) {
    throw new HTTPException(404, {
      message: "Task relation not found",
    });
  }

  const tasks = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(inArray(taskTable.id, [rel.sourceTaskId, rel.targetTaskId]));

  for (const task of tasks) {
    await requireProjectAccess(userId, task.projectId);
  }

  const task = tasks.find((candidate) => candidate.id === rel.sourceTaskId);

  const [relation] = await db
    .delete(taskRelationTable)
    .where(eq(taskRelationTable.id, id))
    .returning();

  if (!relation) {
    throw new HTTPException(404, {
      message: "Task relation not found",
    });
  }

  if (task) {
    await publishEvent("task-relation.deleted", {
      ...relation,
      taskId: rel.sourceTaskId,
      sourceTaskId: rel.sourceTaskId,
      targetTaskId: rel.targetTaskId,
      projectId: task.projectId,
      userId,
    });
  }

  return relation;
}

export default deleteTaskRelation;
