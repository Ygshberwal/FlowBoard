import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sectionsApi } from "../../api/sections";
import { tasksApi } from "../../api/tasks";
import { useTaskStore } from "../../store/taskStore";
import { useAuthStore } from "../../store/authStore";
import { displayName } from "../../lib/avatar";
import { orderTasks } from "../../lib/taskOrder";
import type { SectionWithTasks } from "../../types/section";
import { format, isToday, parseISO } from "date-fns";
import SectionColumn from "./SectionColumn";
import TaskDetailPanel from "./TaskDetailPanel";
import ContentState from "../ui/ContentState";
import ConfirmDialog from "../ui/ConfirmDialog";
import { toast } from "../../store/toastStore";

export default function Board() {
  const qc = useQueryClient();
  const { selectedTaskId } = useTaskStore();
  const user = useAuthStore((s) => s.user);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [taskDropTargetId, setTaskDropTargetId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [sectionDropTargetId, setSectionDropTargetId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done" | "today">("all");
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; name: string; taskCount: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSection) {
      sectionInputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
      sectionInputRef.current?.focus();
    }
  }, [addingSection]);
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

  const { data: sections = [], isLoading, isError, refetch } = useQuery<SectionWithTasks[]>({
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
    onError: () => toast.error("Could not add your task. Your draft is still here; please try again."),
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
              ? { ...s, tasks: [{ ...moved!, section_id: sectionId, sort_order: null }, ...s.tasks] }
              : s
          );
          qc.setQueryData(["board"], next);
        }
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["board"], ctx.prev);
      toast.error("Could not move the task. Please try again.");
    },
    onSettled: invalidate,
  });

  const reorderTaskMutation = useMutation({
    mutationFn: ({ orderedTasks }: { sectionId: string; orderedTasks: SectionWithTasks["tasks"] }) =>
      Promise.all(orderedTasks.map((task, index) => tasksApi.update(task.id, { sort_order: index }))),
    onMutate: async ({ sectionId, orderedTasks }) => {
      await qc.cancelQueries({ queryKey: ["board"] });
      const previous = qc.getQueryData<SectionWithTasks[]>(["board"]);
      if (previous) {
        qc.setQueryData(
          ["board"],
          previous.map((section) => section.id === sectionId ? { ...section, tasks: orderedTasks } : section),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(["board"], context.previous);
      toast.error("Could not reorder tasks. Please try again.");
    },
    onSettled: invalidate,
  });

  const createSectionMutation = useMutation({
    mutationFn: (name: string) => sectionsApi.create({ name }),
    onSuccess: () => { setNewSectionName(""); setAddingSection(false); invalidate(); },
    onError: () => toast.error("Could not create the section. Please try again."),
  });

  const renameSectionMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      sectionsApi.update(id, { name }),
    onSuccess: invalidate,
    onError: () => toast.error("Could not rename the section. Please try again."),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => sectionsApi.delete(id),
    onSuccess: () => { setSectionToDelete(null); invalidate(); },
    onError: () => toast.error("Could not delete the section. Please try again."),
  });

  const reorderSectionMutation = useMutation({
    mutationFn: (orderedIds: string[]) => sectionsApi.reorder(orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: ["board"] });
      const previous = qc.getQueryData<SectionWithTasks[]>(["board"]);
      if (previous) {
        const byId = new Map(previous.map((section) => [section.id, section]));
        qc.setQueryData(
          ["board"],
          orderedIds.map((id) => byId.get(id)).filter((section): section is SectionWithTasks => Boolean(section)),
        );
      }
      return { previous };
    },
    onError: (_error, _orderedIds, context) => {
      if (context?.previous) qc.setQueryData(["board"], context.previous);
      toast.error("Could not reorder sections. Please try again.");
    },
    onSettled: invalidate,
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

  const handleDropTaskAt = (sectionId: string, targetTaskId: string, before: boolean) => {
    if (draggingTaskId && draggingTaskId !== targetTaskId) {
      const sourceSection = sections.find((item) => item.tasks.some((task) => task.id === draggingTaskId));
      const section = sections.find((item) => item.id === sectionId);
      if (sourceSection && sourceSection.id !== sectionId) {
        moveTaskMutation.mutate({ taskId: draggingTaskId, sectionId });
      } else if (section) {
        const orderedTasks = orderTasks(section.tasks);
        const fromIndex = orderedTasks.findIndex((task) => task.id === draggingTaskId);
        const targetIndex = orderedTasks.findIndex((task) => task.id === targetTaskId);
        if (fromIndex !== -1 && targetIndex !== -1) {
          const [moved] = orderedTasks.splice(fromIndex, 1);
          const insertionIndex = orderedTasks.findIndex((task) => task.id === targetTaskId) + (before ? 0 : 1);
          orderedTasks.splice(insertionIndex, 0, moved);
          const persistedOrder = orderedTasks.map((task, index) => ({
            ...task,
            sort_order: index,
          }));
          reorderTaskMutation.mutate({ sectionId, orderedTasks: persistedOrder });
        }
      }
    }
    setDraggingTaskId(null);
    setTaskDropTargetId(null);
  };

  const handleDropSection = (targetId: string, before: boolean) => {
    if (draggingSectionId && draggingSectionId !== targetId) {
      const orderedIds = sections.map((section) => section.id);
      const fromIndex = orderedIds.indexOf(draggingSectionId);
      const targetIndex = orderedIds.indexOf(targetId);
      if (fromIndex !== -1 && targetIndex !== -1) {
        orderedIds.splice(fromIndex, 1);
        const insertionIndex = orderedIds.indexOf(targetId) + (before ? 0 : 1);
        orderedIds.splice(insertionIndex, 0, draggingSectionId);
        reorderSectionMutation.mutate(orderedIds);
      }
    }
    setDraggingSectionId(null);
    setSectionDropTargetId(null);
  };

  const handleDeleteSection = (id: string, name: string, taskCount: number) => {
    deleteSectionMutation.reset();
    setSectionToDelete({ id, name, taskCount });
  };

  const totalActive = sections.reduce((n, s) => n + s.tasks.filter((t) => !t.done).length, 0);
  const totalDone = sections.reduce((n, s) => n + s.tasks.filter((t) => t.done).length, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const totalTasks = totalActive + totalDone;
  const progress = totalTasks ? Math.round(totalDone / totalTasks * 100) : 0;
  const isFiltered = Boolean(search.trim()) || filter !== "all";
  const visibleSections = sections.map((section) => ({
    section,
    visibleTasks: section.tasks.filter((task) => {
      const matchesSearch = `${task.title} ${task.category ?? ""} ${section.name}`.toLowerCase().includes(search.trim().toLowerCase());
      const matchesFilter = filter === "all" || (filter === "active" && !task.done) || (filter === "done" && task.done) || (filter === "today" && !task.done && task.deadline && isToday(parseISO(task.deadline)));
      return matchesSearch && matchesFilter;
    }),
  })).filter(({ visibleTasks }) => !isFiltered || visibleTasks.length > 0);
  const visibleCount = visibleSections.reduce((count, { visibleTasks }) => count + visibleTasks.length, 0);
  const clearFilters = () => { setSearch(""); setFilter("all"); };
  const startSection = () => { clearFilters(); setAddingSection(true); };

  const sectionForm = (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (newSectionName.trim() && !createSectionMutation.isPending) createSectionMutation.mutate(newSectionName.trim());
    }} className="w-full rounded-2xl border border-indigo-200 bg-white p-4 shadow-card dark:border-indigo-500/40 dark:bg-slate-800">
      <label htmlFor="section-name" className="mb-2 block text-left text-sm font-semibold text-slate-800 dark:text-slate-100">New section</label>
      <input ref={sectionInputRef} id="section-name" value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} maxLength={100} placeholder="e.g. Today or Personal" className="field" required onKeyDown={(event) => {
        if (event.key === "Escape" && !createSectionMutation.isPending) { setNewSectionName(""); setAddingSection(false); }
      }} />
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={!newSectionName.trim() || createSectionMutation.isPending} className="btn-primary flex-1">{createSectionMutation.isPending ? "Creating…" : "Add section"}</button>
        <button type="button" disabled={createSectionMutation.isPending} onClick={() => { setNewSectionName(""); setAddingSection(false); }} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );

  return (
    <div className="flex h-full min-h-[520px] min-w-0 flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/60 px-4 py-4 glass dark:border-white/10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{format(new Date(), "EEEE, MMMM d")}</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{greeting}, {displayName(user?.username)}</h1>
          </div>
          <button onClick={startSection} disabled={isLoading || isError} className="btn-primary"><span aria-hidden="true">+</span> Add section</button>
        </div>
        {totalTasks > 0 && !isError && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            <span>{totalActive === 0 ? "All tasks complete. Nicely done." : `${totalActive} active · ${totalDone} completed`}</span>
            <progress aria-label="Completed tasks on your board" value={totalDone} max={totalTasks} className="h-1.5 w-24 overflow-hidden rounded-full accent-indigo-500" />
            <span className="font-semibold">{progress}% complete</span>
          </div>
        )}
        {sections.length > 0 && !isError && (
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M21 21l-5-5m2-6a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="search" aria-label="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, categories, sections…" className="field pl-9" />
            </div>
            <div role="group" aria-label="Filter tasks" className="flex gap-1 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800">
              {([{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "done", label: "Completed" }, { value: "today", label: "Due today" }] as const).map((item) => (
                <button key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors sm:px-3 ${filter === item.value ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>{item.label}</button>
              ))}
            </div>
            {isFiltered && <button onClick={clearFilters} className="min-h-10 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300">Clear filters</button>}
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Board */}
        <div className="flex min-w-0 flex-1 flex-col">
          {isLoading ? <ContentState title="Loading your planner…" loading /> : isError ? (
            <ContentState error title="Your planner couldn’t load" description="Your tasks haven’t been changed. Check your connection and try again."><button onClick={() => refetch()} className="btn-primary">Try again</button></ContentState>
          ) : sections.length === 0 ? (
            <ContentState title="Make room for what matters" description="Start with one section, like Today or Personal. Then add a task you’d like to work on.">{addingSection ? sectionForm : <button onClick={startSection} className="btn-primary">Create your first section</button>}</ContentState>
          ) : isFiltered && visibleCount === 0 ? (
            <ContentState title="No matching tasks" description={search.trim() ? `No tasks match “${search.trim()}” with this filter. Try a different search or show all tasks.` : "There are no tasks in this view. Choose another filter to see the rest of your board."}><button onClick={clearFilters} className="btn-secondary">Show all tasks</button></ContentState>
          ) : (<>
            <div className="flex flex-shrink-0 items-center justify-between gap-2 px-4 pt-3 sm:px-6">
              <p role="status" className="text-xs text-slate-600 dark:text-slate-400">{isFiltered ? `${visibleCount} matching task${visibleCount === 1 ? "" : "s"}` : "Your board"}<span className="hidden sm:inline"> · {isFiltered ? "Clear filters to rearrange" : "Drag to rearrange, or open a task for details"}</span></p>
              <div className="flex gap-1">
                <button aria-label="Scroll board left" onClick={() => boardRef.current?.scrollBy({ left: -300 })} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10">←</button>
                <button aria-label="Scroll board right" onClick={() => boardRef.current?.scrollBy({ left: 300 })} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10">→</button>
              </div>
            </div>
            <div ref={boardRef} role="region" aria-label="Task board" tabIndex={0} className="min-h-0 flex-1 snap-x snap-proximity overflow-x-auto overflow-y-hidden">
            <div className="flex h-full min-w-full items-stretch gap-4 px-4 pb-5 pt-2 sm:px-6">
              {visibleSections.map(({ section, visibleTasks }) => (
                <SectionColumn
                  key={section.id}
                  section={section}
                  index={sections.findIndex((item) => item.id === section.id)}
                  visibleTasks={visibleTasks}
                  isFiltered={isFiltered}
                  isCollapsed={!isFiltered && collapsed.has(section.id)}
                  onToggleCollapse={() => toggleCollapse(section.id)}
                  isDropTarget={dropTargetId === section.id}
                  draggingTaskId={draggingTaskId}
                  onTaskDragStart={setDraggingTaskId}
                  onTaskDragEnd={() => { setDraggingTaskId(null); setDropTargetId(null); setTaskDropTargetId(null); }}
                  onDropTask={handleDropTask}
                  onDragOverColumn={setDropTargetId}
                  taskDropTargetId={taskDropTargetId}
                  onDragOverTask={setTaskDropTargetId}
                  onDropTaskAt={handleDropTaskAt}
                  isSectionDropTarget={sectionDropTargetId === section.id}
                  onSectionDragStart={setDraggingSectionId}
                  onSectionDragEnd={() => { setDraggingSectionId(null); setSectionDropTargetId(null); }}
                  onDropSection={handleDropSection}
                  onDragOverSection={setSectionDropTargetId}
                  onAddTask={(sectionId, title) => addTaskMutation.mutateAsync({ sectionId, title }).then(() => undefined)}
                  onRenameSection={(id, name) => renameSectionMutation.mutate({ id, name })}
                  onDeleteSection={handleDeleteSection}
                />
              ))}

              {/* Add section */}
              {!isFiltered && <div className="w-72 flex-shrink-0 snap-start">
                {addingSection ? sectionForm : (
                  <button
                    onClick={startSection}
                    className="group min-h-14 w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white/40 hover:bg-white/80 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-indigo-300 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-300 px-4 py-3 transition-colors"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                    Add section
                  </button>
                )}
              </div>}
            </div>
            </div>
          </>)}
        </div>

        {/* Detail panel */}
        {selectedTaskId && <TaskDetailPanel key={selectedTaskId} taskId={selectedTaskId} />}
      </div>
      <ConfirmDialog open={Boolean(sectionToDelete)} title={`Delete “${sectionToDelete?.name}”?`} description={sectionToDelete?.taskCount ? `This also deletes ${sectionToDelete.taskCount} task${sectionToDelete.taskCount === 1 ? "" : "s"} in this section. This cannot be undone.` : "This removes the empty section from your board."} tone="danger" confirmLabel="Delete section" busy={deleteSectionMutation.isPending} error={deleteSectionMutation.isError ? "Could not delete the section. Please try again." : undefined} onCancel={() => setSectionToDelete(null)} onConfirm={() => { if (sectionToDelete) deleteSectionMutation.mutate(sectionToDelete.id); }} />
    </div>
  );
}
