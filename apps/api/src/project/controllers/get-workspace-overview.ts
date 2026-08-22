import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { getProjectAccessScope } from "../../utils/project-access";

const completedTaskCondition = sql<boolean>`(
  ${taskTable.status} in ('done', 'archived')
  or coalesce(${columnTable.isFinal}, false) = true
)`;

const openTaskCondition = sql<boolean>`not ${completedTaskCondition}`;

type ProjectProgressRow = {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
};

async function getWorkspaceOverview(workspaceId: string, userId?: string) {
  const scope = userId
    ? await getProjectAccessScope(userId, workspaceId)
    : { all: true as const, projectIds: null };

  const activeProjectCondition = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    scope.all ? undefined : inArray(projectTable.id, scope.projectIds),
  );

  const projects = await db.query.projectTable.findMany({
    where: activeProjectCondition,
    columns: { id: true, name: true, icon: true },
    orderBy: (project, { asc }) => [asc(project.position), asc(project.name)],
  });

  const [summaryRows, statusRows, trendRows, projectRows, workloadRows] =
    await Promise.all([
      db
        .select({
          totalTasks: count(),
          completedTasks: sql<number>`count(*) filter (where ${completedTaskCondition})`,
          overdueTasks: sql<number>`count(*) filter (where ${taskTable.dueDate} < now() and ${taskTable.dueDate} is not null and ${openTaskCondition})`,
          dueSoonTasks: sql<number>`count(*) filter (where ${taskTable.dueDate} >= now() and ${taskTable.dueDate} < now() + interval '7 days' and ${openTaskCondition})`,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .where(activeProjectCondition),
      db
        .select({
          key: sql<"completed" | "inProgress" | "planned">`case
            when ${completedTaskCondition} then 'completed'
            when ${taskTable.status} = 'planned' then 'planned'
            else 'inProgress'
          end`,
          count: count(),
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .where(activeProjectCondition)
        .groupBy(sql`1`),
      db
        .select({
          weekStart: sql<Date>`date_trunc('week', ${taskTable.createdAt})`,
          count: count(),
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .where(
          and(
            activeProjectCondition,
            gte(taskTable.createdAt, sql`now() - interval '6 weeks'`),
          ),
        )
        .groupBy(sql`1`)
        .orderBy(asc(sql`1`)),
      db
        .select({
          projectId: taskTable.projectId,
          totalTasks: count(),
          completedTasks: sql<number>`count(*) filter (where ${completedTaskCondition})`,
          overdueTasks: sql<number>`count(*) filter (where ${taskTable.dueDate} < now() and ${taskTable.dueDate} is not null and ${openTaskCondition})`,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .where(activeProjectCondition)
        .groupBy(taskTable.projectId),
      db
        .select({
          id: userTable.id,
          name: userTable.name,
          image: userTable.image,
          totalTasks: count(),
          openTasks: sql<number>`count(*) filter (where ${openTaskCondition})`,
          completedTasks: sql<number>`count(*) filter (where ${completedTaskCondition})`,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(activeProjectCondition)
        .groupBy(userTable.id, userTable.name, userTable.image)
        .orderBy(desc(sql`count(*)`)),
    ]);

  const [upcomingTasks, recentActivity] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        projectName: projectTable.name,
        title: taskTable.title,
        status: taskTable.status,
        priority: taskTable.priority,
        dueDate: taskTable.dueDate,
        assigneeName: userTable.name,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          activeProjectCondition,
          openTaskCondition,
          sql`${taskTable.dueDate} is not null`,
        ),
      )
      .orderBy(
        sql`case
          when ${taskTable.dueDate} is not null and ${taskTable.dueDate} < now() then 0
          when ${taskTable.dueDate} is not null then 1
          else 2
        end`,
        asc(taskTable.dueDate),
        desc(taskTable.createdAt),
      )
      .limit(8),
    db
      .select({
        id: activityTable.id,
        taskId: activityTable.taskId,
        taskTitle: taskTable.title,
        projectId: projectTable.id,
        projectName: projectTable.name,
        type: activityTable.type,
        createdAt: activityTable.createdAt,
        userName: userTable.name,
      })
      .from(activityTable)
      .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(activityTable.userId, userTable.id))
      .where(activeProjectCondition)
      .orderBy(desc(activityTable.createdAt))
      .limit(8),
  ]);

  const summary = summaryRows[0];
  const totalTasks = Number(summary?.totalTasks ?? 0);
  const completedTasks = Number(summary?.completedTasks ?? 0);
  const progressByProject = new Map<string, ProjectProgressRow>(
    projectRows.map((row) => [
      row.projectId,
      {
        projectId: row.projectId,
        totalTasks: Number(row.totalTasks),
        completedTasks: Number(row.completedTasks),
        overdueTasks: Number(row.overdueTasks),
      },
    ]),
  );

  return {
    summary: {
      projectCount: projects.length,
      totalTasks,
      completedTasks,
      overdueTasks: Number(summary?.overdueTasks ?? 0),
      dueSoonTasks: Number(summary?.dueSoonTasks ?? 0),
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    statusBreakdown: (["completed", "inProgress", "planned"] as const).map(
      (key) => ({
        key,
        count: Number(statusRows.find((row) => row.key === key)?.count ?? 0),
      }),
    ),
    taskCreationTrend: trendRows.map((row) => ({
      weekStart: row.weekStart,
      count: Number(row.count),
    })),
    projectProgress: projects.map((project) => {
      const row = progressByProject.get(project.id);
      const projectTotal = row?.totalTasks ?? 0;
      const projectCompleted = row?.completedTasks ?? 0;

      return {
        id: project.id,
        name: project.name,
        icon: project.icon,
        totalTasks: projectTotal,
        completedTasks: projectCompleted,
        overdueTasks: row?.overdueTasks ?? 0,
        completionPercentage:
          projectTotal > 0
            ? Math.round((projectCompleted / projectTotal) * 100)
            : 0,
      };
    }),
    assigneeWorkload: workloadRows.map((row) => ({
      id: row.id,
      name: row.name || "Unassigned",
      image: row.image,
      totalTasks: Number(row.totalTasks),
      openTasks: Number(row.openTasks),
      completedTasks: Number(row.completedTasks),
    })),
    upcomingTasks,
    recentActivity,
  };
}

export default getWorkspaceOverview;
