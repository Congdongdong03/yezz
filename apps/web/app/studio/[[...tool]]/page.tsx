import type { Metadata, Viewport } from "next";
import StudioWrapper from "@/components/studio/StudioWrapper";

export const metadata: Metadata = {
  title: "Sanity Studio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function StudioPage() {
  return <StudioWrapper />;
}
