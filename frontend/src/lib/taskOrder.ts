import type { Task } from "../types/task";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function orderTasks(tasks: Task[]): Task[] {
  const hasManualOrder = tasks.some((task) => task.sort_order !== null);

  return [...tasks].sort((a, b) => {
    if (hasManualOrder) {
      return (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)
        || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        || a.created_at.localeCompare(b.created_at)
        || a.id.localeCompare(b.id);
    }

    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      || a.created_at.localeCompare(b.created_at)
      || a.id.localeCompare(b.id);
  });
}
