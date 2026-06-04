import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

// /admin/* is intentionally excluded — no locale prefix (R-304)
export const config = {
  matcher: ["/", "/(zh|en)/:path*"],
};
