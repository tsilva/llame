"use client";

import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry";
export { installSentryTestHook, SENTRY_TEST_EXCEPTION_MESSAGE } from "@/lib/sentryTestHook";

type TelemetryContext = Record<string, string | number | boolean | null | undefined>;

let vercelAnalyticsPromise: Promise<typeof import("@vercel/analytics")> | null = null;

function isVercelInsightsEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === "true";
}

function isProductionTelemetryEnabled() {
  return process.env.NODE_ENV === "production";
}

function loadVercelAnalytics() {
  vercelAnalyticsPromise ??= import("@vercel/analytics");
  return vercelAnalyticsPromise;
}

export async function initTelemetry() {
  return Promise.resolve();
}

export function captureTelemetryError(
  message: string,
  context: TelemetryContext = {},
  error?: unknown,
) {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        scope.setTag(key, String(value));
      }
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
    __sentryTest?: () => Promise<void>;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackProductEvent(name: string, payload: TelemetryContext = {}) {
  if (!isProductionTelemetryEnabled()) return;

  if (isVercelInsightsEnabled()) {
    void loadVercelAnalytics()
      .then(({ track }) => {
        track(name, payload);
      })
      .catch(() => {
        // Ignore analytics transport failures.
      });
  }

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, payload);
  }
}
