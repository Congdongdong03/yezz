import { getTranslations } from "next-intl/server";
import BookingForm from "@/components/book/BookingForm";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Book Your Experience | YEZZ",
    description: "Reserve your DIY experience at YEZZ. Perfect for dates, birthdays, and gatherings.",
  };
}

export default async function BookPage() {
  const t = await getTranslations("book");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        {t("title")}
      </h1>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <BookingForm />
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-warm-charcoal">
              {t("visitUs")}
            </h3>
            <p className="mt-2 text-sm text-warm-grey">
              {t("recommendation")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
