"use client";

import { useEffect } from "react";
import { trackViewProject } from "@/lib/analytics/gtag";

type CatalogueViewTrackerProps = {
  projectName: string;
  projectSlug: string;
};

export default function CatalogueViewTracker({
  projectName,
  projectSlug,
}: CatalogueViewTrackerProps) {
  useEffect(() => {
    trackViewProject({
      project_name: projectName,
      project_slug: projectSlug,
    });
  }, [projectName, projectSlug]);

  return null;
}
