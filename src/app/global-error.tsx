"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.withScope((scope) => {
      if (error.digest) {
        scope.setTag("digest", error.digest);
      }

      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#212121] px-4 text-[#ececec]">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-[#2f2f2f] p-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[#b4b4b4]">
            The client hit an unexpected error. You can retry without leaving the page.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-[#10a37f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#14b38c]"
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
