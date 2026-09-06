import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../types/task";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";

interface Props {
  task: Task;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDragOver?: () => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  isDropTarget?: boolean;
  isDragging: boolean;
}

const PRIORITY_BAR: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

const PRIORITY_TEXT: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-slate-400",
};

export default function TaskCard({ task, onDragStart, onDragEnd, onDragOver, onDrop, isDropTarget, isDragging }: Props) {
  const { selectedTaskId, selectTask } = useTaskStore();
  const qc = useQueryClient();
  const isSelected = selectedTaskId === task.id;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["board"] });
    qc.invalidateQueries({ queryKey: ["task-counts"] });
  };

  const toggleMutation = useMutation({
    mutationFn: () => tasksApi.toggle(task.id),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      if (isSelected) selectTask(null);
      invalidate();
    },
  });

  const isOverdue = task.deadline && !task.done && isPast(parseISO(task.deadline));
  const hasMeta = task.category || task.deadline || task.estimated_mins || task.comments.length > 0;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onDragEnter={(e) => {
        if (!onDragOver) return;
        e.preventDefault();
        e.stopPropagation();
        onDragOver();
      }}
      onDragOver={(e) => {
        if (!onDragOver) return;
        e.preventDefault();
        e.stopPropagation();
        onDragOver();
      }}
      onDrop={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(e);
      }}
      onClick={() => selectTask(isSelected ? null : task.id)}
      className={`group relative flex overflow-hidden rounded-xl bg-white dark:bg-slate-900 cursor-pointer animate-fade-in-up
        transition-all duration-200 ease-spring
        ${isSelected
          ? "shadow-card-hover ring-2 ring-indigo-400"
          : isDropTarget
          ? "shadow-card-hover ring-2 ring-emerald-400"
          : "shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 hover:shadow-card-hover hover:-translate-y-0.5"}
        ${isDragging ? "opacity-40 rotate-1 scale-95" : "opacity-100"}`}
    >
      {/* Priority accent bar */}
      <div className={`w-1 flex-shrink-0 ${task.done ? "bg-slate-200" : PRIORITY_BAR[task.priority]}`} />

      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          {/* Checkbox */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(); }}
            className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
              task.done
                ? "bg-indigo-500 border-indigo-500 text-white scale-100"
                : "border-slate-300 hover:border-indigo-400 hover:scale-110"
            }`}
          >
            {task.done && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Title */}
          <span className={`flex-1 text-[13px] font-medium leading-snug break-words ${
            task.done ? "line-through text-slate-400 dark:text-slate-600" : "text-slate-800 dark:text-slate-100"
          }`}>
            {task.title}
          </span>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
            title="Delete task"
            className="opacity-0 group-hover:opacity-100 -mr-0.5 text-slate-300 hover:text-red-500 transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Meta */}
        {hasMeta && (
          <div className="flex items-center gap-2 flex-wrap mt-2 pl-[28px]">
            {task.category && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 font-medium">
                {task.category}
              </span>
            )}
            {task.deadline && (
              <span className={`text-[11px] flex items-center gap-1 font-medium ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDistanceToNow(parseISO(task.deadline), { addSuffix: true })}
              </span>
            )}
            {task.estimated_mins && (
              <span className="text-[11px] text-slate-400 flex items-center gap-0.5 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {task.estimated_mins}m
              </span>
            )}
            {task.comments.length > 0 && (
              <span className="text-[11px] text-slate-400 flex items-center gap-0.5 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {task.comments.length}
              </span>
            )}
            <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_TEXT[task.priority]}`}>
              {task.priority}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
