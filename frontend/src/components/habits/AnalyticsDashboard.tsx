import { useQuery } from "@tanstack/react-query";
import { habitsApi } from "../../api/habits";
import type { HabitAnalyticsResponse } from "../../types/habit";

interface Props { year: number; month: number; }

export default function AnalyticsDashboard({ year, month }: Props) {
  const { data, isLoading } = useQuery<HabitAnalyticsResponse>({
    queryKey: ["habit-analytics", year, month],
    queryFn: () => habitsApi.getAnalytics(year, month),
  });

  if (isLoading || !data) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">Loading…</div>;
  }

  const totalCompletions = data.habits.reduce((acc, h) => acc + h.logged_days, 0);
  const bestDays = Math.max(0, ...data.habits.map((h) => h.logged_days));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Overall", value: `${data.overall_pct}%`, icon: "📊", bg: "bg-indigo-50 text-indigo-700" },
          { label: "Completions", value: String(totalCompletions), icon: "✅", bg: "bg-emerald-50 text-emerald-700" },
          { label: "Best habit", value: `${bestDays}d`, icon: "🏆", bg: "bg-amber-50 text-amber-700" },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg px-3 py-2.5 ${c.bg}`}>
            <div className="text-base mb-0.5">{c.icon}</div>
            <div className="text-lg font-bold leading-none">{c.value}</div>
            <div className="text-[10px] font-medium opacity-70 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Per-habit bars */}
      <div className="space-y-2">
        {data.habits.map((habit) => (
          <div key={habit.habit_id} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: habit.color }} />
                <span className="text-xs font-medium text-slate-600">{habit.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{habit.logged_days}/{habit.total_days}d</span>
                <span className="text-xs font-semibold text-slate-600 w-8 text-right">{habit.completion_pct}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${habit.completion_pct}%`, backgroundColor: habit.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.habits.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <p className="text-2xl mb-1">📈</p>
          <p className="text-xs">No data for this month</p>
        </div>
      )}
    </div>
  );
}
