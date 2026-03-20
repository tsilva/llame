"use client";

import { useEffect } from "react";
import { initTelemetry, installSentryTestHook } from "@/lib/telemetry";

export function ClientTelemetry() {
  useEffect(() => {
    const cleanup = installSentryTestHook();
    void initTelemetry();

    return cleanup;
  }, []);

  return null;
}
