import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LocalBusinessJsonLd from "./LocalBusinessJsonLd";

describe("LocalBusinessJsonLd", () => {
  it("publishes the verified YezYY location, contact details, currency, and hours", () => {
    const markup = renderToStaticMarkup(<LocalBusinessJsonLd />);
    const json = markup.match(/<script[^>]*>(.*)<\/script>/)?.[1];

    expect(json).toBeTruthy();
    const data = JSON.parse(json!);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      name: "YezYY",
      url: "https://yezyy.com",
      telephone: "0430 787 712",
      email: "congdongdong03@gmail.com",
      currenciesAccepted: "AUD",
      address: {
        streetAddress: "G082/235 Springvale Rd",
        addressLocality: "Glen Waverley",
        addressRegion: "VIC",
        postalCode: "3150",
        addressCountry: "AU",
      },
    });
    expect(data.openingHoursSpecification).toHaveLength(7);
  });
});
