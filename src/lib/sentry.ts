import type { ErrorEvent } from "@sentry/nextjs";

const DEV_ENABLE_FLAG = "NEXT_PUBLIC_SENTRY_ENABLED";
const DEFAULT_ENVIRONMENT =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV ??
  "development";
const SENSITIVE_FIELD_PATTERN = /(prompt|output|image|attachment|conversation|messages?)/i;

function scrubSensitiveFields(value: unknown, depth = 0) {
  if (!value || typeof value !== "object" || depth > 3) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      delete (value as Record<string, unknown>)[key];
      continue;
    }

    scrubSensitiveFields(nestedValue, depth + 1);
  }
}

export function isSentryEnabled() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  if (process.env[DEV_ENABLE_FLAG] === "true") {
    return true;
  }

  if (process.env[DEV_ENABLE_FLAG] === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export function getSentryBaseConfig() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: isSentryEnabled(),
    environment: DEFAULT_ENVIRONMENT,
    release:
      process.env.SENTRY_RELEASE ??
      (process.env.GIT_COMMIT_HASH && process.env.GIT_COMMIT_HASH !== "unknown"
        ? process.env.GIT_COMMIT_HASH
        : undefined),
    sendDefaultPii: false,
    beforeSend(event: ErrorEvent) {
      if (event.request && "data" in event.request) {
        delete event.request.data;
      }

      scrubSensitiveFields(event.extra);
      scrubSensitiveFields(event.contexts);

      return event;
    },
  };
}
