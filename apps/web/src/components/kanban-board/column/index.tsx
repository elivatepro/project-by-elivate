import { useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

type ColumnProps = {
  column: ProjectWithTasks["columns"][number];
  disableDragDrop?: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
};

function Column({
  column,
  disableDragDrop = false,
  isCollapsed,
  onToggleCollapsed,
}: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);

  return (
    <div
      className={`group relative flex h-full min-h-0 w-full flex-col rounded-xl border transition-colors duration-150 ${
        isDropzoneOver
          ? "border-ring/40 bg-accent/60 shadow-md ring-2 ring-ring/30"
          : "border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90"
      }`}
    >
      {isCollapsed ? (
        <>
          <div className="absolute inset-0">
            <ColumnDropzone
              column={column}
              disableDragDrop={disableDragDrop}
              isCollapsed
              onIsOverChange={setIsDropzoneOver}
            />
          </div>
          <ColumnHeader
            column={column}
            isCollapsed
            onToggleCollapsed={onToggleCollapsed}
          />
        </>
      ) : (
        <>
          <div className="shrink-0 border-b border-border/60 px-3 py-2">
            <ColumnHeader
              column={column}
              isCollapsed={false}
              onToggleCollapsed={onToggleCollapsed}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-1 [-webkit-overflow-scrolling:touch]">
            <ColumnDropzone
              column={column}
              disableDragDrop={disableDragDrop}
              onIsOverChange={setIsDropzoneOver}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default Column;
