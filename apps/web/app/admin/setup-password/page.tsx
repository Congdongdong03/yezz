import type { Metadata } from "next";
import { Suspense } from "react";
import SetupPasswordForm from "./SetupPasswordForm";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SetupPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={null}>
        <SetupPasswordForm />
      </Suspense>
    </div>
  );
}
