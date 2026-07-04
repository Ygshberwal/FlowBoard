import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import type { TaskCounts } from "../../types/task";

export default function TopNav() {
  const { data: counts } = useQuery<TaskCounts>({
    queryKey: ["task-counts"],
    queryFn: tasksApi.counts,
    refetchInterval: 60000,
  });

  return (
    <header className="h-10 flex-shrink-0 bg-white border-b border-slate-200 flex items-center px-4 gap-6 z-10">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-2">
        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">F</span>
        </div>
        <span className="font-semibold text-slate-800 text-xs tracking-wide">FlowBoard</span>
      </div>

      {/* Primary nav tabs */}
      <nav className="flex items-center gap-1">
        <NavLink
          to="/planner"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`
          }
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Planner
          {counts && counts.today > 0 && (
            <span className="bg-indigo-500 text-white text-[10px] font-bold px-1 py-0 rounded-full leading-4 min-w-[16px] text-center">
              {counts.today}
            </span>
          )}
        </NavLink>

        <NavLink
          to="/habits"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`
          }
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Habits
        </NavLink>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-semibold">
          Y
        </div>
      </div>
    </header>
  );
}
