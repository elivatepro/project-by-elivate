import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceProjectAccess } from "@/fetchers/workspace-user/get-project-access";
import useReplaceProjectAccess from "@/hooks/mutations/workspace-user/use-replace-project-access";
import { toast } from "@/lib/toast";
import type { WorkspaceUser } from "@/types/workspace-user";
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

type Props = {
  workspaceId: string;
  member: WorkspaceUser | null;
  access: WorkspaceProjectAccess | undefined;
  open: boolean;
  onClose: () => void;
};

function ProjectAccessDialog({
  workspaceId,
  member,
  access,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useReplaceProjectAccess();
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (!member || !access) return;
    const assignment = access.assignments.find(
      (item) => item.userId === member.userId,
    );
    setSelectedProjectIds(assignment?.projectIds ?? []);
  }, [access, member]);

  const handleSave = async () => {
    if (!member) return;
    try {
      await mutateAsync({
        workspaceId,
        userId: member.userId,
        projectIds: selectedProjectIds,
      });
      toast.success(t("team:projectAccess.saveSuccess"));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:projectAccess.saveError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("team:projectAccess.title", {
              name: member?.user.name || member?.user.email || "",
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("team:projectAccess.description")}
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
            {access?.projects.length ? (
              access.projects.map((project) => {
                const checked = selectedProjectIds.includes(project.id);
                return (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    htmlFor={`member-project-${project.id}`}
                    key={project.id}
                  >
                    <Checkbox
                      checked={checked}
                      id={`member-project-${project.id}`}
                      onCheckedChange={(value) => {
                        setSelectedProjectIds((current) =>
                          value
                            ? [...new Set([...current, project.id])]
                            : current.filter((id) => id !== project.id),
                        );
                      }}
                    />
                    <span className="text-sm font-medium">{project.name}</span>
                  </label>
                );
              })
            ) : (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                {t("team:projectAccess.noProjects")}
              </p>
            )}
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" disabled={isPending} />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            size="sm"
            disabled={isPending || !member}
            onClick={handleSave}
          >
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export default ProjectAccessDialog;
