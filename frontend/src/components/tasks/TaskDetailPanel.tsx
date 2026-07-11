import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import type { Task, TaskUpdate } from "../../types/task";
import { format, isPast, parseISO } from "date-fns";
import CommentThread from "./CommentThread";

interface Props { taskId: string; }

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-500 border border-red-200",
  medium: "bg-amber-50 text-amber-500 border border-amber-200",
  low: "bg-slate-50 text-slate-400 border border-slate-200",
};

export default function TaskDetailPanel({ taskId }: Props) {
  const selectTask = useTaskStore((s) => s.selectTask);
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: ["task", taskId],
    queryFn: () => tasksApi.get(taskId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TaskUpdate) => tasksApi.update(taskId, data),
    onSuccess: (updated) => {
      qc.setQueryData(["task", taskId], updated);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
    onSuccess: () => {
      selectTask(null);
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-counts"] });
    },
  });

  const [localTitle, setLocalTitle] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (task) { setLocalTitle(task.title); setLocalDesc(task.description || ""); }
  }, [task?.id]);

  const debouncedUpdate = useCallback((data: TaskUpdate) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateMutation.mutate(data), 500);
  }, [updateMutation]);

  if (isLoading || !task) {
    return (
      <div className="w-72 flex-shrink-0 glass border-l border-white/60 flex items-center justify-center text-slate-400 text-xs animate-slide-in-right">
        Loading…
      </div>
    );
  }

  const isOverdue = task.deadline && !task.done && isPast(parseISO(task.deadline));

  return (
    <div className="w-72 flex-shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-l border-white/60 dark:border-white/10 shadow-column flex flex-col h-full overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${PRIORITY_BADGE[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        <button onClick={() => selectTask(null)} className="text-slate-300 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Title */}
        <input
          type="text"
          value={localTitle}
          onChange={(e) => { setLocalTitle(e.target.value); debouncedUpdate({ title: e.target.value }); }}
          className="w-full text-xs font-semibold text-slate-800 dark:text-slate-100 bg-transparent outline-none focus:bg-slate-50 dark:focus:bg-white/5 rounded px-1 -mx-1 py-0.5"
        />

        {/* Editable priority + deadline + category */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14">Priority</label>
            <select
              value={task.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value as Task["priority"] })}
              className="flex-1 text-[11px] border border-slate-200 dark:border-white/10 dark:bg-slate-800 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-300 text-slate-700 dark:text-slate-200"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14">Category</label>
            <input
              type="text"
              defaultValue={task.category || ""}
              onBlur={(e) => {
                if (e.target.value !== (task.category || "")) updateMutation.mutate({ category: e.target.value });
              }}
              placeholder="—"
              className="flex-1 text-[11px] border border-slate-200 dark:border-white/10 dark:bg-slate-800 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-300 text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14">Deadline</label>
            <input
              type="datetime-local"
              defaultValue={task.deadline ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) => {
                const v = e.target.value;
                updateMutation.mutate({ deadline: v ? new Date(v).toISOString() : undefined });
              }}
              className={`flex-1 text-[11px] border rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-300 text-slate-700 dark:text-slate-200 dark:bg-slate-800 ${isOverdue ? "border-red-300 text-red-500" : "border-slate-200 dark:border-white/10"}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14">Est. minutes</label>
            <input
              type="number"
              min={1}
              defaultValue={task.estimated_mins ?? ""}
              placeholder="60"
              onBlur={(e) => {
                const value = e.target.value;
                updateMutation.mutate({ estimated_mins: value ? Number(value) : undefined });
              }}
              className="flex-1 text-[11px] border border-slate-200 dark:border-white/10 dark:bg-slate-800 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-300 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Notes</label>
          <textarea
            value={localDesc}
            onChange={(e) => { setLocalDesc(e.target.value); debouncedUpdate({ description: e.target.value }); }}
            rows={3}
            placeholder="Add notes…"
            className="w-full text-xs text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
          />
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Progress</label>
            <span className="text-[10px] text-slate-500 font-semibold">{progress}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-indigo-600 h-1"
          />
          <div className="mt-1 h-1 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Comments */}
        <CommentThread task={task} />
      </div>

      {/* Footer — delete */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-100 dark:border-white/10">
        <button
          onClick={() => {
            if (window.confirm("Delete this task? This cannot be undone.")) deleteMutation.mutate();
          }}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md py-1.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete task
        </button>
      </div>
    </div>
  );
}
