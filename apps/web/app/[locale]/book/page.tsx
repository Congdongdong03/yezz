import { redirect } from "@/i18n/routing";

/** Legacy booking URL — unified flow lives on project detail + cart. */
export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/projects", locale });
}
