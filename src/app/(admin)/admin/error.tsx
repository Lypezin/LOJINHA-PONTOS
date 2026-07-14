"use client";

import { RouteError } from "@/components/ui/route-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} reference={error.digest} />;
}
