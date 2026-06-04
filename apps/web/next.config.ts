import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const baseRemotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
  {
    protocol: "https",
    hostname: "picsum.photos",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "9000",
    pathname: "/yezz-media/**",
  },
  {
    protocol: "https",
    hostname: "localhost",
    port: "9000",
    pathname: "/yezz-media/**",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "9000",
    pathname: "/yezz-media/**",
  },
  {
    protocol: "https",
    hostname: "127.0.0.1",
    port: "9000",
    pathname: "/yezz-media/**",
  },
  // Cloudflare R2 public bucket URLs (pub-*.r2.dev)
  {
    protocol: "https",
    hostname: "*.r2.dev",
    pathname: "/**",
  },
];

function patternFromPublicUrl(url: string): RemotePattern | null {
  try {
    const parsed = new URL(url);
    const pattern: RemotePattern = {
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      pathname: "/**",
    };
    if (parsed.port) {
      pattern.port = parsed.port;
    }
    return pattern;
  } catch {
    return null;
  }
}

function getMediaRemotePatterns(): RemotePattern[] {
  const extra: RemotePattern[] = [];
  const seen = new Set<string>();

  const add = (pattern: RemotePattern | null) => {
    if (!pattern) return;
    const key = `${pattern.protocol}://${pattern.hostname}:${pattern.port ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    extra.push(pattern);
  };

  for (const envVar of [
    process.env.NEXT_PUBLIC_MEDIA_URL,
    process.env.S3_PUBLIC_URL,
  ]) {
    if (envVar?.trim()) {
      add(patternFromPublicUrl(envVar.trim()));
    }
  }

  return [...baseRemotePatterns, ...extra];
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: getMediaRemotePatterns(),
  },
};

export default withNextIntl(nextConfig);
