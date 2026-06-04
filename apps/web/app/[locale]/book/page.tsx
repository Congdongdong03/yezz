import { redirect } from "next/navigation";

/** Legacy booking URL — unified flow lives on project detail + cart. */
export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/projects`);
}
