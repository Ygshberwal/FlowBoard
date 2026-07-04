import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTaskStore } from "../../store/taskStore";
import { tasksApi } from "../../api/tasks";
import type { TaskStatus, TaskCounts } from "../../types/task";
import TaskList from "./TaskList";
import TaskDetailPanel from "./TaskDetailPanel";
import TaskModal from "./TaskModal";

const VIEWS: { key: TaskStatus; label: string; countKey: keyof TaskCounts }[] = [
  { key: "today",    label: "Today",         countKey: "today" },
  { key: "week",     label: "This week",     countKey: "week" },
  { key: "ongoing",  label: "Ongoing",       countKey: "ongoing" },
  { key: "pending",  label: "Pending",       countKey: "pending" },
  { key: "freetime", label: "Free time",     countKey: "freetime" },
];

export default function TaskModule() {
  const { currentView, selectedTaskId, setView } = useTaskStore();
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data: counts } = useQuery<TaskCounts>({
    queryKey: ["task-counts"],
    queryFn: tasksApi.counts,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Horizontal view tabs bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 flex items-center gap-1 h-9">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              currentView === v.key
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {v.label}
            {counts && counts[v.countKey] > 0 && (
              <span
                className={`text-[10px] font-bold px-1 rounded-full leading-4 min-w-[16px] text-center ${
                  currentView === v.key
                    ? "bg-indigo-200 text-indigo-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[v.countKey]}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New task
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 overflow-hidden">
          <TaskList view={currentView} />
        </div>
        {selectedTaskId && (
          <TaskDetailPanel taskId={selectedTaskId} />
        )}
      </div>

      {showModal && (
        <TaskModal
          onClose={() => setShowModal(false)}
          defaultStatus={currentView}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["task-counts"] });
          }}
        />
      )}
    </div>
  );
}
