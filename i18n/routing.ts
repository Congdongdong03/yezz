import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "zh",
  pathnames: {
    "/": "/",
    "/projects": {
      en: "/projects",
      zh: "/projects",
    },
    "/parties": {
      en: "/parties",
      zh: "/parties",
    },
    "/gallery": {
      en: "/gallery",
      zh: "/gallery",
    },
    "/book": {
      en: "/book",
      zh: "/book",
    },
    "/cart": {
      en: "/cart",
      zh: "/cart",
    },
    "/contact": {
      en: "/contact",
      zh: "/contact",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
