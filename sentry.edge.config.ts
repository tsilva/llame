import * as Sentry from "@sentry/nextjs";
import { getSentryBaseConfig } from "@/lib/sentry";

Sentry.init({
  ...getSentryBaseConfig(),
  tracesSampleRate: 0,
});
