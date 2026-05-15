"use client";

import { useLocale } from "next-intl";
import Image from "next/image";

interface Style {
  name: { en: string; zh: string };
  imageUrl?: string;
  price?: string;
}

interface StyleSelectorProps {
  styles: Style[];
  selected: Style | null;
  onSelect: (style: Style) => void;
}

export default function StyleSelector({ styles, selected, onSelect }: StyleSelectorProps) {
  const locale = useLocale();

  if (!styles || styles.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold text-warm-charcoal">
        {locale === "zh" ? "选择款式" : "Choose Style"}
      </h4>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {styles.map((style, idx) => {
          const isSelected = selected?.name.en === style.name.en;
          return (
            <button
              key={idx}
              onClick={() => onSelect(style)}
              className={`relative rounded-lg border-2 p-2 text-left transition-all ${
                isSelected
                  ? "border-caramel bg-caramel/5"
                  : "border-transparent bg-white hover:border-warm-grey/20"
              }`}
            >
              {style.imageUrl && (
                <div className="relative aspect-square overflow-hidden rounded-md">
                  <Image
                    src={style.imageUrl}
                    alt={style.name[locale as "en" | "zh"]}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-warm-charcoal">
                {style.name[locale as "en" | "zh"]}
              </p>
              {style.price && (
                <p className="text-xs text-caramel">{style.price}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
