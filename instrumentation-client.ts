import { getSentryBaseConfig, getSentryTracesSampleRate } from "@/lib/sentry";

type SentryModule = typeof import("@sentry/nextjs");

let sentryModulePromise: Promise<SentryModule> | null = null;
let sentryInitPromise: Promise<SentryModule | null> | null = null;

function isLandingPage() {
  return typeof window !== "undefined" && window.location.pathname === "/";
}

function loadSentryModule() {
  sentryModulePromise ??= import("@sentry/nextjs");
  return sentryModulePromise;
}

function initSentry() {
  if (!getSentryBaseConfig().enabled) {
    return Promise.resolve(null);
  }

  sentryInitPromise ??= loadSentryModule().then((Sentry) => {
    Sentry.init({
      ...getSentryBaseConfig(),
      tracesSampleRate: getSentryTracesSampleRate(),
    });

    return Sentry;
  });

  return sentryInitPromise;
}

function scheduleLandingPageSentryInit() {
  if (typeof window === "undefined" || !isLandingPage()) {
    void initSentry();
    return;
  }

  const queueInit = () => {
    const scheduleWhenIdle = globalThis.requestIdleCallback?.bind(globalThis);

    if (scheduleWhenIdle) {
      scheduleWhenIdle(() => {
        void initSentry();
      }, { timeout: 2000 });
      return;
    }

    globalThis.setTimeout(() => {
      void initSentry();
    }, 0);
  };

  if (document.readyState === "complete") {
    queueInit();
    return;
  }

  window.addEventListener("load", queueInit, { once: true });
}

scheduleLandingPageSentryInit();

export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
) {
  void initSentry().then((Sentry) => {
    Sentry?.captureRouterTransitionStart(...args);
  });
}
