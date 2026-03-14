"use client";

import * as Sentry from "@sentry/browser";
import { track as vercelTrack } from "@vercel/analytics";

type TelemetryContext = Record<string, string | number | boolean | null | undefined>;

let initialized = false;

function isVercelInsightsEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === "true";
}

function isProductionTelemetryEnabled() {
  return process.env.NODE_ENV === "production";
}

export function initTelemetry() {
  if (initialized || !isProductionTelemetryEnabled()) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      enabled: true,
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
        }
        return event;
      },
    });
  }

  initialized = true;
}

export function captureTelemetryError(
  message: string,
  context: TelemetryContext = {},
  error?: unknown,
) {
  if (!isProductionTelemetryEnabled()) return;

  initTelemetry();

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) scope.setTag(key, String(value));
    });

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    scope.setLevel("error");
    Sentry.captureMessage(message);
  });
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackProductEvent(name: string, payload: TelemetryContext = {}) {
  if (!isProductionTelemetryEnabled()) return;

  if (isVercelInsightsEnabled()) {
    try {
      vercelTrack(name, payload);
    } catch {
      // Ignore analytics transport failures.
    }
  }

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, payload);
  }
}
