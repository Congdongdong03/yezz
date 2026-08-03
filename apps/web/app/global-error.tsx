"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#fbf8f6] px-6 text-center text-[#4a3a3e]">
        <main>
          <h1 className="font-serif text-3xl font-semibold">YezYY</h1>
          <p className="mt-3">
            Something went wrong. Please refresh or contact the studio.
          </p>
        </main>
      </body>
    </html>
  );
}
