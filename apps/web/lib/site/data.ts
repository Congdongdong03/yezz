import {
  fetchGallery,
  fetchParties,
  fetchProjects,
  fetchSiteSettings,
  PublicApiError,
} from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/config";
import {
  mapGalleryImageFromApi,
  mapPartyFromApi,
  mapProjectListItemFromApi,
  mapSiteSettingsFromApi,
} from "@/lib/api/mappers";
import {
  mockGalleryImages,
  mockParties,
  mockProjects,
  mockStoreImage,
} from "@/lib/mock-data";

const fallbackSiteSettings = {
  storeName: "YEZZ DIY Studio",
  address: "上海市静安区创意路 88 号 YEZZ 工作室",
  businessHours: "每日 10:00 – 21:00",
  phone: "+86 138 0000 0000",
  email: "hello@yezz.studio",
  wechatId: "yezz_studio",
  wechatQrCodeUrl: "https://picsum.photos/seed/yezz-wechat-qr/400/400",
  heroImageUrl: "https://picsum.photos/seed/yezz-hero/1920/1080",
  instagram: "https://instagram.com/yezzstudio",
  xiaohongshu: "https://xiaohongshu.com/user/yezz",
  googleMapUrl: "https://maps.google.com/?q=YEZZ+DIY+Studio",
  seoTitle: "YEZZ DIY Studio — Create Your Own Masterpiece",
  seoDescription:
    "A cozy DIY studio for dates, birthdays, and gatherings. Book your creative experience today.",
};

export type SiteSettingsView = ReturnType<typeof mapSiteSettingsFromApi>;

export async function loadSiteSettings(): Promise<SiteSettingsView> {
  if (isApiEnabled()) {
    try {
      const settings = await fetchSiteSettings();
      return mapSiteSettingsFromApi(settings);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[settings] API unavailable, using fallback:",
          err instanceof PublicApiError ? err.message : err,
        );
      }
    }
  }
  return fallbackSiteSettings;
}

export async function loadPartiesPageData() {
  if (isApiEnabled()) {
    try {
      const parties = await fetchParties();
      return parties.map(mapPartyFromApi);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[parties] API fallback:", err instanceof PublicApiError ? err.message : err);
      }
    }
  }
  return mockParties;
}

export async function loadGalleryPageData() {
  if (isApiEnabled()) {
    try {
      const images = await fetchGallery();
      return images.map(mapGalleryImageFromApi);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[gallery] API fallback:", err instanceof PublicApiError ? err.message : err);
      }
    }
  }
  return mockGalleryImages;
}

export async function loadHomePageData() {
  if (isApiEnabled()) {
    try {
      const [apiProjects, apiParties, apiGallery, siteSettings] = await Promise.all([
        fetchProjects(),
        fetchParties(),
        fetchGallery(),
        fetchSiteSettings(),
      ]);

      const projects = apiProjects
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 4)
        .map((p) => {
          const mapped = mapProjectListItemFromApi(p);
          return {
            ...mapped,
            category: p.category.name,
          };
        });

      const parties = apiParties
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 2)
        .map(mapPartyFromApi);

      const galleryImages = apiGallery
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 6)
        .map(mapGalleryImageFromApi);

      const storeRow = apiGallery.find((g) => g.category === "store");
      const storeImage = storeRow
        ? mapGalleryImageFromApi(storeRow)
        : mockStoreImage;

      return {
        projects,
        parties,
        galleryImages,
        storeImage,
        siteSettings: mapSiteSettingsFromApi(siteSettings),
      };
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[home] API fallback:", err instanceof PublicApiError ? err.message : err);
      }
    }
  }

  return {
    projects: mockProjects.slice(0, 4).map((p) => ({
      ...p,
      category: p.category.name,
    })),
    parties: mockParties.slice(0, 2),
    galleryImages: mockGalleryImages.slice(0, 6),
    storeImage: mockStoreImage,
    siteSettings: fallbackSiteSettings,
  };
}
