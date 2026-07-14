"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function SessionKeeper() {
  useEffect(() => {
    let refreshing = false;

    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden" || !navigator.onLine) return;
      refreshing = true;
      try {
        await fetch("/api/auth/session", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch {
        // A próxima retomada ou navegação tentará renovar novamente.
      } finally {
        refreshing = false;
      }
    };

    const handleResume = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);
    const interval = window.setInterval(() => void refresh(), CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("pageshow", handleResume);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
