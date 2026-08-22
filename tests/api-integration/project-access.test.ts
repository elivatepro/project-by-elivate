import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function createRestrictedMember(workspaceId: string, role = "member") {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: "Restricted Member",
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: id,
    role,
    joinedAt: new Date(),
  });

  return user;
}

describe("API integration: project-level member visibility", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("starts restricted members with no projects and assigns only selected projects", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project: visibleProject } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Visible project",
    });
    const { project: hiddenProject } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Hidden project",
    });
    const restricted = await createRestrictedMember(owner.workspace.id);
    const { project: foreignProject } = await createProjectFixture({
      workspaceId: (await createWorkspaceMember()).workspace.id,
    });
    const { app } = createApp();

    mockAuthenticatedSession(restricted);
    const initiallyEmpty = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(initiallyEmpty.status).toBe(200);
    expect(await initiallyEmpty.json()).toEqual([]);

    mockAuthenticatedSession(owner.user);
    const assign = await app.request(
      `/api/workspace/${owner.workspace.id}/members/${restricted.id}/project-access`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: [visibleProject.id] }),
      },
    );
    expect(assign.status).toBe(200);

    const crossWorkspace = await app.request(
      `/api/workspace/${owner.workspace.id}/members/${restricted.id}/project-access`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: [foreignProject.id] }),
      },
    );
    expect(crossWorkspace.status).toBe(400);

    mockAuthenticatedSession(restricted);
    const visibleProjects = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(
      (await visibleProjects.json()).map(
        (project: { id: string }) => project.id,
      ),
    ).toEqual([visibleProject.id]);

    const hiddenDirectUrl = await app.request(
      `/api/project/${hiddenProject.id}`,
    );
    expect(hiddenDirectUrl.status).toBe(403);

    mockAuthenticatedSession(owner.user);
    const ownerProjects = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(
      (await ownerProjects.json()).map((project: { id: string }) => project.id),
    ).toEqual([visibleProject.id, hiddenProject.id]);
  });

  it("preserves assignments across role promotion and demotion while hiding new projects", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project: assignedProject } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const restricted = await createRestrictedMember(owner.workspace.id);
    await db.insert(schema.projectMemberTable).values({
      projectId: assignedProject.id,
      userId: restricted.id,
    });

    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, restricted.id),
        ),
      );

    const { project: newProject } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Created later",
    });
    const { app } = createApp();
    mockAuthenticatedSession(restricted);
    const adminProjects = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(
      (await adminProjects.json()).map((project: { id: string }) => project.id),
    ).toEqual([assignedProject.id, newProject.id]);

    await db
      .update(schema.workspaceUserTable)
      .set({ role: "member" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, restricted.id),
        ),
      );

    const demotedProjects = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(
      (await demotedProjects.json()).map(
        (project: { id: string }) => project.id,
      ),
    ).toEqual([assignedProject.id]);
  });
});
