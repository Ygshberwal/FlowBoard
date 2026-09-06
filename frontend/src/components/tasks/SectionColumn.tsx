import { useState, KeyboardEvent } from "react";
import type { SectionWithTasks } from "../../types/section";
import { themeFor } from "../../lib/sectionTheme";
import { orderTasks } from "../../lib/taskOrder";
import TaskCard from "./TaskCard";

interface Props {
  section: SectionWithTasks;
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
  onAddTask: (sectionId: string, title: string) => void;
  onRenameSection: (sectionId: string, name: string) => void;
  onDeleteSection: (sectionId: string, name: string, taskCount: number) => void;
}

export default function SectionColumn({
  section,
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(section.name);

  const activeCount = section.tasks.filter((t) => !t.done).length;
  const sortedTasks = orderTasks(section.tasks);

  const submitQuickAdd = () => {
    if (quickTitle.trim()) {
      onAddTask(section.id, quickTitle.trim());
      setQuickTitle("");
    }
  };

  const handleQuickAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submitQuickAdd();
    if (e.key === "Escape") { setQuickTitle(""); setAdding(false); }
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
          title="Expand section"
          className="mt-2 text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-300 transition-colors"
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
      className={`flex flex-col flex-1 min-w-[260px] max-w-[340px] rounded-2xl overflow-hidden
        transition-all duration-200 ease-spring animate-fade-in-up
        ${isDropTarget
          ? `${theme.dropBg} dark:bg-white/10 ring-2 ${theme.ring} shadow-column`
          : "bg-white/70 dark:bg-slate-800/60 ring-1 ring-slate-200/70 dark:ring-white/10 shadow-column"}`}
    >
      {/* Accent strip */}
      <div className={`h-1.5 bg-gradient-to-r ${theme.bar}`} />

      {/* Header */}
      <div
        draggable
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
          title="Collapse section"
          className="text-slate-300 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300 transition-colors -ml-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        {editingName ? (
          <input
            autoFocus
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
          className="text-slate-300 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors p-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-2 min-h-[60px]">
        {section.tasks.length === 0 ? (
          <div className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-8 text-center transition-colors ${
            isDropTarget
              ? "border-indigo-300 text-indigo-400"
              : "border-slate-200 dark:border-white/10 text-slate-300 dark:text-slate-600"
          }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[11px] font-medium">Drop or add a task</span>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
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
          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={handleQuickAddKey}
            onBlur={() => { submitQuickAdd(); setAdding(false); }}
            placeholder="Task title, Enter to add…"
            className="w-full text-[13px] text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 rounded-xl border border-indigo-300 dark:border-indigo-500 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 placeholder-slate-400 shadow-sm"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 text-[13px] font-medium text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-white dark:hover:bg-white/5 rounded-xl px-3 py-2 transition-colors"
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
