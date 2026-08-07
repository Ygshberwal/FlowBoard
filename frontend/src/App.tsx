import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppShell from "./components/layout/AppShell";
import RouteGuard from "./components/layout/RouteGuard";
import PlannerPage from "./pages/PlannerPage";
import HabitsPage from "./pages/HabitsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import Toaster from "./components/ui/Toaster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<RouteGuard />}>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/planner" replace />} />
                <Route path="planner" element={<PlannerPage />} />
                <Route path="habits" element={<HabitsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/planner" replace />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
