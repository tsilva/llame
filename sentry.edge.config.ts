import * as Sentry from "@sentry/nextjs";
import { getSentryBaseConfig, getSentryTracesSampleRate } from "@/lib/sentry";

Sentry.init({
  ...getSentryBaseConfig(),
  tracesSampleRate: getSentryTracesSampleRate(),
});
