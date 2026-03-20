"use client";

import { useEffect } from "react";
import { initTelemetry } from "@/lib/telemetry";

export function ClientTelemetry() {
  useEffect(() => {
    void initTelemetry();
  }, []);

  return null;
}
