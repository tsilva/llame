"use client";

import { useEffect } from "react";
import { installSentryTestHook } from "@/lib/telemetry";

export function ClientTelemetry() {
  useEffect(() => {
    const cleanup = installSentryTestHook();

    return cleanup;
  }, []);

  return null;
}
