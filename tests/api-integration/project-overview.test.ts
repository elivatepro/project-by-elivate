import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: workspace overview", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns workspace-wide metrics without leaking another workspace", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const otherMember = await createWorkspaceMember();
    const otherProject = await createProjectFixture({
      workspaceId: otherMember.workspace.id,
    });
    const now = new Date();

    await db.insert(schema.taskTable).values([
      {
        projectId: project.id,
        title: "Open task",
        status: columns.todo.slug,
        columnId: columns.todo.id,
        userId: member.user.id,
        priority: "high",
        dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Overdue task",
        status: columns.inProgress.slug,
        columnId: columns.inProgress.id,
        userId: member.user.id,
        dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Completed task",
        status: columns.done.slug,
        columnId: columns.done.id,
        userId: member.user.id,
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Planned task",
        status: "planned",
        userId: null,
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: otherProject.id,
        title: "Other workspace task",
        status: "to-do",
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/project/overview?workspaceId=${member.workspace.id}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.summary).toMatchObject({
      projectCount: 1,
      totalTasks: 4,
      completedTasks: 1,
      overdueTasks: 1,
      dueSoonTasks: 1,
      completionPercentage: 25,
    });
    expect(payload.statusBreakdown).toEqual([
      { key: "completed", count: 1 },
      { key: "inProgress", count: 2 },
      { key: "planned", count: 1 },
    ]);
    expect(payload.projectProgress[0]).toMatchObject({
      id: project.id,
      totalTasks: 4,
      completedTasks: 1,
      overdueTasks: 1,
      completionPercentage: 25,
    });
    expect(
      payload.upcomingTasks.map((task: { title: string }) => task.title),
    ).toEqual(["Overdue task", "Open task"]);
    expect(payload.assigneeWorkload).toEqual([
      expect.objectContaining({
        id: member.user.id,
        totalTasks: 3,
        openTasks: 2,
        completedTasks: 1,
      }),
      expect.objectContaining({
        id: null,
        name: "Unassigned",
        totalTasks: 1,
        openTasks: 1,
        completedTasks: 0,
      }),
    ]);
  });
});
