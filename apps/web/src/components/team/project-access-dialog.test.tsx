import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceProjectAccess } from "@/fetchers/workspace-user/get-project-access";
import type { WorkspaceUser } from "@/types/workspace-user";
import ProjectAccessDialog from "./project-access-dialog";

const mutateAsync = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "common:actions.save" ? "Save" : key),
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/hooks/mutations/workspace-user/use-replace-project-access", () => ({
  default: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const member = {
  userId: "user-1",
  role: "member",
  user: { name: "Member", email: "member@example.com" },
} as unknown as WorkspaceUser;

const access = {
  projects: [
    { id: "project-1", name: "Project Alpha", icon: null },
    { id: "project-2", name: "Project Beta", icon: null },
  ],
  assignments: [{ userId: "user-1", projectIds: ["project-1"] }],
} as WorkspaceProjectAccess;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProjectAccessDialog", () => {
  it("replaces the assignment set and can clear project access", async () => {
    mutateAsync.mockResolvedValue({ userId: "user-1", projectIds: [] });
    render(
      <ProjectAccessDialog
        access={access}
        member={member}
        onClose={vi.fn()}
        open
        workspaceId="workspace-1"
      />,
    );

    await waitFor(() =>
      expect(screen.getAllByRole("checkbox")[0]).toBeChecked(),
    );
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        userId: "user-1",
        projectIds: [],
      }),
    );
  });
});
