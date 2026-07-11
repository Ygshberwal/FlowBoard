import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import type { TaskStatus, TaskPriority, TaskCreate } from "../../types/task";

interface Props {
  onClose: () => void;
  defaultStatus: TaskStatus;
  onCreated: () => void;
}

export default function TaskModal({ onClose, defaultStatus, onCreated }: Props) {
  const [form, setForm] = useState<TaskCreate>({
    title: "",
    status: defaultStatus,
    priority: "medium",
    description: "",
    category: "",
    estimated_mins: undefined,
    deadline: "",
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: (err: unknown) => {
      console.error("Create task failed:", err);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload: TaskCreate = {
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
    };
    if (form.description) payload.description = form.description;
    if (form.category) payload.category = form.category;
    if (form.estimated_mins !== undefined) payload.estimated_mins = form.estimated_mins;
    if (form.deadline) {
      const d = new Date(form.deadline);
      if (!isNaN(d.getTime())) payload.deadline = d.toISOString();
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">New Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <input
              autoFocus
              type="text"
              placeholder="Task title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-800 placeholder-slate-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
              >
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="ongoing">Ongoing</option>
                <option value="pending">Pending</option>
                <option value="freetime">Free time</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <input
              type="text"
              placeholder="Category (e.g. Work, Health)"
              value={form.category || ""}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Deadline <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.deadline || ""}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Est. minutes</label>
              <input
                type="number"
                placeholder="60"
                min={1}
                value={form.estimated_mins || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estimated_mins: e.target.value ? Number(e.target.value) : undefined }))
                }
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <textarea
              placeholder="Description (optional)"
              value={form.description || ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 placeholder-slate-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || createMutation.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? "Creating…" : createMutation.isError ? "Retry" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
