import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { sectionsApi } from "../../api/sections";
import { useTaskStore } from "../../store/taskStore";
import { toast } from "../../store/toastStore";
import type { Task, TaskUpdate } from "../../types/task";
import { format, parseISO } from "date-fns";
import CommentThread from "./CommentThread";
import Dialog from "../ui/Dialog";
import ConfirmDialog from "../ui/ConfirmDialog";
import ContentState from "../ui/ContentState";

interface Props { taskId: string; }

export default function TaskDetailPanel({ taskId }: Props) {
  const selectTask = useTaskStore((s) => s.selectTask);
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const { data: task, isLoading, isError, refetch } = useQuery<Task>({
    queryKey: ["task", taskId],
    queryFn: () => tasksApi.get(taskId),
  });
  const { data: sections = [] } = useQuery({ queryKey: ["board"], queryFn: sectionsApi.board });

  useEffect(() => {
    if (task) { setLocalTitle(task.title); setLocalDesc(task.description || ""); }
  }, [task?.id]);

  const updateMutation = useMutation({
    mutationFn: (data: TaskUpdate) => tasksApi.update(taskId, data),
    onSuccess: (updated) => {
      qc.setQueryData(["task", taskId], updated);
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-counts"] });
    },
    onError: () => toast.error("Could not save your change. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
    onSuccess: () => {
      selectTask(null);
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-counts"] });
    },
    onError: () => toast.error("Could not delete the task. Please try again."),
  });

  const closePanel = async () => {
    const changes: TaskUpdate = {};
    if (task && localTitle.trim() && localTitle.trim() !== task.title) changes.title = localTitle.trim();
    if (task && localDesc !== (task.description ?? "")) changes.description = localDesc;
    try {
      if (Object.keys(changes).length) await updateMutation.mutateAsync(changes);
      selectTask(null);
    } catch {
      // Keep unsaved text visible so it can be retried.
    }
  };

  return (
    <Dialog panel labelledBy="task-detail-title" onDismiss={() => { void closePanel(); }} busy={updateMutation.isPending}>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <h2 id="task-detail-title" className="text-base font-bold">Task details</h2>
        <button autoFocus data-autofocus aria-label="Close task details" onClick={() => { void closePanel(); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><span aria-hidden="true" className="text-2xl">×</span></button>
      </div>
      {isLoading ? <ContentState title="Loading task…" loading /> : isError || !task ? (
        <ContentState title="This task couldn’t load" description="Try again, or close this panel to return to your board." error><button onClick={() => refetch()} className="btn-primary">Try again</button></ContentState>
      ) : (<>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <button aria-pressed={task.done} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ done: !task.done })} className={task.done ? "btn-secondary w-full" : "btn-primary w-full"}>{task.done ? "✓ Completed · Mark incomplete" : "Mark task complete"}</button>
          <div>
            <label htmlFor="task-title" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Task name</label>
            <input id="task-title" className="field font-semibold" value={localTitle} maxLength={500} onChange={(event) => setLocalTitle(event.target.value)} onBlur={() => {
              if (!localTitle.trim()) setLocalTitle(task.title);
              else if (localTitle.trim() !== task.title) updateMutation.mutate({ title: localTitle.trim() });
            }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="task-section" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Section</label>
              <select id="task-section" className="field" value={task.section_id ?? ""} disabled={updateMutation.isPending} onChange={(event) => updateMutation.mutate({ section_id: event.target.value || null })}>
                {!task.section_id && <option value="" disabled>Choose a section</option>}
                {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-priority" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Priority</label>
                <select id="task-priority" className="field" value={task.priority} disabled={updateMutation.isPending} onChange={(event) => updateMutation.mutate({ priority: event.target.value as Task["priority"] })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-estimate" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Estimate (min)</label>
                <input id="task-estimate" className="field" type="number" min={1} defaultValue={task.estimated_mins ?? ""} placeholder="e.g. 30" onBlur={(event) => {
                  const value = event.target.value ? Number(event.target.value) : null;
                  if (event.target.validity.valid && value !== task.estimated_mins) updateMutation.mutate({ estimated_mins: value });
                }} />
              </div>
            </div>
            <div>
              <label htmlFor="task-category" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Category <span className="font-normal">(optional)</span></label>
              <input id="task-category" className="field" defaultValue={task.category ?? ""} placeholder="e.g. Work" onBlur={(event) => {
                if (event.target.value !== (task.category ?? "")) updateMutation.mutate({ category: event.target.value });
              }} />
            </div>
            <div>
              <label htmlFor="task-deadline" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Deadline</label>
              <input id="task-deadline" className="field" type="datetime-local" defaultValue={task.deadline ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : ""} onChange={(event) => {
                updateMutation.mutate({ deadline: event.target.value ? new Date(event.target.value).toISOString() : null });
              }} />
            </div>
          </div>
          <div>
            <label htmlFor="task-notes" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</label>
            <textarea id="task-notes" className="field resize-y" value={localDesc} rows={4} placeholder="Add useful context or a next step…" onChange={(event) => setLocalDesc(event.target.value)} onBlur={() => {
              if (localDesc !== (task.description ?? "")) updateMutation.mutate({ description: localDesc });
            }} />
          </div>
          <p role="status" className={`text-xs ${updateMutation.isError ? "text-red-600 dark:text-red-300" : "text-slate-500 dark:text-slate-400"}`}>{updateMutation.isPending ? "Saving…" : updateMutation.isError ? "Change not saved. Edit the field again to retry." : "Changes save when you leave a field."}</p>
          <CommentThread task={task} />
        </div>
        <div className="flex-shrink-0 border-t border-slate-200 p-4 dark:border-slate-700">
          <button onClick={() => { void closePanel(); }} className="btn-primary mb-2 w-full" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Done"}</button>
          <button onClick={() => { deleteMutation.reset(); setConfirmDelete(true); }} className="min-h-11 w-full rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">Delete task</button>
        </div>
        <ConfirmDialog open={confirmDelete} title="Delete this task?" description={`“${task.title}” and its comments will be permanently removed.`} tone="danger" confirmLabel="Delete task" busy={deleteMutation.isPending} error={deleteMutation.isError ? "Could not delete the task. Please try again." : undefined} onCancel={() => setConfirmDelete(false)} onConfirm={() => deleteMutation.mutate()} />
      </>)}
    </Dialog>
  );
}
