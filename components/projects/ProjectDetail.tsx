"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart/context";
import { Link } from "@/i18n/routing";
import StyleSelector from "./StyleSelector";

interface ProjectDetailProps {
  project: any;
  locale: string;
}

export default function ProjectDetail({ project, locale: _locale }: ProjectDetailProps) {
  void _locale;
  const pageLocale = useLocale();
  const t = useTranslations("projectDetail");
  const cartT = useTranslations("cart");
  const { addItem, setIsOpen } = useCart();

  const [selectedStyle, setSelectedStyle] = useState<any>(null);
  const [date, setDate] = useState("");
  const [people, setPeople] = useState(1);
  const [added, setAdded] = useState(false);

  const isProduct = project.projectType === "product";

  const handleAddToCart = () => {
    const item = {
      projectId: project._id,
      projectSlug: project.slug.current,
      projectName: project.name,
      projectType: project.projectType || "experience",
      imageUrl: project.imageUrl,
      styleName: isProduct ? selectedStyle?.name : undefined,
      date: !isProduct ? date : undefined,
      people: !isProduct ? people : undefined,
      price: isProduct ? selectedStyle?.price : project.priceRange,
    };
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBookNow = () => {
    handleAddToCart();
    setIsOpen(true);
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
          {/* Gallery */}
          <div className="grid gap-4 sm:grid-cols-2">
            {project.images?.map((img: string, i: number) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-xl ${i === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"}`}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="mt-8">
            <h1 className="font-serif text-3xl font-bold text-warm-charcoal">
              {project.name[pageLocale as "en" | "zh"]}
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
            {project.priceRange && (
              <p className="mt-4 text-lg text-caramel">{project.priceRange}</p>
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

          {/* Style selector for products */}
          {isProduct && project.styles && (
            <StyleSelector
              styles={project.styles}
              selected={selectedStyle}
              onSelect={setSelectedStyle}
            />
          )}

          {/* Experience options */}
          {!isProduct && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-warm-charcoal">
                  {t("preferredDate")}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-charcoal">
                  {t("numberOfPeople")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={people}
                  onChange={(e) => setPeople(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={isProduct && !selectedStyle}
              className="flex-1 rounded-full border-2 border-caramel py-3 text-sm font-medium text-caramel transition-colors hover:bg-caramel/5 disabled:opacity-40"
            >
              {added ? cartT("added") : cartT("add")}
            </button>
            <button
              onClick={handleBookNow}
              disabled={isProduct && !selectedStyle}
              className="flex-1 rounded-full bg-caramel py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              {cartT("bookNow")}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
