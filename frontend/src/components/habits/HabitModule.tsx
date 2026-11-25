import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { habitsApi } from "../../api/habits";
import { useHabitStore, isoDate } from "../../store/habitStore";
import { toast } from "../../store/toastStore";
import type { Habit, HabitStreak, HabitLogsResponse } from "../../types/habit";
import RadialCanvas from "./RadialCanvas";
import AddHabitForm from "./AddHabitForm";
import AnalyticsDashboard from "./AnalyticsDashboard";
import HabitGrid from "./HabitGrid";
import ContentState from "../ui/ContentState";
import ConfirmDialog from "../ui/ConfirmDialog";
import HabitCelebration from "./HabitCelebration";

const VIEWS = [{ value: "checkin", label: "Check-in" }, { value: "tracker", label: "Monthly" }, { value: "grid", label: "Yearly" }, { value: "analytics", label: "Insights" }] as const;

export default function HabitModule() {
  const { viewYear, viewMonth, prevMonth, nextMonth, setViewDate, localLogs, pendingLogs, toggleLog, reconcileLogs } = useHabitStore();
  const qc = useQueryClient();
  const today = new Date();
  const todayDate = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [activeTab, setActiveTab] = useState<typeof VIEWS[number]["value"]>("checkin");
  const [draggingHabitId, setDraggingHabitId] = useState<string | null>(null);
  const [habitDropTargetId, setHabitDropTargetId] = useState<string | null>(null);
  const [checkinFeedback, setCheckinFeedback] = useState<{ id: number; habitId: string; name: string; date: string } | null>(null);
  const [dayCelebration, setDayCelebration] = useState<{ id: number; date: string } | null>(null);
  const feedbackId = useRef(0);
  const celebratedDays = useRef(new Set<string>());
  const mounted = useRef(true);
  const feedbackContext = useRef({ date: "", month: "", view: activeTab });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!checkinFeedback) return;
    const timer = window.setTimeout(() => setCheckinFeedback(null), 2400);
    return () => window.clearTimeout(timer);
  }, [checkinFeedback]);

  useEffect(() => {
    if (!dayCelebration) return;
    const timer = window.setTimeout(() => setDayCelebration(null), 4000);
    return () => window.clearTimeout(timer);
  }, [dayCelebration]);

  const invalidateLogs = () => {
    qc.invalidateQueries({ queryKey: ["habit-logs"] });
    qc.invalidateQueries({ queryKey: ["streaks"] });
    qc.invalidateQueries({ queryKey: ["habit-logs-year"] });
    qc.invalidateQueries({ queryKey: ["habit-analytics"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => habitsApi.delete(id),
    onSuccess: () => {
      setDeletingHabit(null);
      qc.invalidateQueries({ queryKey: ["habits"] });
      invalidateLogs();
    },
    onError: () => toast.error("Could not delete the habit. Please try again."),
  });

  const { data: habits = [], isLoading, isError, refetch } = useQuery<Habit[]>({ queryKey: ["habits"], queryFn: habitsApi.list });
  const { data: logsData, isLoading: logsLoading, isError: logsError, refetch: refetchLogs } = useQuery<HabitLogsResponse>({
    queryKey: ["habit-logs", viewYear, viewMonth + 1],
    queryFn: () => habitsApi.getLogs(viewYear, viewMonth + 1),
  });
  const { data: streaks = [] } = useQuery<HabitStreak[]>({ queryKey: ["streaks"], queryFn: habitsApi.getStreaks });

  useEffect(() => {
    if (logsData) reconcileLogs(logsData.logs);
  }, [logsData, reconcileLogs]);

  const reorderMutation = useMutation({
    mutationFn: (orderedHabits: Habit[]) => Promise.all(orderedHabits.map((habit, index) => habitsApi.update(habit.id, { sort_order: index }))),
    onMutate: async (orderedHabits) => {
      await qc.cancelQueries({ queryKey: ["habits"] });
      const previous = qc.getQueryData<Habit[]>(["habits"]);
      qc.setQueryData(["habits"], orderedHabits);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(["habits"], context.previous);
      toast.error("Could not reorder your habits. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  const moveHabit = (id: string, position: number) => {
    const ordered = [...habits];
    const index = ordered.findIndex((habit) => habit.id === id);
    if (index < 0 || index === position || reorderMutation.isPending) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(position, 0, moved);
    reorderMutation.mutate(ordered);
  };

  const serverLogs = logsData?.logs ?? {};
  const mergedLogs = { ...serverLogs };
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
  Object.entries(localLogs).forEach(([key, isDone]) => {
    const [habitId, date] = key.split("::");
    if (!date.startsWith(monthPrefix)) return;
    const dates = mergedLogs[habitId] || [];
    mergedLogs[habitId] = isDone ? [...new Set([...dates, date])] : dates.filter((item) => item !== date);
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const day = Math.min(selectedDay, daysInMonth, viewYear === today.getFullYear() && viewMonth === today.getMonth() ? today.getDate() : daysInMonth);
  const selectedDate = isoDate(viewYear, viewMonth, day);
  const isToday = selectedDate === todayDate;
  const isFuture = selectedDate > todayDate;
  const completed = habits.filter((habit) => (mergedLogs[habit.id] || []).includes(selectedDate)).length;
  const daySaving = habits.some((habit) => pendingLogs[`${habit.id}::${selectedDate}`]);
  const allComplete = completed === habits.length && habits.length > 0 && !daySaving;
  const goToToday = () => { setViewDate(today.getFullYear(), today.getMonth()); setSelectedDay(today.getDate()); };
  const shiftTimeline = (amount: number) => {
    if (activeTab === "grid") setViewDate(viewYear + amount, viewMonth);
    else if (amount < 0) prevMonth();
    else nextMonth();
  };
  const streakMap = new Map(streaks.map((streak) => [streak.habit_id, streak]));
  feedbackContext.current = { date: selectedDate, month: monthPrefix, view: activeTab };

  useEffect(() => {
    setCheckinFeedback(null);
    setDayCelebration(null);
  }, [selectedDate, activeTab]);

  const handleHabitToggled = (habitId: string, date: string) => {
    invalidateLogs();
    if (!mounted.current) return;

    // Read the latest data after saving, not the potentially stale click closure.
    // This also avoids celebrating while another check-in is still in flight.
    const latest = useHabitStore.getState();
    const [year, month] = date.split("-").map(Number);
    const savedLogs = qc.getQueryData<HabitLogsResponse>(["habit-logs", year, month])?.logs ?? {};
    const latestHabits = qc.getQueryData<Habit[]>(["habits"]) ?? habits;
    const isChecked = (id: string) => latest.localLogs[`${id}::${date}`] ?? (savedLogs[id] || []).includes(date);

    if (!isChecked(habitId)) {
      for (const key of celebratedDays.current) if (key.startsWith(`${date}::`)) celebratedDays.current.delete(key);
      setCheckinFeedback((current) => current?.habitId === habitId && current.date === date ? null : current);
      setDayCelebration((current) => current?.date === date ? null : current);
      return;
    }

    const context = feedbackContext.current;
    if (!((context.view === "checkin" && context.date === date) || (context.view === "tracker" && date.startsWith(context.month)))) return;
    const habit = latestHabits.find((item) => item.id === habitId);
    if (!habit) return;
    const id = ++feedbackId.current;
    setCheckinFeedback({ id, habitId, name: habit.name, date });

    const dayComplete = latestHabits.every((item) => isChecked(item.id) && !latest.pendingLogs[`${item.id}::${date}`]);
    const celebrationKey = `${date}::${latestHabits.map((item) => item.id).sort().join(",")}`;
    if (dayComplete && !celebratedDays.current.has(celebrationKey)) {
      celebratedDays.current.add(celebrationKey);
      setDayCelebration({ id, date });
    }
  };

  const celebrationReady = dayCelebration && (activeTab === "tracker" || (activeTab === "checkin" && dayCelebration.date === selectedDate)) && dayCelebration.date.startsWith(monthPrefix) && habits.every((habit) => (mergedLogs[habit.id] || []).includes(dayCelebration.date) && !pendingLogs[`${habit.id}::${dayCelebration.date}`]);
  const celebrateSelectedDay = Boolean(celebrationReady && dayCelebration.date === selectedDate);
  const feedbackDateLabel = (date: string) => format(new Date(`${date}T12:00:00`), "MMMM d");
  const feedbackInView = checkinFeedback && ((activeTab === "checkin" && checkinFeedback.date === selectedDate) || (activeTab === "tracker" && checkinFeedback.date.startsWith(monthPrefix)));
  const feedbackMessage = celebrationReady
    ? `All habits complete for ${feedbackDateLabel(dayCelebration.date)}. Nicely done!`
    : feedbackInView ? `${checkinFeedback.name} checked in for ${feedbackDateLabel(checkinFeedback.date)}. Nice work!` : "";

  return (
    <div className="flex h-full min-w-0 flex-col">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{feedbackMessage}</p>
      <div className="flex-shrink-0 border-b border-white/60 px-4 py-1 glass dark:border-white/10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Habit view" className="flex gap-1 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800">
            {VIEWS.map((tab) => <button key={tab.value} aria-pressed={activeTab === tab.value} onClick={() => setActiveTab(tab.value)} className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors sm:flex-none ${activeTab === tab.value ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>{tab.label}</button>)}
          </div>
          <div className="flex items-center gap-1">
          {activeTab !== "checkin" && <div className="flex items-center gap-1">
            <button onClick={() => shiftTimeline(-1)} aria-label={activeTab === "grid" ? "Previous year" : "Previous month"} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">←</button>
            <span aria-live="polite" className="w-28 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{activeTab === "grid" ? viewYear : format(new Date(viewYear, viewMonth, 1), "MMM yyyy")}</span>
            <button onClick={() => shiftTimeline(1)} aria-label={activeTab === "grid" ? "Next year" : "Next month"} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">→</button>
          </div>}
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex-shrink-0"><span aria-hidden="true">+</span> Add habit</button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {isLoading ? <ContentState title="Loading your habits…" loading /> : isError ? (
          <ContentState error title="Your habits couldn’t load" description="Check your connection and try again. Your habit history hasn’t been changed."><button onClick={() => refetch()} className="btn-primary">Try again</button></ContentState>
        ) : habits.length === 0 ? (
          <ContentState title="Start small. Make it yours." description="Choose one simple habit you’d like to build, like a short walk or reading a few pages. Check in whenever you make progress."><button onClick={() => setShowAddForm(true)} className="btn-primary">Create your first habit</button></ContentState>
        ) : activeTab === "grid" ? <HabitGrid habits={habits} streaks={streaks} year={viewYear} /> : activeTab === "analytics" ? <AnalyticsDashboard year={viewYear} month={viewMonth + 1} /> : logsLoading ? <ContentState title="Loading check-ins…" loading /> : logsError ? (
          <ContentState error title="Check-ins couldn’t load" description="We couldn’t retrieve your progress for this month. Try again before making changes."><button onClick={() => refetchLogs()} className="btn-primary">Try again</button></ContentState>
        ) : activeTab === "tracker" ? (
          <div className="relative isolate flex min-h-[380px] flex-1 flex-col">
            {celebrationReady && <HabitCelebration key={dayCelebration.id} />}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-6"><h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Your month at a glance</h2><button onClick={() => setActiveTab("checkin")} className="min-h-11 text-sm font-semibold text-indigo-700 dark:text-indigo-300">Use the accessible check-in list →</button></div>
            <p className="min-h-6 px-4 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">{feedbackMessage && <span>✓ {feedbackMessage}</span>}</p>
            <RadialCanvas habits={habits} logs={mergedLogs} serverLogs={serverLogs} year={viewYear} month={viewMonth} onToggled={handleHabitToggled} />
          </div>
        ) : isFuture ? (
          <ContentState title="One day at a time" description="You can check in for today or any past day. Future check-ins aren’t available yet."><button onClick={goToToday} className="btn-primary">Return to today</button></ContentState>
        ) : (
          <section aria-labelledby="checkin-heading" className="relative isolate mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
            {celebrateSelectedDay && <HabitCelebration key={dayCelebration!.id} />}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="checkin-heading" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold text-slate-900 dark:text-white">{isToday ? "Today’s check-in" : format(new Date(viewYear, viewMonth, day), "MMMM d")}<span className="text-sm font-normal text-slate-500 dark:text-slate-400">{completed}/{habits.length} done</span>{allComplete && <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ${celebrateSelectedDay ? "habit-day-badge" : ""}`}><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>}</h2>
                <p className={`mt-1 text-sm ${allComplete ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400"}`}>{daySaving ? "Saving your progress…" : allComplete ? "All habits complete. Take a moment to enjoy your progress." : completed === 0 ? "Pick a habit and take your next small step." : "You’re making progress. Every small step counts."}</p>
              </div>
              <div className="flex items-end gap-2">
                <div><label htmlFor="checkin-date" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Check-in date</label><input id="checkin-date" className="field w-auto max-w-[180px]" type="date" value={selectedDate} max={todayDate} onChange={(event) => {
                  if (!event.target.value || event.target.value > todayDate) return;
                  const [year, month, date] = event.target.value.split("-").map(Number);
                  setViewDate(year, month - 1); setSelectedDay(date);
                }} /></div>
                {!isToday && <button onClick={goToToday} className="btn-secondary">Today</button>}
              </div>
            </div>
            <progress aria-label="Habits completed for the selected day" value={completed} max={habits.length} data-complete={allComplete} className="habit-progress mb-5 h-2 w-full overflow-hidden rounded-full accent-indigo-500" />
            <ul className="space-y-3">
              {habits.map((habit, index) => {
                const done = (mergedLogs[habit.id] || []).includes(selectedDate);
                const pending = Boolean(pendingLogs[`${habit.id}::${selectedDate}`]);
                const streak = streakMap.get(habit.id)?.current_streak ?? 0;
                const justCompleted = done && !pending && checkinFeedback?.habitId === habit.id && checkinFeedback.date === selectedDate;
                return (
                  <li key={habit.id} draggable={!reorderMutation.isPending} onDragStart={(event) => { event.dataTransfer.setData("text/habit-id", habit.id); setDraggingHabitId(habit.id); }} onDragEnd={() => { setDraggingHabitId(null); setHabitDropTargetId(null); }} onDragOver={(event) => { if (draggingHabitId) { event.preventDefault(); setHabitDropTargetId(habit.id); } }} onDrop={(event) => { event.preventDefault(); if (draggingHabitId) moveHabit(draggingHabitId, index); setDraggingHabitId(null); setHabitDropTargetId(null); }} className={`flex items-center gap-2 rounded-2xl border px-3 py-3 shadow-card transition-colors sm:px-4 ${done && !pending ? "bg-emerald-50/60 dark:bg-emerald-500/5" : "bg-white dark:bg-slate-800/70"} ${justCompleted ? "habit-checkin-success" : ""} ${habitDropTargetId === habit.id ? "border-indigo-400 ring-2 ring-indigo-200" : done && !pending ? "border-emerald-200 dark:border-emerald-800" : "border-slate-200/80 dark:border-slate-700"}`}>
                    <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg">
                      <input type="checkbox" checked={done} disabled={pending} aria-label={`${habit.name} for ${format(new Date(viewYear, viewMonth, day), "MMMM d")}`} onChange={async () => { if (await toggleLog(habit.id, day, serverLogs)) handleHabitToggled(habit.id, selectedDate); }} className={`h-6 w-6 flex-shrink-0 cursor-pointer accent-emerald-600 disabled:opacity-50 ${justCompleted ? "habit-checkin-pop" : ""}`} />
                      <span className="min-w-0">
                        <span className={`block break-words text-sm font-semibold ${done ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>{habit.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: habit.color }} />{pending ? "Saving…" : justCompleted ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path className="habit-checkin-stroke" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Nice work! Checked in</span> : done ? "Checked in" : "Ready when you are"}{habit.category && <span>· {habit.category}</span>}{streak > 0 && <span>· {streak}-day streak</span>}</span>
                      </span>
                    </label>
                    <button aria-label={`Edit ${habit.name}`} onClick={() => setEditingHabit(habit)} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300"><svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 4l4 4M4 20l4-1L20 7a2.83 2.83 0 00-4-4L4 15v5z" /></svg></button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Missed a day? That’s okay. Choose a past date to catch up, or start fresh today. Edit a habit to change its details or position.</p>
          </section>
        )}
      </div>
      {(showAddForm || editingHabit) && <AddHabitForm habit={editingHabit ?? undefined} onClose={() => { setShowAddForm(false); setEditingHabit(null); }} onDelete={editingHabit ? () => { deleteMutation.reset(); setDeletingHabit(editingHabit); setEditingHabit(null); } : undefined} position={editingHabit ? habits.findIndex((habit) => habit.id === editingHabit.id) : undefined} habitCount={habits.length} onMove={editingHabit ? (position) => moveHabit(editingHabit.id, position) : undefined} />}
      <ConfirmDialog open={Boolean(deletingHabit)} title={`Delete “${deletingHabit?.name}”?`} description="This permanently removes the habit and all of its check-ins. Your other habits won’t be affected." tone="danger" confirmLabel="Delete habit" busy={deleteMutation.isPending} error={deleteMutation.isError ? "Could not delete the habit. Please try again." : undefined} onCancel={() => setDeletingHabit(null)} onConfirm={() => { if (deletingHabit) deleteMutation.mutate(deletingHabit.id); }} />
    </div>
  );
}
