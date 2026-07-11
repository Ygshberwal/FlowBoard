import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import type { TaskCounts } from "../../types/task";
import ThemeToggle from "./ThemeToggle";

const TABS = [
  {
    to: "/planner",
    label: "Planner",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    to: "/habits",
    label: "Habits",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
];

export default function TopNav() {
  const { data: counts } = useQuery<TaskCounts>({
    queryKey: ["task-counts"],
    queryFn: tasksApi.counts,
    refetchInterval: 60000,
  });

  return (
    <header className="h-14 flex-shrink-0 glass border-b border-white/60 dark:border-white/10 flex items-center px-5 gap-8 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <span className="text-white text-sm font-extrabold">F</span>
        </div>
        <span className="font-extrabold text-slate-800 dark:text-white text-base tracking-tight">FlowBoard</span>
      </div>

      {/* Primary nav tabs */}
      <nav className="flex items-center gap-1.5">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-card ring-1 ring-slate-200/70 dark:ring-white/10"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-white/10"
              }`
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
            {tab.to === "/planner" && counts && counts.today > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0 rounded-full leading-4 min-w-[18px] text-center">
                {counts.today}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Theme toggle + avatar */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-500/30 ring-2 ring-white dark:ring-slate-800">
          Y
        </div>
      </div>
    </header>
  );
}
