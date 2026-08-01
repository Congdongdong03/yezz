import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

const openingHoursSpecification = [
  { dayOfWeek: "Monday", opens: "09:30", closes: "17:00" },
  { dayOfWeek: "Tuesday", opens: "09:30", closes: "17:00" },
  { dayOfWeek: "Wednesday", opens: "09:30", closes: "17:00" },
  { dayOfWeek: "Thursday", opens: "09:30", closes: "20:30" },
  { dayOfWeek: "Friday", opens: "09:30", closes: "20:30" },
  { dayOfWeek: "Saturday", opens: "09:30", closes: "17:30" },
  { dayOfWeek: "Sunday", opens: "10:00", closes: "17:00" },
].map((hours) => ({
  "@type": "OpeningHoursSpecification",
  ...hours,
}));

export default function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Store"],
    "@id": `${YEZYY_BUSINESS_PROFILE.website}/#business`,
    name: YEZYY_BUSINESS_PROFILE.storeName,
    url: YEZYY_BUSINESS_PROFILE.website,
    telephone: YEZYY_BUSINESS_PROFILE.phone,
    email: YEZYY_BUSINESS_PROFILE.email,
    currenciesAccepted: YEZYY_BUSINESS_PROFILE.currency,
    paymentAccepted: "In-store payment",
    address: {
      "@type": "PostalAddress",
      streetAddress: "G082/235 Springvale Rd",
      addressLocality: "Glen Waverley",
      addressRegion: "VIC",
      postalCode: "3150",
      addressCountry: "AU",
    },
    openingHoursSpecification,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
