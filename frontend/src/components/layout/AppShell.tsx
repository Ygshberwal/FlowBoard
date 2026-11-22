import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";

export default function AppShell() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-3 focus:text-white">Skip to content</a>
      <TopNav />
      <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
