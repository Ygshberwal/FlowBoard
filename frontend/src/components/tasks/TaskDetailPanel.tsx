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

const STATUS_BADGE: Record<string, string> = {
  today: "bg-indigo-50 text-indigo-600",
  week: "bg-purple-50 text-purple-600",
  ongoing: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  freetime: "bg-sky-50 text-sky-600",
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
      <div className="w-64 flex-shrink-0 bg-white border-l border-slate-200 flex items-center justify-center text-slate-400 text-xs">
        Loading…
      </div>
    );
  }

  const isOverdue = task.deadline && !task.done && isPast(parseISO(task.deadline));

  return (
    <div className="w-64 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${STATUS_BADGE[task.status] || "bg-slate-50 text-slate-500"}`}>
            {task.status}
          </span>
          <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${PRIORITY_BADGE[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        <button onClick={() => selectTask(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
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
          className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none focus:bg-slate-50 rounded px-1 -mx-1 py-0.5"
        />

        {/* Category + deadline + eta */}
        <div className="flex flex-wrap gap-1.5">
          {task.category && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-slate-100 text-slate-500">{task.category}</span>
          )}
          {task.deadline && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`}>
              📅 {format(parseISO(task.deadline), "MMM d")}
              {isOverdue && " · Overdue"}
            </span>
          )}
          {task.estimated_mins && (
            <span className="text-[10px] text-slate-400">⏱ {task.estimated_mins}m</span>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Notes</label>
          <textarea
            value={localDesc}
            onChange={(e) => { setLocalDesc(e.target.value); debouncedUpdate({ description: e.target.value }); }}
            rows={3}
            placeholder="Add notes…"
            className="w-full text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
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
          <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Comments */}
        <CommentThread task={task} />
      </div>
    </div>
  );
}
