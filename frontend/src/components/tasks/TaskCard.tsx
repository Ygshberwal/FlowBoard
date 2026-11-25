import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../types/task";
import type { SectionWithTasks } from "../../types/section";
import { toast } from "../../store/toastStore";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";

interface Props {
  task: Task;
  dragEnabled?: boolean;
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
  high: "text-red-700 dark:text-red-300",
  medium: "text-amber-700 dark:text-amber-300",
  low: "text-slate-500 dark:text-slate-400",
};

export default function TaskCard({ task, dragEnabled = true, onDragStart, onDragEnd, onDragOver, onDrop, isDropTarget, isDragging }: Props) {
  const { selectedTaskId, selectTask } = useTaskStore();
  const qc = useQueryClient();
  const isSelected = selectedTaskId === task.id;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["board"] });
    qc.invalidateQueries({ queryKey: ["task-counts"] });
    qc.invalidateQueries({ queryKey: ["task", task.id] });
  };

  const toggleMutation = useMutation({
    mutationKey: ["toggle-task"],
    mutationFn: () => tasksApi.toggle(task.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["board"] });
      const previousDone = task.done;
      qc.setQueryData<SectionWithTasks[]>(["board"], (board) => board?.map((section) => ({ ...section, tasks: section.tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item) })));
      return { previousDone };
    },
    onError: (_error, _variables, context) => {
      if (context) qc.setQueryData<SectionWithTasks[]>(["board"], (board) => board?.map((section) => ({ ...section, tasks: section.tasks.map((item) => item.id === task.id ? { ...item, done: context.previousDone } : item) })));
      toast.error("Could not update the task. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      // Don't refetch over another task's in-flight optimistic completion.
      if (qc.isMutating({ mutationKey: ["toggle-task"] }) === 1) invalidate();
    },
  });

  const isOverdue = task.deadline && !task.done && isPast(parseISO(task.deadline));
  const hasMeta = task.category || task.deadline || task.estimated_mins || task.comments.length > 0;

  return (
    <div
      draggable={dragEnabled}
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
      className={`group relative flex overflow-hidden rounded-xl bg-white dark:bg-slate-900 animate-fade-in-up
        transition-all duration-200 ease-spring
        ${isSelected
          ? "shadow-card-hover ring-2 ring-indigo-400"
          : isDropTarget
          ? "shadow-card-hover ring-2 ring-emerald-400"
          : "shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 hover:shadow-card-hover"}
        ${isDragging ? "opacity-40 rotate-1 scale-95" : "opacity-100"}`}
    >
      {/* Priority accent bar */}
      <div className={`w-1 flex-shrink-0 ${task.done ? "bg-slate-200" : PRIORITY_BAR[task.priority]}`} />

      <div className="flex-1 min-w-0 px-2 py-1.5">
        <div className="flex items-start gap-1">
          {/* Checkbox */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(); }}
            aria-label={`${task.done ? "Mark incomplete" : "Complete"}: ${task.title}`}
            aria-pressed={task.done}
            disabled={toggleMutation.isPending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg disabled:opacity-50"
          >
            <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              task.done
                ? "bg-indigo-500 border-indigo-500 text-white scale-100"
                 : "border-slate-400 group-hover:border-indigo-400"
            }`}
            >
            {task.done && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            </span>
          </button>

          {/* Title */}
          <button onClick={() => selectTask(isSelected ? null : task.id)} aria-label={`Open task: ${task.title}`} aria-expanded={isSelected} className={`min-h-10 min-w-0 flex-1 rounded-lg py-2 pr-2 text-left text-sm font-medium leading-snug break-words ${
            task.done ? "line-through text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100"
          }`}>
            {task.title}
          </button>
        </div>

        {/* Meta */}
        {hasMeta && (
          <div className="flex items-center gap-2 flex-wrap mt-1 pl-12 pb-1 pr-2">
            {task.category && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 font-medium">
                {task.category}
              </span>
            )}
            {task.deadline && (
              <span className={`text-[11px] flex items-center gap-1 font-medium ${isOverdue ? "text-red-700 dark:text-red-300" : "text-slate-500 dark:text-slate-400"}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDistanceToNow(parseISO(task.deadline), { addSuffix: true })}
              </span>
            )}
            {task.estimated_mins && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {task.estimated_mins}m
              </span>
            )}
            {task.comments.length > 0 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5 font-medium">
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
