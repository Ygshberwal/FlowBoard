import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { habitsApi } from "../../api/habits";
import type { Habit, HabitStreak, HabitLogsResponse } from "../../types/habit";

interface Props {
  habits: Habit[];
  streaks: HabitStreak[];
  year: number;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS   = ["","Mon","","Wed","","Fri",""];

// Cell size in px — drives all grid dimensions
const CELL = 13;
const GAP  = 2;
const COL_W = CELL + GAP;

function buildYearGrid(year: number): (Date | null)[] {
  const jan1     = new Date(year, 0, 1);
  const dec31    = new Date(year, 11, 31);
  const startPad = jan1.getDay();       // 0=Sun … 6=Sat
  const endPad   = 6 - dec31.getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);

  const cur = new Date(year, 0, 1);
  while (cur.getFullYear() === year) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  for (let i = 0; i < endPad; i++) cells.push(null);
  return cells;
}

function monthPositions(cells: (Date | null)[]): { label: string; col: number }[] {
  const seen = new Set<number>();
  const result: { label: string; col: number }[] = [];
  cells.forEach((d, i) => {
    if (!d) return;
    const m = d.getMonth();
    if (!seen.has(m)) {
      seen.add(m);
      result.push({ label: MONTH_LABELS[m], col: Math.floor(i / 7) });
    }
  });
  return result;
}

