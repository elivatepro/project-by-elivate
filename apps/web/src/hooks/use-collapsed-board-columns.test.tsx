import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCollapsedBoardColumns } from "./use-collapsed-board-columns";

describe("useCollapsedBoardColumns", () => {
  const storageKey = "kaneo:board-collapsed-columns:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores the columns collapsed for a project", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify(["todo", "done"]));

    const { result } = renderHook(() => useCollapsedBoardColumns("project-1"));

    await waitFor(() => {
      expect(result.current.collapsedColumnIds).toEqual(["todo", "done"]);
    });
  });

  it("toggles a column and persists the layout", async () => {
    const { result } = renderHook(() => useCollapsedBoardColumns("project-1"));

    act(() => {
      result.current.toggleColumn("todo");
    });

    await waitFor(() => {
      expect(result.current.collapsedColumnIds).toEqual(["todo"]);
      expect(window.localStorage.getItem(storageKey)).toBe(
        JSON.stringify(["todo"]),
      );
    });

    act(() => {
      result.current.toggleColumn("todo");
    });

    await waitFor(() => {
      expect(result.current.collapsedColumnIds).toEqual([]);
    });
  });

  it("keeps collapsed columns isolated between projects", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify(["todo"]));
    window.localStorage.setItem(
      "kaneo:board-collapsed-columns:project-2",
      JSON.stringify(["backlog"]),
    );

    const { result, rerender } = renderHook(
      ({ projectId }) => useCollapsedBoardColumns(projectId),
      { initialProps: { projectId: "project-1" } },
    );

    await waitFor(() => {
      expect(result.current.collapsedColumnIds).toEqual(["todo"]);
    });

    rerender({ projectId: "project-2" });

    await waitFor(() => {
      expect(result.current.collapsedColumnIds).toEqual(["backlog"]);
    });
  });

  it("ignores malformed stored values", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify(["todo", 12, null]));

    const { result } = renderHook(() => useCollapsedBoardColumns("project-1"));

    await waitFor(() => {
      expect(result.current.collapsedColumnIds).toEqual(["todo"]);
    });
  });
});
