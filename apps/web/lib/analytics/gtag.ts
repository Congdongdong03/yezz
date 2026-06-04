declare global {
  interface Window {
    gtag: (
      command: "config" | "event" | "js" | "set",
      targetOrDate: string | Date,
      params?: Record<string, unknown>,
    ) => void;
    dataLayer: unknown[];
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined" || !window.gtag || !GA_ID) return;
  window.gtag("event", eventName, params);
}

export function trackViewProject(params: {
  project_slug: string;
  project_name: string;
}) {
  trackEvent("view_project", params);
}

export function trackSubmitBooking(params: {
  project_slug?: string;
  project_name?: string;
}) {
  trackEvent("submit_booking", params);
}

export function trackSubmitCartOrder(params: { item_count: number }) {
  trackEvent("submit_cart_order", params);
}
