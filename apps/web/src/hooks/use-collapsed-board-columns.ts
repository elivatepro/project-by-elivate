import { useCallback, useEffect, useState } from "react";

type CollapsedColumnsState = {
  projectId: string | undefined;
  columnIds: string[];
};

function getStorageKey(projectId: string) {
  return `kaneo:board-collapsed-columns:${projectId}`;
}

function readCollapsedColumnIds(projectId: string | undefined): string[] {
  if (!projectId || typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(getStorageKey(projectId));
    if (!stored) return [];

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];

    return [
      ...new Set(
        parsed.filter((value): value is string => typeof value === "string"),
      ),
    ];
  } catch {
    return [];
  }
}

export function useCollapsedBoardColumns(projectId: string | undefined) {
  const [state, setState] = useState<CollapsedColumnsState>(() => ({
    projectId,
    columnIds: readCollapsedColumnIds(projectId),
  }));

  useEffect(() => {
    setState({
      projectId,
      columnIds: readCollapsedColumnIds(projectId),
    });
  }, [projectId]);

  useEffect(() => {
    if (
      !projectId ||
      state.projectId !== projectId ||
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      window.localStorage.setItem(
        getStorageKey(projectId),
        JSON.stringify(state.columnIds),
      );
    } catch {
      // Layout persistence is best-effort; private mode or quota can block it.
    }
  }, [projectId, state]);

  const toggleColumn = useCallback(
    (columnId: string) => {
      setState((current) => {
        const columnIds =
          current.projectId === projectId
            ? current.columnIds
            : readCollapsedColumnIds(projectId);
        const isCollapsed = columnIds.includes(columnId);

        return {
          projectId,
          columnIds: isCollapsed
            ? columnIds.filter((id) => id !== columnId)
            : [...columnIds, columnId],
        };
      });
    },
    [projectId],
  );

  return {
    collapsedColumnIds: state.projectId === projectId ? state.columnIds : [],
    toggleColumn,
  };
}
