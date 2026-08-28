import { useState } from "react";
import { AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { habitsApi } from "../../api/habits";
import type { Habit, HabitCreate, HabitUpdate } from "../../types/habit";
import { toast } from "../../store/toastStore";

interface Props {
  onClose: () => void;
  habit?: Habit; // if provided → edit mode
}

const PRESET_COLORS = [
  "#1D9E75", "#6366f1", "#F97316", "#3B82F6",
  "#8B5CF6", "#22C55E", "#EF4444", "#F59E0B",
  "#EC4899", "#14B8A6", "#64748B", "#A855F7",
];

export default function AddHabitForm({ onClose, habit }: Props) {
  const isEdit = !!habit;
  const [name, setName]       = useState(habit?.name     ?? "");
  const [color, setColor]     = useState(habit?.color    ?? PRESET_COLORS[0]);
  const [category, setCategory] = useState(habit?.category ?? "");
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["habits"] });
    qc.invalidateQueries({ queryKey: ["streaks"] });
    onClose();
  };

  const showError = (error: unknown) => {
    const detail = error instanceof AxiosError
      ? error.response?.data?.detail
      : undefined;
    toast.error(detail || "Could not save habit. Please try again.");
  };

  const createMutation = useMutation({
    mutationFn: (data: HabitCreate) => habitsApi.create(data),
    onSuccess: invalidate,
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: (data: HabitUpdate) => habitsApi.update(habit!.id, data),
    onSuccess: invalidate,
    onError: showError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), color, category: category.trim() || undefined };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            {isEdit ? "Edit Habit" : "New Habit"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Habit name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800"
            required
          />

          <input
            type="text"
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800"
          />

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                    color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">Custom:</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs text-slate-400 dark:text-slate-300 font-mono">{color}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Add Habit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
