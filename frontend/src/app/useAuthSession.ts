import { useCallback, useEffect, useState } from "react";

import { getMe, logout as apiLogout } from "../features/auth/api";
import type { AuthUser } from "../features/auth/types";

export function useAuthSession() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((data) => {
        if (data.authenticated && data.user) {
          setAuthUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const handleAuth = useCallback((user: AuthUser) => {
    setAuthUser(user);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    setAuthUser(null);
  }, []);

  return { authLoading, authUser, handleAuth, handleLogout };
}
