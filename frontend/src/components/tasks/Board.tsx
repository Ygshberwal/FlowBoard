import { useState, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sectionsApi } from "../../api/sections";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import { useAuthStore } from "../../store/authStore";
import { displayName } from "../../lib/avatar";
import type { SectionWithTasks } from "../../types/section";
import { format } from "date-fns";
import SectionColumn from "./SectionColumn";
import TaskDetailPanel from "./TaskDetailPanel";

export default function Board() {
  const qc = useQueryClient();
  const { selectedTaskId } = useTaskStore();
  const user = useAuthStore((s) => s.user);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("flowboard-collapsed-sections");
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });

  const toggleCollapse = (sectionId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      localStorage.setItem("flowboard-collapsed-sections", JSON.stringify([...next]));
      return next;
    });
  };

  const { data: sections = [], isLoading } = useQuery<SectionWithTasks[]>({
    queryKey: ["board"],
    queryFn: sectionsApi.board,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["board"] });
    qc.invalidateQueries({ queryKey: ["task-counts"] });
  };

  const addTaskMutation = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: string; title: string }) =>
      tasksApi.create({ title, section_id: sectionId }),
    onSuccess: invalidate,
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, sectionId }: { taskId: string; sectionId: string }) =>
      tasksApi.update(taskId, { section_id: sectionId }),
    // Optimistic move so the card jumps columns instantly.
    onMutate: async ({ taskId, sectionId }) => {
      await qc.cancelQueries({ queryKey: ["board"] });
      const prev = qc.getQueryData<SectionWithTasks[]>(["board"]);
      if (prev) {
        let moved: SectionWithTasks["tasks"][number] | undefined;
        const stripped = prev.map((s) => ({
          ...s,
          tasks: s.tasks.filter((t) => {
            if (t.id === taskId) { moved = t; return false; }
            return true;
          }),
        }));
        if (moved) {
          const next = stripped.map((s) =>
            s.id === sectionId
              ? { ...s, tasks: [{ ...moved!, section_id: sectionId }, ...s.tasks] }
              : s
          );
          qc.setQueryData(["board"], next);
        }
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["board"], ctx.prev);
    },
    onSettled: invalidate,
  });

  const createSectionMutation = useMutation({
    mutationFn: (name: string) => sectionsApi.create({ name }),
    onSuccess: () => { setNewSectionName(""); setAddingSection(false); invalidate(); },
  });

  const renameSectionMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      sectionsApi.update(id, { name }),
    onSuccess: invalidate,
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => sectionsApi.delete(id),
    onSuccess: invalidate,
  });

  const handleDropTask = (sectionId: string) => {
    if (draggingTaskId) {
      const src = sections.find((s) => s.tasks.some((t) => t.id === draggingTaskId));
      if (!src || src.id !== sectionId) {
        moveTaskMutation.mutate({ taskId: draggingTaskId, sectionId });
      }
    }
    setDraggingTaskId(null);
  };

  const handleDeleteSection = (id: string, name: string, taskCount: number) => {
    const msg = taskCount > 0
      ? `Delete section "${name}" and its ${taskCount} task(s)? This cannot be undone.`
      : `Delete section "${name}"?`;
    if (window.confirm(msg)) deleteSectionMutation.mutate(id);
  };

  const handleAddSection = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newSectionName.trim()) {
      createSectionMutation.mutate(newSectionName.trim());
    }
    if (e.key === "Escape") { setNewSectionName(""); setAddingSection(false); }
  };

  const totalActive = sections.reduce((n, s) => n + s.tasks.filter((t) => !t.done).length, 0);
  const totalDone = sections.reduce((n, s) => n + s.tasks.filter((t) => t.done).length, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 glass border-b border-white/60 dark:border-white/10 px-6 py-3.5 flex items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white leading-tight">{greeting}, {displayName(user?.username)}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{totalActive} active</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{totalDone} done</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10 px-3 py-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{sections.length} sections</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="flex gap-4 p-5 h-full items-stretch">
              {sections.map((section, i) => (
                <SectionColumn
                  key={section.id}
                  section={section}
                  index={i}
                  isCollapsed={collapsed.has(section.id)}
                  onToggleCollapse={() => toggleCollapse(section.id)}
                  isDropTarget={dropTargetId === section.id}
                  draggingTaskId={draggingTaskId}
                  onTaskDragStart={setDraggingTaskId}
                  onTaskDragEnd={() => { setDraggingTaskId(null); setDropTargetId(null); }}
                  onDropTask={handleDropTask}
                  onDragOverColumn={setDropTargetId}
                  onAddTask={(sectionId, title) => addTaskMutation.mutate({ sectionId, title })}
                  onRenameSection={(id, name) => renameSectionMutation.mutate({ id, name })}
                  onDeleteSection={handleDeleteSection}
                />
              ))}

              {/* Add section */}
              <div className="w-64 flex-shrink-0">
                {addingSection ? (
                  <div className="glass rounded-2xl ring-1 ring-indigo-200 shadow-column p-3 animate-scale-in">
                    <input
                      autoFocus
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={handleAddSection}
                      onBlur={() => { if (!newSectionName.trim()) setAddingSection(false); }}
                      placeholder="Section name…"
                      className="w-full text-sm font-semibold text-slate-700 bg-white rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-200 px-2.5 py-1.5"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => newSectionName.trim() && createSectionMutation.mutate(newSectionName.trim())}
                        className="flex-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg px-2 py-1.5 hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Add section
                      </button>
                      <button
                        onClick={() => { setNewSectionName(""); setAddingSection(false); }}
                        className="text-xs font-semibold bg-slate-100 text-slate-500 rounded-lg px-3 py-1.5 hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingSection(true)}
                    className="group w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-400 hover:text-indigo-600 bg-white/40 hover:bg-white/80 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-300 px-4 py-3 transition-all duration-200"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                    Add section
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTaskId && <TaskDetailPanel taskId={selectedTaskId} />}
      </div>
    </div>
  );
}
