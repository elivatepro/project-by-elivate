import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InviteTeamMemberModal from "./invite-team-member-modal";

const mutateAsync = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/hooks/mutations/workspace-user/use-invite-workspace-user", () => ({
  default: () => ({ mutateAsync }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "project-1", name: "Project Alpha" },
      { id: "project-2", name: "Project Beta" },
    ],
  }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canInviteUsers: () => true,
    isAdmin: true,
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderModal() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <InviteTeamMemberModal open onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InviteTeamMemberModal project access", () => {
  it("submits the selected project ids with the invitation", async () => {
    mutateAsync.mockResolvedValue({ id: "invite-1" });
    renderModal();

    fireEvent.change(
      screen.getByPlaceholderText("team:inviteModal.emailPlaceholder"),
      { target: { value: "member@example.com" } },
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Project Alpha" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "team:inviteModal.sendInvitation",
      }),
    );

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        email: "member@example.com",
        workspaceId: "workspace-1",
        role: "member",
        projectIds: ["project-1"],
      }),
    );
  });
});
