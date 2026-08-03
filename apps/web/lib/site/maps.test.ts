import { describe, expect, it } from "vitest";
import { toGoogleMapsEmbedUrl } from "./maps";

const YEZYY_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m2!1s0x6ad63f2a969f74dd%3A0x41f654e59b6f9596!2sYezYY";

describe("toGoogleMapsEmbedUrl", () => {
  it("does not iframe a Google Maps search page that refuses framing", () => {
    expect(
      toGoogleMapsEmbedUrl(
        "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
        YEZYY_EMBED_URL,
      ),
    ).toBe(YEZYY_EMBED_URL);
  });

  it("uses the business query when the public link is a shortened share URL", () => {
    expect(
      toGoogleMapsEmbedUrl(
        "https://maps.app.goo.gl/83uqEVPNFC5FKYd39?g_st=ic",
        YEZYY_EMBED_URL,
      ),
    ).toBe(YEZYY_EMBED_URL);
  });

  it("preserves an existing Google Maps embed URL", () => {
    const embedUrl =
      "https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sYezYY";

    expect(toGoogleMapsEmbedUrl(embedUrl, YEZYY_EMBED_URL)).toBe(embedUrl);
  });
});
