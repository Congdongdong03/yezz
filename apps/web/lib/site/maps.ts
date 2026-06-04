/** Convert a public Google Maps URL into an embeddable iframe src. */
export function toGoogleMapsEmbedUrl(mapUrl: string): string {
  if (mapUrl.includes("output=embed")) {
    return mapUrl;
  }
  const separator = mapUrl.includes("?") ? "&" : "?";
  return `${mapUrl}${separator}output=embed`;
}
