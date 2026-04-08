export const SENTRY_TEST_EXCEPTION_MESSAGE =
  "Synthetic Sentry test exception from window.__sentryTest()";

export function installSentryTestHook() {
  if (typeof window === "undefined") return () => {};

  const sentryTest = async () => {
    window.setTimeout(() => {
      throw new Error(SENTRY_TEST_EXCEPTION_MESSAGE);
    }, 0);
  };

  window.__sentryTest = sentryTest;

  return () => {
    if (window.__sentryTest === sentryTest) {
      delete window.__sentryTest;
    }
  };
}

export function getSentryTestHookInlineScript() {
  return `window.__sentryTest=async function(){window.setTimeout(function(){throw new Error(${JSON.stringify(SENTRY_TEST_EXCEPTION_MESSAGE)});},0);};`;
}
