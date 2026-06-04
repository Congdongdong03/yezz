"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Resolves a Next.js async params promise and returns the `id` field.
 */
export function useResolvedId(params: Promise<{ id: string }>): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  return id;
}

type UseFormSubmitOptions = {
  /** Route to navigate to on success */
  redirectTo: string;
};

type UseFormSubmitReturn = {
  saving: boolean;
  error: string | null;
  clearError: () => void;
  handleSubmit: (action: () => Promise<void>) => (e: React.FormEvent) => Promise<void>;
};

/**
 * Manages the saving/error state and try/catch pattern common to all admin forms.
 */
export function useFormSubmit({ redirectTo }: UseFormSubmitOptions): UseFormSubmitReturn {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit =
    (action: () => Promise<void>) =>
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      try {
        await action();
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存失败");
        setSaving(false);
      }
    };

  return { saving, error, clearError: () => setError(null), handleSubmit };
}
