import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../api/auth";

export default function RouteGuard() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const [hydrating, setHydrating] = useState<boolean>(!!accessToken && !user);

  useEffect(() => {
    let cancelled = false;
    if (accessToken && !user) {
      setHydrating(true);
      authApi
        .me()
        .then((fetched) => {
          if (!cancelled) setUser(fetched);
        })
        .catch(() => {
          if (!cancelled) clear();
        })
        .finally(() => {
          if (!cancelled) setHydrating(false);
        });
    } else {
      setHydrating(false);
    }
    return () => {
      cancelled = true;
    };
  }, [accessToken, user, setUser, clear]);

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (hydrating) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      </div>
    );
  }

  return <Outlet />;
}
