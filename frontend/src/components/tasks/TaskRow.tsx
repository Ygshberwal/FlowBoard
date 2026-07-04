import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../types/task";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";

interface Props {
  task: Task;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-slate-400",
};

export default function TaskRow({ task }: Props) {
  const { selectedTaskId, selectTask, currentView } = useTaskStore();
  const qc = useQueryClient();
  const isSelected = selectedTaskId === task.id;

  const toggleMutation = useMutation({
    mutationFn: () => tasksApi.toggle(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", currentView] });
      qc.invalidateQueries({ queryKey: ["task-counts"] });
      if (isSelected) selectTask(null);
    },
  });

  const isOverdue = task.deadline && !task.done && isPast(parseISO(task.deadline));

  return (
    <div
      onClick={() => selectTask(isSelected ? null : task.id)}
      className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors group ${
        isSelected
          ? "bg-indigo-50 border-l-2 border-indigo-500"
          : "hover:bg-slate-50 border-l-2 border-transparent"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(); }}
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          task.done
            ? "bg-indigo-500 border-indigo-500 text-white"
            : "border-slate-300 hover:border-indigo-400"
        }`}
      >
        {task.done && (
          <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Priority dot */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />

      {/* Title */}
      <span className={`flex-1 text-xs font-medium truncate ${
        task.done ? "line-through text-slate-400" : "text-slate-700"
      }`}>
        {task.title}
      </span>

      {/* Meta row — right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.category && (
          <span className="text-[10px] px-1.5 py-0 rounded bg-slate-100 text-slate-400 font-medium">
            {task.category}
          </span>
        )}
        {task.deadline && (
          <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-400 font-semibold" : "text-slate-400"}`}>
            {isOverdue ? "⚠" : "📅"}
            {formatDistanceToNow(parseISO(task.deadline), { addSuffix: true })}
          </span>
        )}
        {task.estimated_mins && (
          <span className="text-[10px] text-slate-400">
            {task.estimated_mins}m
          </span>
        )}
        {task.comments.length > 0 && (
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {task.comments.length}
          </span>
        )}
      </div>
    </div>
  );
}
