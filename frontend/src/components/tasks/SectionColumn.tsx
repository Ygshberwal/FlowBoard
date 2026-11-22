import { useRef, useState } from "react";
import type { SectionWithTasks } from "../../types/section";
import { themeFor } from "../../lib/sectionTheme";
import { orderTasks } from "../../lib/taskOrder";
import TaskCard from "./TaskCard";

interface Props {
  section: SectionWithTasks;
  visibleTasks: SectionWithTasks["tasks"];
  isFiltered: boolean;
  index: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isDropTarget: boolean;
  draggingTaskId: string | null;
  onTaskDragStart: (taskId: string) => void;
  onTaskDragEnd: () => void;
  onDropTask: (sectionId: string) => void;
  onDragOverColumn: (sectionId: string | null) => void;
  taskDropTargetId: string | null;
  onDragOverTask: (taskId: string | null) => void;
  onDropTaskAt: (sectionId: string, taskId: string, before: boolean) => void;
  isSectionDropTarget: boolean;
  onSectionDragStart: (sectionId: string) => void;
  onSectionDragEnd: () => void;
  onDropSection: (sectionId: string, before: boolean) => void;
  onDragOverSection: (sectionId: string | null) => void;
  onAddTask: (sectionId: string, title: string) => Promise<void>;
  onRenameSection: (sectionId: string, name: string) => void;
  onDeleteSection: (sectionId: string, name: string, taskCount: number) => void;
}

