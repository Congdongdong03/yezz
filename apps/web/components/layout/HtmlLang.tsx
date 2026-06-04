"use client";

import { useEffect } from "react";

/** Syncs document lang for the active locale (root <html> defaults to zh). */
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
