"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart/context";
import { Link } from "@/i18n/routing";
import BookingCalendar from "@/components/book/BookingCalendar";
import BookingForm from "@/components/book/BookingForm";
import type { TimeSlotOption } from "@/lib/api/time-slots";
import StyleSelector from "./StyleSelector";

interface ProjectDetailProps {
  project: {
    _id: string;
    name: { en: string; zh: string };
    slug?: { current: string };
    projectType?: string;
    description?: { en: string; zh: string };
    imageUrl?: string;
    images?: string[];
    styles?: Array<{
      name: { en: string; zh: string };
      price?: string;
      priceDisplay?: string;
      imageUrl?: string;
    }>;
    priceRange?: string;
    priceDisplay?: string;
    duration?: string;
    tags?: string[];
    category?: { _id: string };
  };
  locale: string;
}

export default function ProjectDetail({ project, locale: _locale }: ProjectDetailProps) {
  void _locale;
  const pageLocale = useLocale();
  const t = useTranslations("projectDetail");
  const cartT = useTranslations("cart");
  const { addItem, setIsOpen } = useCart();

  type ProjectStyle = NonNullable<ProjectDetailProps["project"]["styles"]>[number];
  const [selectedStyle, setSelectedStyle] = useState<ProjectStyle | null>(null);
  const [date, setDate] = useState("");
  const [people, setPeople] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotOption | null>(null);
  const [added, setAdded] = useState(false);

  const isProduct = project.projectType === "product";
  const projectLabel = project.name[pageLocale as "en" | "zh"];
  const displayPrice = project.priceDisplay ?? project.priceRange;

  const handleAddToCart = () => {
    if (!isProduct || !selectedStyle) return;
    const item = {
      projectId: project._id,
      projectSlug: project.slug?.current ?? "",
      projectName: project.name,
      projectType: "product" as const,
      imageUrl: project.imageUrl,
      styleName: selectedStyle.name,
      price: selectedStyle.priceDisplay ?? selectedStyle.price,
    };
    const didAdd = addItem(item);
    if (didAdd) {
      setAdded(true);
      setIsOpen(true);
      setTimeout(() => setAdded(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <Link
          href="/projects"
          className="text-sm text-warm-grey hover:text-caramel"
        >
          ← {t("back")}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {project.images?.map((img: string, i: number) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-xl ${i === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"}`}
              >
                <Image src={img} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 896px) 50vw, 450px" className="object-cover" />
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h1 className="font-serif text-3xl font-bold text-warm-charcoal">
              {projectLabel}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-soft-pink/20 px-3 py-1 text-xs text-warm-charcoal"
                >
                  {tag}
                </span>
              ))}
            </div>
            {displayPrice && (
              <p className="mt-4 text-lg text-caramel">{displayPrice}</p>
            )}
            {project.duration && (
              <p className="mt-1 text-sm text-warm-grey">
                {t("duration")}: {project.duration}
              </p>
            )}
            {project.description && (
              <p className="mt-4 leading-relaxed text-warm-charcoal">
                {project.description[pageLocale as "en" | "zh"]}
              </p>
            )}
          </div>

          {isProduct && project.styles && (
            <>
              <StyleSelector
                styles={project.styles}
                selected={selectedStyle}
                onSelect={setSelectedStyle}
              />
              <div className="mt-8 flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedStyle}
                  className="flex-1 rounded-full border-2 border-caramel py-3 text-sm font-medium text-caramel transition-colors hover:bg-caramel/5 disabled:opacity-40"
                >
                  {added ? cartT("added") : cartT("add")}
                </button>
                <Link
                  href="/cart"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-full bg-caramel py-3 text-center text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {cartT("goToCart")}
                </Link>
              </div>
            </>
          )}

          {!isProduct && (
            <>
              <div className="mt-6">
                <label className="block text-sm font-medium text-warm-charcoal">
                  {t("numberOfPeople")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={people}
                  onChange={(e) => {
                    setPeople(parseInt(e.target.value, 10) || 1);
                    setSelectedSlot(null);
                  }}
                  className="mt-1 w-full max-w-xs rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
                />
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-warm-charcoal">{t("pickSchedule")}</h3>
                <div className="mt-3 rounded-xl border border-warm-grey/15 bg-white p-4">
                  <BookingCalendar
                    people={people}
                    categoryId={project.category?._id}
                    selectedSlotId={selectedSlot?.id ?? null}
                    onSelectSlot={setSelectedSlot}
                    onDateChange={setDate}
                  />
                </div>
              </div>

              <section id="booking-form" className="mt-10 scroll-mt-24">
                <h2 className="font-serif text-xl font-bold text-warm-charcoal">
                  {t("bookSectionTitle")}
                </h2>
                <p className="mt-1 text-sm text-warm-grey">{t("bookSectionHint")}</p>
                <div className="mt-6">
                  <BookingForm
                    key={`${date}-${people}-${selectedSlot?.id ?? "none"}`}
                    embedded
                    requireTimeSlot
                    defaults={{
                      interestedProject: projectLabel,
                      preferredDate: date,
                      numberOfPeople: String(people),
                      timeSlotId: selectedSlot?.id,
                      locale: pageLocale,
                    }}
                  />
                </div>
              </section>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