function intensity(loggedCount: number, totalHabits: number): number {
  if (totalHabits === 0 || loggedCount === 0) return 0;
  const ratio = loggedCount / totalHabits;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5)  return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function shadeColor(hex: string, level: number): string {
  if (level === 0) return "#ebedf0";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = [0.18, 0.4, 0.65, 1][level - 1];
  const mix = (c: number) => Math.round(c * t + 235 * (1 - t));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function HabitGrid({ habits, streaks, year }: Props) {
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const { data: yearLogsData, isLoading } = useQuery<HabitLogsResponse>({
    queryKey: ["habit-logs-year", year],
    queryFn: () => habitsApi.getLogsYear(year),
  });

  const yearLogs = yearLogsData?.logs ?? {};
  const streakMap: Record<string, HabitStreak> = {};
  streaks.forEach((s) => (streakMap[s.habit_id] = s));

  const cells  = buildYearGrid(year);
  const weeks  = Math.ceil(cells.length / 7);
  const months = monthPositions(cells);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeHabits = selectedHabit
    ? habits.filter((h) => h.id === selectedHabit)
    : habits;

  const loggedCountForDate = (d: Date): number => {
    const key = dateKey(d);
    return activeHabits.filter((h) => (yearLogs[h.id] || []).includes(key)).length;
  };

  const cellColor = (d: Date): string => {
    const count = loggedCountForDate(d);
    if (activeHabits.length === 0) return "#ebedf0";
    if (selectedHabit) {
      const habit = habits.find((h) => h.id === selectedHabit);
      return shadeColor(habit?.color ?? "#1D9E75", count > 0 ? 4 : 0);
    }
    return shadeColor("#6366f1", intensity(count, activeHabits.length));
  };

  const showTooltip = (e: React.MouseEvent, d: Date) => {
    const t = tooltipRef.current;
    if (!t) return;
    const count = loggedCountForDate(d);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const names = activeHabits
      .filter((h) => (yearLogs[h.id] || []).includes(dateKey(d)))
      .map((h) => h.name);

    t.style.display = "block";
    t.style.left = `${e.clientX + 12}px`;
    t.style.top  = `${e.clientY - 40}px`;
    if (count === 0) {
      t.innerHTML = `<span class="text-slate-400">${dateStr} · No habits logged</span>`;
    } else {
      t.innerHTML = `<strong>${dateStr}</strong><br/>${names.join(", ")} · ${count}/${activeHabits.length} done`;
    }
  };

  const hideTooltip = () => {
    const t = tooltipRef.current;
    if (t) t.style.display = "none";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
        Loading year data…
      </div>
    );
  }

  const totalDaysInYear = (habitId: string) => (yearLogs[habitId] || []).length;
  const daysInYear = isLeapYear(year) ? 366 : 365;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

      {/* Habit filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedHabit(null)}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium border transition-colors ${
            selectedHabit === null
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          All habits
        </button>
        {habits.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelectedHabit(selectedHabit === h.id ? null : h.id)}
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium border transition-colors ${
              selectedHabit === h.id
                ? "text-white border-transparent"
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
            style={selectedHabit === h.id ? { backgroundColor: h.color, borderColor: h.color } : {}}
          >
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedHabit === h.id ? "rgba(255,255,255,0.8)" : h.color }}
            />
            {h.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${weeks * COL_W + 32}px` }}>

          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {Array.from({ length: weeks }).map((_, wi) => {
              const monthLabel = months.find((m) => m.col === wi);
              return (
                <div
                  key={wi}
                  style={{ width: COL_W }}
                  className="flex-shrink-0 text-[10px] text-slate-400 dark:text-slate-500 font-medium"
                >
                  {monthLabel ? monthLabel.label : ""}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          <div className="flex">
            {/* Day-of-week labels */}
            <div className="flex flex-col mr-1 w-7 flex-shrink-0" style={{ gap: GAP }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  style={{ height: CELL }}
                  className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center justify-end pr-1"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {Array.from({ length: weeks }).map((_, wi) => (
              <div key={wi} className="flex flex-col flex-shrink-0" style={{ gap: GAP, marginRight: GAP }}>
                {Array.from({ length: 7 }).map((_, di) => {
                  const cell = cells[wi * 7 + di];
                  const isFuture = cell ? cell > today : false;
                  const isToday  = cell ? cell.getTime() === today.getTime() : false;

                  if (!cell) {
                    return <div key={di} style={{ width: CELL, height: CELL }} />;
                  }

                  const color = isFuture ? "#ebedf0" : cellColor(cell);

                  return (
                    <div
                      key={di}
                      style={{ width: CELL, height: CELL, backgroundColor: color }}
                      className={`rounded-[2px] transition-transform hover:scale-125 ${
                        isFuture ? "opacity-30 cursor-default" : "cursor-pointer"
                      } ${isToday ? "ring-1 ring-indigo-500 ring-offset-[1px]" : ""}`}
                      onMouseEnter={(e) => !isFuture && showTooltip(e, cell)}
                      onMouseLeave={hideTooltip}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 ml-8">
            <span className="text-[10px] text-slate-400">Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                style={{
                  width: CELL,
                  height: CELL,
                  backgroundColor: selectedHabit
                    ? shadeColor(habits.find((h) => h.id === selectedHabit)?.color ?? "#6366f1", level)
                    : shadeColor("#6366f1", level),
                }}
                className="rounded-[2px]"
              />
            ))}
            <span className="text-[10px] text-slate-400">More</span>
          </div>
        </div>
      </div>

      {/* Per-habit stat rows */}
      <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{year} Summary</h3>
        {habits.map((habit) => {
          const total  = totalDaysInYear(habit.id);
          const streak = streakMap[habit.id];
          const pct    = Math.round((total / daysInYear) * 100);
          return (
            <div
              key={habit.id}
              onClick={() => setSelectedHabit(selectedHabit === habit.id ? null : habit.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedHabit === habit.id
                    ? "border-transparent"
                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600"
                }`}
              style={selectedHabit === habit.id ? { backgroundColor: habit.color + "15", borderColor: habit.color + "40" } : {}}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 w-32 truncate">{habit.name}</span>

              {/* Mini year bar — one segment per week */}
              <div className="flex gap-[1px] flex-1 overflow-hidden">
                {Array.from({ length: Math.min(weeks, 53) }).map((_, wi) => {
                  const weekCells = cells.slice(wi * 7, wi * 7 + 7);
                  const pastCells = weekCells.filter((d): d is Date => !!d && d <= today);
                  const someLogged = pastCells.some((d) =>
                    (yearLogs[habit.id] || []).includes(dateKey(d))
                  );
                  const allLogged =
                    pastCells.length > 0 &&
                    pastCells.every((d) => (yearLogs[habit.id] || []).includes(dateKey(d)));
                  const level = allLogged ? 4 : someLogged ? 2 : 0;
                  return (
                    <div
                      key={wi}
                      className="flex-1 h-2 rounded-[1px]"
                      style={{ backgroundColor: shadeColor(habit.color, level), minWidth: 2 }}
                    />
                  );
                })}
              </div>

              <span className="text-[10px] text-slate-400 dark:text-slate-500 w-16 text-right flex-shrink-0">
                {total} days · {pct}%
              </span>
              {streak && streak.current_streak > 0 && (
                <span className="text-[10px] text-orange-500 font-semibold flex-shrink-0">🔥{streak.current_streak}</span>
              )}
              {streak && streak.longest_streak > 0 && (
                <span className="text-[10px] text-slate-400 flex-shrink-0">best {streak.longest_streak}d</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 text-xs bg-slate-800 text-white px-3 py-2 rounded-lg shadow-xl pointer-events-none whitespace-nowrap leading-5"
        style={{ display: "none" }}
      />
    </div>
  );
}
