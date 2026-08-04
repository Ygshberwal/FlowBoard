import type { Habit, HabitStreak } from "../../types/habit";
import { useHabitStore } from "../../store/habitStore";

interface Props {
  habits: Habit[];
  streaks: HabitStreak[];
  logs: Record<string, string[]>;
  onAddClick: () => void;
}

export default function HabitSidebar({ habits, streaks, logs, onAddClick }: Props) {
  const { viewYear, viewMonth } = useHabitStore();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const streakMap: Record<string, HabitStreak> = {};
  streaks.forEach((s) => (streakMap[s.habit_id] = s));

  return (
    <div className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Habits</span>
        <button
          onClick={onAddClick}
          className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors text-base font-bold leading-none"
          title="Add habit"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {habits.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            <p className="text-2xl mb-2">🌱</p>
            <p>No habits yet</p>
            <p className="text-xs mt-1">Click + to add your first</p>
          </div>
        ) : (
          habits.map((habit) => {
            const habitLogs = logs[habit.id] || [];
            const pct = Math.round((habitLogs.length / daysInMonth) * 100);
            const streak = streakMap[habit.id];

            return (
              <div key={habit.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="text-sm font-medium text-slate-700 truncate">{habit.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 pl-5">
                  <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: habit.color }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                  {streak && streak.current_streak > 0 && (
                    <span className="text-xs text-orange-500 font-semibold flex items-center gap-0.5">
                      🔥{streak.current_streak}d
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
