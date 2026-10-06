import { describe, expect, it } from "vitest";

import type { Task } from "@/lib/api/types";
import { canDrag, canDrop, dropId, parseDropId } from "@/components/tasks/dnd";

const pm = { user_id: "pm", is_manager: true };
const me = { user_id: "r1", is_manager: false };
const task = (over: Partial<Task> = {}) =>
  ({ task_id: "t", status: "TODO", assignee_user_id: "r1", viewer_can_update_status: true, ...over }) as Task;

describe("drop ids", () => {
  it("round-trips plain and swimlane ids", () => {
    expect(parseDropId(dropId("BLOCKED"))).toEqual({ lane: null, status: "BLOCKED" });
    expect(parseDropId(dropId("COMPLETED", "abc-123"))).toEqual({ lane: "abc-123", status: "COMPLETED" });
    expect(parseDropId("nonsense")).toBeNull();
  });
});

describe("board permissions", () => {
  it("lets PMs move anything anywhere", () => {
    expect(canDrag(task({ assignee_user_id: "x", viewer_can_update_status: false }), pm)).toBe(true);
    expect(canDrop(task(), { lane: "someone", status: "COMPLETED" }, pm)).toBe(true);
  });

  it("keeps researchers to their own open work, outside Completed", () => {
    expect(canDrop(task(), { lane: null, status: "BLOCKED" }, me)).toBe(true);
    expect(canDrop(task(), { lane: null, status: "COMPLETED" }, me)).toBe(false);
    expect(canDrop(task(), { lane: "r2", status: "IN_PROGRESS" }, me)).toBe(false);
    expect(canDrop(task({ assignee_user_id: "r2", viewer_can_update_status: false }), { lane: null, status: "TODO" }, me)).toBe(false);
    expect(canDrag(task({ status: "COMPLETED" }), me)).toBe(false);
  });
});
