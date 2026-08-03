/** Keep navigation links separate from the URL rendered inside the map iframe. */
export function toGoogleMapsEmbedUrl(mapUrl: string, fallbackEmbedUrl: string): string {
  if (mapUrl.includes("/maps/embed")) {
    return mapUrl;
  }

  return fallbackEmbedUrl;
}
