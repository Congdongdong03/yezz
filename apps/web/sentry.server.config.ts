import * as Sentry from "@sentry/nextjs";
import { webSentryOptions } from "./lib/monitoring/sentry-options";

Sentry.init(webSentryOptions());
