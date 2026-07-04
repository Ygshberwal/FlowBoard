import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { habitsApi } from "../../api/habits";
import { useHabitStore } from "../../store/habitStore";
import type { Habit, HabitStreak, HabitLogsResponse } from "../../types/habit";
import RadialCanvas from "./RadialCanvas";
import AddHabitForm from "./AddHabitForm";
import AnalyticsDashboard from "./AnalyticsDashboard";
import HabitGrid from "./HabitGrid";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function HabitModule() {
  const { viewYear, viewMonth, prevMonth, nextMonth, localLogs, clearLocalLogs } = useHabitStore();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [activeTab, setActiveTab] = useState<"tracker" | "grid" | "analytics">("tracker");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => habitsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["streaks"] });
      qc.invalidateQueries({ queryKey: ["habit-logs"] });
    },
  });

  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: habitsApi.list,
  });

  const { data: logsData } = useQuery<HabitLogsResponse>({
    queryKey: ["habit-logs", viewYear, viewMonth + 1],
    queryFn: () => habitsApi.getLogs(viewYear, viewMonth + 1),
  });

  const { data: streaks = [] } = useQuery<HabitStreak[]>({
    queryKey: ["streaks"],
    queryFn: habitsApi.getStreaks,
  });

  // Merge server logs with optimistic local logs
  const serverLogs: Record<string, number[]> = logsData?.logs || {};
  const mergedLogs: Record<string, number[]> = { ...serverLogs };
  Object.entries(localLogs).forEach(([key, isDone]) => {
    const [habitId, dayStr] = key.split("-");
    const day = Number(dayStr);
    if (!mergedLogs[habitId]) mergedLogs[habitId] = [...(serverLogs[habitId] || [])];
    if (isDone) {
      if (!mergedLogs[habitId].includes(day)) mergedLogs[habitId] = [...mergedLogs[habitId], day];
    } else {
      mergedLogs[habitId] = mergedLogs[habitId].filter((d) => d !== day);
    }
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const streakMap: Record<string, HabitStreak> = {};
  streaks.forEach((s) => (streakMap[s.habit_id] = s));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top control bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 h-9 flex items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-sm transition-colors">‹</button>
          <span className="text-xs font-semibold text-slate-700 w-20 text-center">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-sm transition-colors">›</button>
        </div>

        <div className="w-px h-4 bg-slate-200" />

        {/* Tracker / Analytics toggle */}
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5">
          {(["tracker", "grid", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors capitalize ${
                activeTab === tab ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Add habit */}
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add habit
        </button>
      </div>

      {/* Horizontal habit strip */}
      {habits.length > 0 && (
        <div className="flex-shrink-0 bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {habits.map((habit) => {
            const logged = (mergedLogs[habit.id] || []).length;
            const pct = Math.round((logged / daysInMonth) * 100);
            const streak = streakMap[habit.id];
            return (
              <HabitChip
                key={habit.id}
                habit={habit}
                pct={pct}
                streak={streak?.current_streak ?? 0}
                onEdit={() => setEditingHabit(habit)}
                onDelete={() => {
                  if (window.confirm(`Delete "${habit.name}"? This removes all its logs too.`)) {
                    deleteMutation.mutate(habit.id);
                  }
                }}
              />
            );
          })}
        </div>
      )}

      {/* Main canvas / analytics area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "tracker" ? (
          <RadialCanvas habits={habits} logs={mergedLogs} serverLogs={serverLogs} year={viewYear} month={viewMonth} onToggled={() => { clearLocalLogs(); qc.invalidateQueries({ queryKey: ["habit-logs"] }); qc.invalidateQueries({ queryKey: ["streaks"] }); }} />
        ) : activeTab === "grid" ? (
          <HabitGrid habits={habits} streaks={streaks} year={viewYear} />
        ) : (
          <AnalyticsDashboard year={viewYear} month={viewMonth + 1} />
        )}
      </div>

      {(showAddForm || editingHabit) && (
        <AddHabitForm
          habit={editingHabit ?? undefined}
          onClose={() => { setShowAddForm(false); setEditingHabit(null); }}
        />
      )}
    </div>
  );
}

// ── Habit chip with hover-reveal edit + delete ──────────────────────────────
function HabitChip({
  habit,
  pct,
  streak,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  pct: number;
  streak: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex items-center gap-1.5 flex-shrink-0 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />
      <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">{habit.name}</span>
      <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: habit.color }} />
      </div>
      <span className="text-[10px] text-slate-400 font-medium">{pct}%</span>
      {streak > 0 && (
        <span className="text-[10px] text-orange-500 font-semibold">🔥{streak}</span>
      )}
      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        title="Edit habit"
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 w-4 h-4 rounded-full bg-slate-100 hover:bg-indigo-100 flex items-center justify-center flex-shrink-0"
      >
        <svg className="w-2.5 h-2.5 text-slate-400 hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
        </svg>
      </button>
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete habit"
        className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center flex-shrink-0"
      >
        <svg className="w-2.5 h-2.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
