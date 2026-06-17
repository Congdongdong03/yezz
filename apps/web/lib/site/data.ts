import {
  fetchGallery,
  fetchParties,
  fetchProjects,
  fetchSiteSettings,
  PublicApiError,
} from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/config";
import { loadFailed, loadOk, type LoadResult } from "@/lib/api/load-result";
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
  address: undefined,
  businessHours: undefined,
  phone: undefined,
  email: undefined,
  wechatId: undefined,
  wechatQrCodeUrl: undefined,
  heroImageUrl: undefined,
  instagram: undefined,
  xiaohongshu: undefined,
  googleMapUrl: undefined,
  seoTitle: undefined,
  seoDescription: undefined,
};

/** Minimal branding when API is enabled but unreachable — no fake contact info. */
const minimalSiteSettings: SiteSettingsView = {
  storeName: "YEZZ",
  address: undefined,
  businessHours: undefined,
  phone: undefined,
  email: undefined,
  wechatId: undefined,
  wechatQrCodeUrl: undefined,
  heroImageUrl: undefined,
  instagram: undefined,
  xiaohongshu: undefined,
  googleMapUrl: undefined,
  seoTitle: undefined,
  seoDescription: undefined,
};

export type SiteSettingsView = ReturnType<typeof mapSiteSettingsFromApi>;

export type HomePageData = {
  projects: unknown[];
  parties: ReturnType<typeof mapPartyFromApi>[];
  galleryImages: ReturnType<typeof mapGalleryImageFromApi>[];
  storeImage: ReturnType<typeof mapGalleryImageFromApi> | (typeof mockStoreImage);
  siteSettings: SiteSettingsView;
};

export async function loadSiteSettings(): Promise<SiteSettingsView> {
  if (isApiEnabled()) {
    try {
      const settings = await fetchSiteSettings();
      return mapSiteSettingsFromApi(settings);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[settings] API unavailable:",
          err instanceof PublicApiError ? err.message : err,
        );
      }
      return minimalSiteSettings;
    }
  }
  return fallbackSiteSettings;
}

export async function loadPartiesPageData(): Promise<LoadResult<
  ReturnType<typeof mapPartyFromApi>[]
>> {
  if (isApiEnabled()) {
    try {
      const parties = await fetchParties();
      return loadOk(parties.map(mapPartyFromApi));
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[parties] API failed:", err instanceof PublicApiError ? err.message : err);
      }
      return loadFailed();
    }
  }
  return loadOk(mockParties);
}

export async function loadGalleryPageData(): Promise<LoadResult<
  ReturnType<typeof mapGalleryImageFromApi>[]
>> {
  if (isApiEnabled()) {
    try {
      const images = await fetchGallery();
      return loadOk(images.map(mapGalleryImageFromApi));
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[gallery] API failed:", err instanceof PublicApiError ? err.message : err);
      }
      return loadFailed();
    }
  }
  return loadOk(mockGalleryImages);
}

export async function loadHomePageData(): Promise<LoadResult<HomePageData>> {
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

      return loadOk({
        projects,
        parties,
        galleryImages,
        storeImage,
        siteSettings: mapSiteSettingsFromApi(siteSettings),
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[home] API failed:", err instanceof PublicApiError ? err.message : err);
      }
      return loadFailed();
    }
  }

  return loadOk({
    projects: mockProjects.slice(0, 4).map((p) => ({
      ...p,
      category: p.category.name,
    })),
    parties: mockParties.slice(0, 2),
    galleryImages: mockGalleryImages.slice(0, 6),
    storeImage: mockStoreImage,
    siteSettings: fallbackSiteSettings,
  });
}
