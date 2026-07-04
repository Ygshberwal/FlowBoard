import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";

export default function AppShell() {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <TopNav />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
