"use client";

import { Button } from "@/components/ui/button";

interface DynamicArrayFieldProps<T> {
  legend: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onAdd: () => void;
  addLabel: string;
}

export default function DynamicArrayField<T>({
  legend,
  items,
  renderItem,
  onAdd,
  addLabel,
}: DynamicArrayFieldProps<T>) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      {items.map((item, index) => (
        <div key={index}>{renderItem(item, index)}</div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
