import { useState, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import type { Task, TaskStatus } from "../../types/task";
import TaskRow from "./TaskRow";

interface Props {
  view: TaskStatus;
}

const VIEW_LABELS: Record<TaskStatus, string> = {
  today: "Today",
  week: "This week",
  ongoing: "Ongoing",
  pending: "Pending",
  freetime: "Free time",
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function TaskList({ view }: Props) {
  const [quickTitle, setQuickTitle] = useState("");
  const [filterPriority, setFilterPriority] = useState<"all" | "high">("all");
  const [sortBy, setSortBy] = useState<"created" | "deadline" | "priority">("created");
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", view],
    queryFn: () => tasksApi.list(view),
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", view] });
      qc.invalidateQueries({ queryKey: ["task-counts"] });
      setQuickTitle("");
    },
  });

  const handleQuickAdd = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && quickTitle.trim()) {
      createMutation.mutate({ title: quickTitle.trim(), status: view });
    }
  };

  const activeTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  let filtered = filterPriority === "high"
    ? activeTasks.filter((t) => t.priority === "high")
    : activeTasks;

  if (sortBy === "deadline") {
    filtered = [...filtered].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  } else if (sortBy === "priority") {
    filtered = [...filtered].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-700 mr-1">{VIEW_LABELS[view]}</span>
        <div className="w-px h-3 bg-slate-200" />
        <button
          onClick={() => setFilterPriority("all")}
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
            filterPriority === "all"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterPriority("high")}
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
            filterPriority === "high"
              ? "bg-red-500 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          High
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="ml-auto text-[11px] bg-slate-100 text-slate-500 border-0 rounded-md px-2 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          <option value="created">Created</option>
          <option value="deadline">Deadline</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      {/* Quick add */}
      <div className="px-4 py-1.5 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-1.5">
          <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="Add a task… press Enter"
            className="flex-1 bg-transparent text-xs text-slate-600 placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20 text-slate-400 text-xs">Loading…</div>
        ) : filtered.length === 0 && doneTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300">
            <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-xs">No tasks here</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
        {doneTasks.length > 0 && <CompletedSection tasks={doneTasks} />}
      </div>
    </div>
  );
}

function CompletedSection({ tasks }: { tasks: Task[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-t border-slate-100">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-slate-400 hover:text-slate-600 font-medium"
      >
        <svg className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 6 10">
          <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Completed · {tasks.length}
      </button>
      {expanded && (
        <div className="divide-y divide-slate-50 opacity-50">
          {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
        </div>
      )}
    </div>
  );
}
