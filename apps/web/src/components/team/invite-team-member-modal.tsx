import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import InvitationLinkField from "./invitation-link-field";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string(),
  projectIds: z.array(z.string()),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { mutateAsync } = useInviteWorkspaceUser();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { data: projects = [] } = useGetProjects({
    workspaceId: workspaceId ?? "",
  });
  const { canInviteUsers, isAdmin } = useWorkspacePermission();
  const canInvite = canInviteUsers();
  const canManageProjectAccess = isAdmin;
  const [createdInvitation, setCreatedInvitation] = useState<{
    id: string;
    email: string;
  } | null>(null);

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
      projectIds: [],
    },
  });

  const onSubmit = async ({ email, projectIds }: TeamMemberFormValues) => {
    if (!workspaceId) {
      toast.error(t("team:inviteModal.error"));
      return;
    }
    if (!canInvite) {
      // Defense-in-depth: parent gates the trigger, but if the modal is
      // somehow open without permission we refuse rather than firing a
      // mutation the server will reject.
      toast.error(t("team:inviteModal.error"));
      return;
    }
    try {
      const invitation = await mutateAsync({
        email,
        workspaceId,
        role: "member",
        projectIds,
      }); // TODO: role and email
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success(t("team:inviteModal.success"));

      // The link is the only delivery channel when SMTP is unconfigured, so the
      // modal stays open on it instead of closing. If the API ever stops
      // returning an id, fall back to the previous close-on-success behaviour.
      if (invitation?.id) {
        setCreatedInvitation({ id: invitation.id, email });
        form.reset();
        return;
      }

      resetInviteTeamMember();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team:inviteModal.error"),
      );
    }
  };

  const resetInviteTeamMember = async () => {
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
    }
    form.reset();
  };

  const resetAndCloseModal = () => {
    setCreatedInvitation(null);
    resetInviteTeamMember();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdInvitation
              ? t("team:inviteModal.createdTitle")
              : t("team:inviteModal.title")}
          </DialogTitle>
        </DialogHeader>

        {createdInvitation ? (
          <>
            <DialogPanel className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("team:inviteModal.shareLinkDescription", {
                  email: createdInvitation.email,
                })}
              </p>
              <InvitationLinkField invitationId={createdInvitation.id} />
            </DialogPanel>
            <DialogFooter>
              <Button size="sm" onClick={resetAndCloseModal}>
                {t("team:inviteModal.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <DialogPanel>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("team:inviteModal.emailLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("team:inviteModal.emailPlaceholder")}
                          autoFocus
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {canManageProjectAccess ? (
                  <FormField
                    control={form.control}
                    name="projectIds"
                    render={({ field }) => (
                      <FormItem className="mt-5">
                        <FormLabel>
                          {t("team:inviteModal.projectsLabel")}
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("team:inviteModal.projectsDescription")}
                        </p>
                        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
                          {projects.length === 0 ? (
                            <p className="px-2 py-2 text-sm text-muted-foreground">
                              {t("team:inviteModal.noProjects")}
                            </p>
                          ) : (
                            projects.map((project) => {
                              const checked = field.value.includes(project.id);
                              return (
                                <label
                                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                                  htmlFor={`invite-project-${project.id}`}
                                  key={project.id}
                                >
                                  <Checkbox
                                    checked={checked}
                                    id={`invite-project-${project.id}`}
                                    onCheckedChange={(value) => {
                                      const next = value
                                        ? [...field.value, project.id]
                                        : field.value.filter(
                                            (id) => id !== project.id,
                                          );
                                      field.onChange([...new Set(next)]);
                                    }}
                                  />
                                  <span className="text-sm font-medium">
                                    {project.name}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="mt-5 text-xs text-muted-foreground">
                    {t("team:inviteModal.projectsAdminOnly")}
                  </p>
                )}
              </DialogPanel>

              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" size="sm" type="button" />}
                >
                  {t("common:actions.cancel")}
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!workspaceId || !canInvite}
                >
                  {t("team:inviteModal.sendInvitation")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogPopup>
    </Dialog>
  );
}

export default InviteTeamMemberModal;
