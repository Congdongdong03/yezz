import {
  fetchGallery,
  fetchParties,
  fetchProjects,
  fetchSiteSettings,
} from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/base";
import { isApiEnabled } from "@/lib/api/config";
import { loadFailed, loadOk, type LoadResult } from "@/lib/api/load-result";
import {
  mapGalleryImageFromApi,
  mapPartyFromApi,
  mapProjectListItemFromApi,
  mapSiteSettingsFromApi,
} from "@/lib/api/mappers";
import { YEZYY_BUSINESS_PROFILE, formatBusinessHours } from "./business";
import { selectStudioMedia } from "./studio-media";

/** Approved public fallback when API is enabled but unreachable. */
const minimalSiteSettings: SiteSettingsView = {
  storeName: YEZYY_BUSINESS_PROFILE.storeName,
  address: YEZYY_BUSINESS_PROFILE.address,
  businessHours: formatBusinessHours("en"),
  phone: YEZYY_BUSINESS_PROFILE.phone,
  email: YEZYY_BUSINESS_PROFILE.email,
  wechatId: undefined,
  wechatQrCodeUrl: undefined,
  heroImageUrl: undefined,
  instagram: undefined,
  xiaohongshu: YEZYY_BUSINESS_PROFILE.xiaohongshu,
  googleMapUrl: YEZYY_BUSINESS_PROFILE.googleMapUrl,
  seoTitle: YEZYY_BUSINESS_PROFILE.storeName,
  seoDescription: `${YEZYY_BUSINESS_PROFILE.storeName} — ${YEZYY_BUSINESS_PROFILE.address}`,
  requestCapabilities: {
    experience: false,
    product: false,
    party: false,
  },
};

export type SiteSettingsView = ReturnType<typeof mapSiteSettingsFromApi>;

type ProjectListItemView = ReturnType<typeof mapProjectListItemFromApi>;

export type HomePageProjectView = Omit<ProjectListItemView, "category"> & {
  category: ProjectListItemView["name"];
};

export type HomePageData = {
  projects: HomePageProjectView[];
  parties: ReturnType<typeof mapPartyFromApi>[];
  galleryImages: ReturnType<typeof mapGalleryImageFromApi>[];
  storeImage: ReturnType<typeof mapGalleryImageFromApi> | null;
  heroImageUrl?: string;
  siteSettings: SiteSettingsView;
};

export function resolveHomepageHeroImage(
  configuredImageUrl: string | undefined,
  storeImageUrl: string | undefined,
): string | undefined {
  const configured = configuredImageUrl?.trim();
  if (configured) return configured;
  const store = storeImageUrl?.trim();
  return store || undefined;
}

export async function loadSiteSettings(): Promise<SiteSettingsView> {
  if (!isApiEnabled()) {
    return minimalSiteSettings;
  }
  try {
    const settings = await fetchSiteSettings();
    return mapSiteSettingsFromApi(settings);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[settings] API unavailable:",
        err instanceof ApiClientError ? err.message : err,
      );
    }
    return minimalSiteSettings;
  }
}

export async function loadPartiesPageData(): Promise<LoadResult<
  ReturnType<typeof mapPartyFromApi>[]
>> {
  if (!isApiEnabled()) {
    return loadFailed();
  }
  try {
    const parties = await fetchParties();
    return loadOk(parties.map(mapPartyFromApi));
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[parties] API failed:", err instanceof ApiClientError ? err.message : err);
    }
    return loadFailed();
  }
}

export async function loadGalleryPageData(): Promise<LoadResult<
  ReturnType<typeof mapGalleryImageFromApi>[]
>> {
  if (!isApiEnabled()) {
    return loadFailed();
  }
  try {
    const images = await fetchGallery();
    return loadOk(images.map(mapGalleryImageFromApi));
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[gallery] API failed:", err instanceof ApiClientError ? err.message : err);
    }
    return loadFailed();
  }
}

export async function loadHomePageData(): Promise<LoadResult<HomePageData>> {
  if (!isApiEnabled()) {
    return loadFailed();
  }
  try {
    const [apiProjects, apiParties, apiGallery, siteSettings] = await Promise.all([
      fetchProjects(),
      fetchParties(),
      fetchGallery(),
      fetchSiteSettings(),
    ]);

    const projects: HomePageProjectView[] = apiProjects
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

    const mappedGallery = apiGallery
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mapGalleryImageFromApi);
    const galleryImages = mappedGallery.slice(0, 6);
    const selectedMedia = selectStudioMedia(mappedGallery);
    const storeImage = selectedMedia.hero;
    const mappedSettings = mapSiteSettingsFromApi(siteSettings);
    const heroImageUrl = resolveHomepageHeroImage(
      mappedSettings.heroImageUrl,
      selectedMedia.hero?.imageUrl,
    );

    return loadOk({
      projects,
      parties,
      galleryImages,
      storeImage,
      heroImageUrl,
      siteSettings: mappedSettings,
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[home] API failed:", err instanceof ApiClientError ? err.message : err);
    }
    return loadFailed();
  }
}
