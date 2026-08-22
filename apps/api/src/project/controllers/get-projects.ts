import { and, count, eq, inArray, isNull, min, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { getProjectAccessScope } from "../../utils/project-access";

type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: Date | null;
};

const EMPTY_STATISTICS: ProjectStatistics = {
  completionPercentage: 0,
  totalTasks: 0,
  dueDate: null,
};

async function getProjectStatistics(
  workspaceId: string,
  includeArchived: boolean,
  projectIds: string[] | null,
) {
  const statisticsByProject = new Map<string, ProjectStatistics>();

  // Aggregate in the database instead of loading every task row into memory.
  // This endpoint needs three numbers per project; the previous
  // `with: { tasks: true }` made both the query and the response grow linearly
  // with the number of tasks in the workspace. Scoping by workspaceId through
  // a join (rather than an `IN (...projectIds)` list) keeps the statement size
  // constant regardless of how many projects the workspace has.
  const rows = await db
    .select({
      projectId: taskTable.projectId,
      totalTasks: count(),
      completedTasks: count(
        sql`case when ${taskTable.status} in ('done', 'archived') then 1 end`,
      ),
      dueDate: min(taskTable.dueDate),
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        includeArchived
          ? eq(projectTable.workspaceId, workspaceId)
          : and(
              eq(projectTable.workspaceId, workspaceId),
              isNull(projectTable.archivedAt),
            ),
        projectIds ? inArray(projectTable.id, projectIds) : undefined,
      ),
    )
    .groupBy(taskTable.projectId);

  for (const row of rows) {
    const totalTasks = Number(row.totalTasks);
    const completedTasks = Number(row.completedTasks);

    statisticsByProject.set(row.projectId, {
      totalTasks,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      dueDate: row.dueDate ?? null,
    });
  }

  return statisticsByProject;
}

async function getProjects(
  workspaceId: string,
  includeArchived = false,
  userId?: string,
) {
  const scope = userId
    ? await getProjectAccessScope(userId, workspaceId)
    : { all: true as const, projectIds: null };
  const visibleProjectIds = scope.all ? null : scope.projectIds;

  const projects = await db.query.projectTable.findMany({
    where: and(
      includeArchived
        ? eq(projectTable.workspaceId, workspaceId)
        : and(
            eq(projectTable.workspaceId, workspaceId),
            isNull(projectTable.archivedAt),
          ),
      visibleProjectIds
        ? inArray(projectTable.id, visibleProjectIds)
        : undefined,
    ),
    // `id` is the deterministic tie-breaker: without it, rows sharing both a
    // position and a createdAt come back in an unspecified order.
    orderBy: (project, { asc }) => [
      asc(project.position),
      asc(project.createdAt),
      asc(project.id),
    ],
  });

  const statisticsByProject = await getProjectStatistics(
    workspaceId,
    includeArchived,
    visibleProjectIds,
  );

  return projects.map((project) => ({
    ...project,
    statistics: statisticsByProject.get(project.id) ?? EMPTY_STATISTICS,
    archivedTasks: [],
    plannedTasks: [],
    columns: [],
  }));
}

export default getProjects;
