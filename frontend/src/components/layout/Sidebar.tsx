import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import type { TaskCounts } from "../../types/task";

const NAV_ITEMS = [
  { label: "Planner", path: "/planner", icon: "📋" },
  { label: "Habits", path: "/habits", icon: "🔥" },
];

export default function Sidebar() {
  const { data: counts } = useQuery<TaskCounts>({
    queryKey: ["task-counts"],
    queryFn: tasksApi.counts,
    refetchInterval: 60000,
  });

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="font-semibold text-slate-800 text-base">FlowBoard</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.path === "/planner" && counts && (
              <span className="ml-auto bg-indigo-100 text-indigo-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {counts.today}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
            Y
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">You</p>
            <p className="text-xs text-slate-400">FlowBoard User</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
