"use client";

import Link from "next/link";
import { trackBeginBooking } from "@/lib/analytics/gtag";

type CatalogueBookingLinkProps = {
  locale: string;
  projectId: string;
  projectName: string;
};

export default function CatalogueBookingLink({
  locale,
  projectId,
  projectName,
}: CatalogueBookingLinkProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const href = `/${locale}/book?project=${encodeURIComponent(projectId)}`;

  return (
    <Link
      aria-label={
        language === "zh" ? `预约${projectName}` : `Book ${projectName}`
      }
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--public-pink)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-pink)] focus-visible:ring-offset-2"
      href={href}
      onClick={() =>
        trackBeginBooking({
          project_id: projectId,
          project_name: projectName,
          source: "catalogue_detail",
        })
      }
    >
      {language === "zh" ? "预约此选项" : "Book this option"}
    </Link>
  );
}
