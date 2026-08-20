import { produce } from "immer";
import { Archive, Maximize2, Minimize2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { ArchiveTasksModal } from "../../shared/modals/archive-tasks-modal";

type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
};

export function ColumnHeader({
  column,
  isCollapsed,
  onToggleCollapsed,
}: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  const canTask = canUpdateTasks();
  const canCreate = canCreateTasks();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleConfirmArchive = () => {
    if (!column.isFinal || !project) return;

    const updatedProject = produce(project, (draft) => {
      const archivedColumn = draft?.columns?.find(
        (col) => col.id === column.id,
      );
      if (!archivedColumn) return;

      for (const task of archivedColumn.tasks) {
        updateTask({
          ...task,
          status: "archived",
        });
      }

      archivedColumn.tasks = [];
    });

    setProject(updatedProject);
    toast.success(t("tasks:archive.success", { count: column.tasks.length }));
    setIsArchiveModalOpen(false);
  };

  const collapseLabel = t(
    isCollapsed ? "tasks:kanban.expandColumn" : "tasks:kanban.collapseColumn",
    { column: column.name },
  );

  if (isCollapsed) {
    return (
      <div className="relative z-10 flex h-full flex-col items-center gap-3 px-1 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-[color,background-color,box-shadow] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          title={collapseLabel}
          aria-label={collapseLabel}
          aria-expanded={false}
        >
          <Maximize2 className="size-4" />
        </button>

        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
          {column.tasks.length}
        </span>
        <span className="min-h-0 flex-1 rotate-180 truncate pt-1 font-medium text-foreground/80 text-sm [writing-mode:vertical-rl]">
          {column.name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-[color,background-color,box-shadow] hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          title={collapseLabel}
          aria-label={collapseLabel}
          aria-expanded={true}
        >
          <Minimize2 className="size-4" />
        </button>
        {canTask && column.isFinal && column.tasks.length > 0 && (
          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50"
            title={t("tasks:listView.archiveAllTooltip")}
          >
            <Archive className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50"
            title={t("tasks:kanban.addTask")}
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={project?.id}
        status={column.id}
      />

      <ArchiveTasksModal
        open={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        taskCount={column.tasks.length}
      />
    </div>
  );
}
