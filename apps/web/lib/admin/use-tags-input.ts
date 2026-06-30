"use client";

import { useState } from "react";

export function useTagsInput(initialTags?: string[] | null) {
  const [tagsText, setTagsText] = useState((initialTags ?? []).join(", "));

  const parseTags = () =>
    tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  return { tagsText, setTagsText, parseTags };
}
