import type { Metadata } from "next";
import LegalPolicyPage from "@/components/legal/LegalPolicyPage";
import { getLegalPolicy, type LegalPolicySlug } from "./policies";
import { buildPageMetadata } from "@/lib/site/metadata";

export async function buildLegalPageMetadata({
  locale,
  slug,
}: {
  locale: "en" | "zh";
  slug: LegalPolicySlug;
}): Promise<Metadata> {
  const policy = getLegalPolicy(locale, slug);
  return buildPageMetadata({
    title: policy.title,
    description: policy.description,
    locale,
    pathname: `/${slug}`,
  });
}

export function renderLegalPage(locale: "en" | "zh", slug: LegalPolicySlug) {
  return <LegalPolicyPage locale={locale} slug={slug} />;
}
