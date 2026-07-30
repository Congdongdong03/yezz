export type PublicLocale = "en" | "zh";

export type EditorialMediaId =
  | "beading"
  | "ceramic-decorating"
  | "craft-materials";

export type EditorialMedia = {
  id: EditorialMediaId;
  kind: "inspiration";
  imageUrl: string;
  sourceUrl: string;
  licenseUrl: string;
  licenseLabel: Record<PublicLocale, string>;
  alt: Record<PublicLocale, string>;
  placements: Array<
    "home-process" | "gallery-inspiration" | "project-detail"
  >;
};

const UNSPLASH_LICENSE_URL = "https://unsplash.com/license";

export const EDITORIAL_MEDIA: readonly EditorialMedia[] = [
  {
    id: "beading",
    kind: "inspiration",
    imageUrl:
      "https://images.unsplash.com/photo-1519431458145-1ca3d5ccd68e?auto=format&fit=crop&w=1600&q=84",
    sourceUrl:
      "https://unsplash.com/photos/beaded-assorted-accessories-in-case-NnD1jMzybbE",
    licenseUrl: UNSPLASH_LICENSE_URL,
    licenseLabel: {
      en: "Unsplash License",
      zh: "Unsplash 许可",
    },
    alt: {
      en: "A tray of colourful beaded bracelets and jewellery materials",
      zh: "装有彩色串珠手链和首饰材料的托盘",
    },
    placements: ["home-process", "gallery-inspiration", "project-detail"],
  },
  {
    id: "ceramic-decorating",
    kind: "inspiration",
    imageUrl:
      "https://images.unsplash.com/photo-1673339065013-f8411fb93848?auto=format&fit=crop&w=1600&q=84",
    sourceUrl:
      "https://unsplash.com/photos/a-person-painting-a-bowl-with-a-brush-ZgO_ohK2V6A",
    licenseUrl: UNSPLASH_LICENSE_URL,
    licenseLabel: {
      en: "Unsplash License",
      zh: "Unsplash 许可",
    },
    alt: {
      en: "Hands decorating a ceramic bowl with a paintbrush",
      zh: "双手正用画笔装饰陶瓷碗",
    },
    placements: ["home-process", "gallery-inspiration", "project-detail"],
  },
  {
    id: "craft-materials",
    kind: "inspiration",
    imageUrl:
      "https://images.unsplash.com/photo-1638829154930-9b47ff9cb533?auto=format&fit=crop&w=1600&q=84",
    sourceUrl:
      "https://unsplash.com/photos/a-table-topped-with-lots-of-craft-supplies-K_BpdS338z4",
    licenseUrl: UNSPLASH_LICENSE_URL,
    licenseLabel: {
      en: "Unsplash License",
      zh: "Unsplash 许可",
    },
    alt: {
      en: "A table arranged with colourful craft supplies",
      zh: "摆放着彩色手作材料的桌面",
    },
    placements: ["home-process", "gallery-inspiration"],
  },
] as const;

export function getEditorialMedia(id: EditorialMediaId): EditorialMedia {
  const media = EDITORIAL_MEDIA.find((item) => item.id === id);

  if (!media) {
    throw new Error("Unknown editorial media");
  }

  return media;
}
