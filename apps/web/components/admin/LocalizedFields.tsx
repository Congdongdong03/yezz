"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocalizedString } from "@/lib/admin/types";

export function LocalizedFields({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: LocalizedString;
  onChange: (value: LocalizedString) => void;
  multiline?: boolean;
}) {
  const fieldClass = multiline
    ? "min-h-[80px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{label} (EN)</Label>
        {multiline ? (
          <textarea
            value={value.en}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            className={fieldClass}
          />
        ) : (
          <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
        )}
      </div>
      <div className="space-y-1.5">
        <Label>{label} (ZH)</Label>
        {multiline ? (
          <textarea
            value={value.zh}
            onChange={(e) => onChange({ ...value, zh: e.target.value })}
            className={fieldClass}
          />
        ) : (
          <Input value={value.zh} onChange={(e) => onChange({ ...value, zh: e.target.value })} />
        )}
      </div>
    </div>
  );
}
