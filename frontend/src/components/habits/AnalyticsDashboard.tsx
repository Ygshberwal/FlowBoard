import { useQuery } from "@tanstack/react-query";
import { habitsApi } from "../../api/habits";
import type { HabitAnalyticsResponse } from "../../types/habit";
import ContentState from "../ui/ContentState";

interface Props { year: number; month: number; }

export default function AnalyticsDashboard({ year, month }: Props) {
  const { data, isLoading, isError, refetch } = useQuery<HabitAnalyticsResponse>({
    queryKey: ["habit-analytics", year, month],
    queryFn: () => habitsApi.getAnalytics(year, month),
  });

  if (isError) {
    return <ContentState error title="Insights couldn’t load" description="Check your connection and try again."><button className="btn-primary" onClick={() => refetch()}>Try again</button></ContentState>;
  }
  if (isLoading || !data) {
    return <ContentState loading title="Loading your insights…" />;
  }

  const totalCompletions = data.habits.reduce((acc, h) => acc + h.logged_days, 0);
  const bestDays = Math.max(0, ...data.habits.map((h) => h.logged_days));

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">A look at your consistency</h2>
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 mb-5 min-[360px]:grid-cols-3">
        {[
          { label: "Completion", value: `${data.overall_pct}%` },
          { label: "Check-ins", value: String(totalCompletions) },
          { label: "Most active habit", value: `${bestDays} days` },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="text-xl font-bold text-slate-900 dark:text-white">{c.value}</div>
            <div className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Per-habit bars */}
      <div className="space-y-2">
        {data.habits.map((habit) => (
          <div key={habit.habit_id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: habit.color }} />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-200">{habit.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{habit.logged_days}/{habit.total_days}d</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-200 w-8 text-right">{habit.completion_pct}%</span>
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
