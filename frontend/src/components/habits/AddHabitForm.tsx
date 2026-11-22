import { useId, useState } from "react";
import { AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { habitsApi } from "../../api/habits";
import type { Habit, HabitCreate, HabitUpdate } from "../../types/habit";
import Dialog from "../ui/Dialog";

interface Props {
  onClose: () => void;
  habit?: Habit;
  onDelete?: () => void;
  position?: number;
  habitCount?: number;
  onMove?: (position: number) => void;
}

const PRESET_COLORS = [
  { value: "#1D9E75", label: "Green" }, { value: "#6366f1", label: "Indigo" },
  { value: "#F97316", label: "Orange" }, { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Violet" }, { value: "#EC4899", label: "Pink" },
];

export default function AddHabitForm({ onClose, habit, onDelete, position, habitCount = 0, onMove }: Props) {
  const isEdit = Boolean(habit);
  const id = useId();
  const [name, setName] = useState(habit?.name ?? "");
  const [color, setColor] = useState(habit?.color ?? PRESET_COLORS[0].value);
  const [category, setCategory] = useState(habit?.category ?? "");
  const [positionDraft, setPositionDraft] = useState(position ?? 0);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const invalidate = () => {
    if (isEdit && positionDraft !== position) onMove?.(positionDraft);
    qc.invalidateQueries({ queryKey: ["habits"] });
    qc.invalidateQueries({ queryKey: ["streaks"] });
    qc.invalidateQueries({ queryKey: ["habit-analytics"] });
    onClose();
  };
  const showError = (error: unknown) => {
    const detail = error instanceof AxiosError ? error.response?.data?.detail : undefined;
    setError(typeof detail === "string" ? detail : "Could not save your habit. Your draft is safe here; please try again.");
  };
  const createMutation = useMutation({ mutationFn: (data: HabitCreate) => habitsApi.create(data), onSuccess: invalidate, onError: showError });
  const updateMutation = useMutation({ mutationFn: (data: HabitUpdate) => habitsApi.update(habit!.id, data), onSuccess: invalidate, onError: showError });
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog labelledBy={`${id}-title`} describedBy={`${id}-description`} onDismiss={onClose} busy={isPending}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div><h2 id={`${id}-title`} className="text-lg font-bold">{isEdit ? "Edit habit" : "Build a new habit"}</h2><p id={`${id}-description`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">{isEdit ? "Make this habit work for you." : "Keep it simple and easy to repeat."}</p></div>
        <button aria-label="Close habit form" onClick={onClose} disabled={isPending} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">×</button>
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || isPending) return;
        setError("");
        const payload = { name: name.trim(), color, category: category.trim() };
        if (isEdit) updateMutation.mutate(payload);
        else createMutation.mutate(payload);
      }} className="space-y-5 p-6">
        <div>
          <label htmlFor={`${id}-name`} className="mb-2 block text-sm font-semibold">Habit name</label>
          <input id={`${id}-name`} autoFocus data-autofocus className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="e.g. Read for 10 minutes" required aria-describedby={`${id}-hint`} />
          <p id={`${id}-hint`} className="mt-2 text-xs text-slate-500 dark:text-slate-400">A specific, achievable action is a great place to start.</p>
        </div>
        <details open={isEdit || undefined} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Customize habit <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(optional)</span></summary>
          <div className="mt-4 space-y-4">
            <div><label htmlFor={`${id}-category`} className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label><input id={`${id}-category`} className="field" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={50} placeholder="e.g. Health or Learning" /></div>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Color</legend>
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((preset) => <button key={preset.value} type="button" aria-label={`${preset.label} color`} aria-pressed={color.toLowerCase() === preset.value.toLowerCase()} onClick={() => setColor(preset.value)} className="flex h-11 w-11 items-center justify-center rounded-lg"><span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: preset.value }}>{color.toLowerCase() === preset.value.toLowerCase() && <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}</span></button>)}
              </div>
              <div className="mt-2 flex items-center gap-3"><label htmlFor={`${id}-color`} className="text-xs text-slate-600 dark:text-slate-400">Custom color</label><input id={`${id}-color`} type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-11 w-11 cursor-pointer rounded border-0 bg-transparent" /></div>
            </fieldset>
            {isEdit && habitCount > 1 && <div><label htmlFor={`${id}-position`} className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Position in your list</label><select id={`${id}-position`} value={positionDraft} onChange={(event) => setPositionDraft(Number(event.target.value))} className="field">{Array.from({ length: habitCount }, (_, index) => <option key={index} value={index}>Position {index + 1}</option>)}</select></div>}
          </div>
        </details>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="flex gap-2"><button type="button" onClick={onClose} disabled={isPending} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={!name.trim() || isPending} className="btn-primary flex-1">{isPending ? "Saving…" : isEdit ? "Save changes" : "Create habit"}</button></div>
        {onDelete && <button type="button" onClick={onDelete} disabled={isPending} className="min-h-11 w-full rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">Delete habit…</button>}
      </form>
    </Dialog>
  );
}
