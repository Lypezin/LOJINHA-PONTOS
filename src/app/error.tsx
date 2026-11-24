"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/ui/route-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", { digest: error.digest, message: error.message });
  }, [error]);

  return <RouteError reset={reset} reference={error.digest} />;
}
