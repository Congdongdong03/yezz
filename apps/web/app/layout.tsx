import type { Metadata } from "next";
import { Inter, Noto_Serif_SC } from "next/font/google";
import { routing } from "@/i18n/routing";
import zhMessages from "@/lib/i18n/messages/zh.json";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: zhMessages.metadata.title,
    template: `%s | ${zhMessages.metadata.title}`,
  },
  description: zhMessages.metadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={routing.defaultLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${notoSerifSC.variable}`}
    >
      <body className="antialiased overflow-x-hidden">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
