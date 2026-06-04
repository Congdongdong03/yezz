"use client";

import { cn } from "@/lib/utils";

export default function AlertBanner({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "mb-4 rounded-lg border px-4 py-3 text-sm",
        type === "success"
          ? "border-accent/40 bg-accent/10 text-warm-charcoal"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span>{message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
