import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import type { TaskCounts } from "../../types/task";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

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
    <header className="relative z-20 flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/60 px-4 py-3 glass dark:border-white/10 sm:flex-nowrap sm:gap-8 sm:px-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <span className="text-white text-sm font-extrabold">F</span>
        </div>
        <span className="font-extrabold text-slate-800 dark:text-white text-base tracking-tight">FlowBoard</span>
      </div>

      {/* Primary nav tabs */}
      <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-1.5 sm:order-none sm:w-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex min-h-11 flex-1 items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors sm:flex-none ${
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

      {/* Theme toggle + avatar */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