export default function SectionColumn({
  section,
  visibleTasks,
  isFiltered,
  index,
  isCollapsed,
  onToggleCollapse,
  isDropTarget,
  draggingTaskId,
  onTaskDragStart,
  onTaskDragEnd,
  onDropTask,
  onDragOverColumn,
  taskDropTargetId,
  onDragOverTask,
  onDropTaskAt,
  isSectionDropTarget,
  onSectionDragStart,
  onSectionDragEnd,
  onDropSection,
  onDragOverSection,
  onAddTask,
  onRenameSection,
  onDeleteSection,
}: Props) {
  const theme = themeFor(index);
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(section.name);

  const activeCount = visibleTasks.filter((t) => !t.done).length;
  const sortedTasks = orderTasks(visibleTasks);

  const startAddingTask = () => {
    setAdding(true);
    taskInputRef.current?.focus();
    taskInputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const submitQuickAdd = async () => {
    if (!quickTitle.trim() || savingTask) return;
    setSavingTask(true);
    try {
      await onAddTask(section.id, quickTitle.trim());
      setQuickTitle("");
    } catch {
      // Keep the draft; the board reports the error.
    } finally {
      setSavingTask(false);
    }
  };

  const commitRename = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== section.name) onRenameSection(section.id, trimmed);
    else setNameDraft(section.name);
  };

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes("text/section-id")) onDragOverSection(section.id);
      else onDragOverColumn(section.id);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        onDragOverColumn(null);
        onDragOverSection(null);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const bounds = e.currentTarget.getBoundingClientRect();
      const before = e.clientX < bounds.left + bounds.width / 2;
      if (e.dataTransfer.getData("text/section-id")) onDropSection(section.id, before);
      else if (e.dataTransfer.getData("text/task-id")) onDropTask(section.id);
      onDragOverColumn(null);
      onDragOverSection(null);
    },
  };

  // ---- Collapsed rail ----
  if (isCollapsed) {
    return (
      <div
        {...dragProps}
        className={`flex flex-col items-center w-12 flex-shrink-0 rounded-2xl overflow-hidden
          transition-all duration-200 ease-spring animate-fade-in
          ${isSectionDropTarget
            ? "bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-400 shadow-column"
            : isDropTarget
            ? `${theme.dropBg} dark:bg-white/10 ring-2 ${theme.ring} shadow-column`
            : "bg-white/70 dark:bg-slate-800/60 ring-1 ring-slate-200/70 dark:ring-white/10 shadow-column"}`}
      >
        <div className={`w-full h-1.5 bg-gradient-to-r ${theme.bar}`} />
        <button
          onClick={onToggleCollapse}
          aria-label={`Expand ${section.name}`}
          aria-expanded={false}
          title="Expand section"
          className="mt-1 flex h-11 w-11 items-center justify-center text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <span className={`mt-2 text-[11px] font-bold rounded-full px-1.5 leading-5 min-w-[22px] text-center ${theme.badge}`}>
          {activeCount}
        </span>
        <button
          onClick={onToggleCollapse}
          className="flex-1 flex items-center justify-center py-2"
          title={section.name}
        >
          <span
            className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-wide whitespace-nowrap"
            style={{ writingMode: "vertical-rl" }}
          >
            {section.name}
          </span>
        </button>
      </div>
    );
  }

  // ---- Expanded column ----
  return (
    <div
      {...dragProps}
      className={`flex w-[calc(100vw-3rem)] min-w-[260px] max-w-[340px] flex-shrink-0 snap-start flex-col rounded-2xl overflow-hidden sm:w-80
        transition-all duration-200 ease-spring animate-fade-in-up
        ${isDropTarget
          ? `${theme.dropBg} dark:bg-white/10 ring-2 ${theme.ring} shadow-column`
          : "bg-white/70 dark:bg-slate-800/60 ring-1 ring-slate-200/70 dark:ring-white/10 shadow-column"}`}
    >
      {/* Accent strip */}
      <div className={`h-1.5 bg-gradient-to-r ${theme.bar}`} />

      {/* Header */}
      <div
        draggable={!isFiltered}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/section-id", section.id);
          onSectionDragStart(section.id);
        }}
        onDragEnd={onSectionDragEnd}
        className={`flex items-center gap-1.5 px-3.5 pt-3 pb-2 cursor-grab active:cursor-grabbing ${isSectionDropTarget ? "bg-indigo-50/70 dark:bg-indigo-950/20" : ""}`}
        title="Drag to rearrange section"
      >
        <button
          draggable={false}
          onClick={onToggleCollapse}
          aria-label={`Collapse ${section.name}`}
          aria-expanded={true}
          disabled={isFiltered}
          title="Collapse section"
          className="flex h-9 w-8 flex-shrink-0 items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors -ml-1 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        {editingName ? (
          <input
            autoFocus
            aria-label={`Rename ${section.name}`}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setNameDraft(section.name); setEditingName(false); }
            }}
            className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-500 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200"
          />
        ) : (
          <button
            draggable={false}
            onClick={() => { setNameDraft(section.name); setEditingName(true); }}
            title="Rename section"
            className={`flex-1 text-left text-sm font-bold text-slate-800 dark:text-slate-100 truncate transition-colors ${theme.glowText}`}
          >
            {section.name}
          </button>
        )}
        <span className={`text-[11px] font-bold rounded-full px-2 leading-5 min-w-[22px] text-center ${theme.badge}`}>
          {activeCount}
        </span>
        <button
          draggable={false}
          onClick={() => onDeleteSection(section.id, section.name, section.tasks.length)}
          title="Delete section"
          aria-label={`Delete ${section.name} section`}
          className="flex h-9 w-8 flex-shrink-0 items-center justify-center text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-2 min-h-[60px]">
        {section.tasks.length === 0 ? (
          <button
            type="button"
            onClick={startAddingTask}
            aria-label={`Add your first task to ${section.name}`}
            aria-expanded={adding}
            aria-controls={adding ? `quick-add-${section.id}` : undefined}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-8 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 ${
            isDropTarget
              ? "border-indigo-300 text-indigo-400"
               : "border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400"
          }`}>
            <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-semibold">Drop or add a task</span>
            <span className="text-xs">Click to write your first task</span>
          </button>
        ) : (
          sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              dragEnabled={!isFiltered}
              onDragStart={onTaskDragStart}
              onDragEnd={onTaskDragEnd}
              onDragOver={draggingTaskId !== null ? () => onDragOverTask(task.id) : undefined}
              onDrop={draggingTaskId !== null ? (e) => {
                const bounds = e.currentTarget.getBoundingClientRect();
                onDropTaskAt(section.id, task.id, e.clientY < bounds.top + bounds.height / 2);
              } : undefined}
              isDropTarget={draggingTaskId !== null && taskDropTargetId === task.id}
              isDragging={draggingTaskId === task.id}
            />
          ))
        )}
      </div>

      {/* Add task footer */}
      <div className="px-2.5 pb-3 pt-1">
        {adding ? (
          <form id={`quick-add-${section.id}`} onSubmit={(event) => { event.preventDefault(); void submitQuickAdd(); }} className="space-y-2">
          <label htmlFor={`task-title-${section.id}`} className="sr-only">New task in {section.name}</label>
          <input
            id={`task-title-${section.id}`}
            ref={taskInputRef}
            autoFocus
            value={quickTitle}
            disabled={savingTask}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape" && !savingTask) { setQuickTitle(""); setAdding(false); } }}
            placeholder="What needs to get done?"
            className="field"
            maxLength={500}
            required
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!quickTitle.trim() || savingTask} className="btn-primary flex-1">{savingTask ? "Adding…" : "Add task"}</button>
            <button type="button" disabled={savingTask} onClick={() => { setQuickTitle(""); setAdding(false); }} className="btn-secondary">Cancel</button>
          </div>
          </form>
        ) : (
          <button
            onClick={startAddingTask}
            aria-label={`Add task to ${section.name}`}
            className="min-h-11 w-full flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 bg-white/50 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 rounded-xl px-3 py-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add task
          </button>
        )}
      </div>
    </div>
  );
}
