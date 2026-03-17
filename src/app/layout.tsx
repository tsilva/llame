import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ClientTelemetry } from "@/components/ClientTelemetry";
import {
  metadataIcons,
  metadataManifestPath,
  siteDescription,
  siteKeywords,
  socialImage,
  siteName,
  siteTagline,
  siteTitle,
  siteUrl,
  webApplicationJsonLd,
} from "@/lib/siteMetadata";
import "./globals.css";
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const SHOULD_RENDER_VERCEL_INSIGHTS =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === "true";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081412",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: "%s | llame",
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: siteKeywords,
  authors: [{ name: "Tiago Silva" }],
  creator: "Tiago Silva",
  publisher: "Tiago Silva",
  metadataBase: new URL(siteUrl),
  manifest: metadataManifestPath,
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
    },
  },
  icons: metadataIcons,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteName,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  referrer: "strict-origin-when-cross-origin",
  category: "technology",
  openGraph: {
    title: "llame | Private Browser AI",
    description: siteTagline,
    type: "website",
    url: siteUrl,
    siteName,
    locale: "en_US",
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "llame | Private Browser AI",
    description: siteTagline,
    creator: "@tiagosilva",
    site: "@tiagosilva",
    images: [socialImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientTelemetry />
        {children}
        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        ) : null}
        {SHOULD_RENDER_VERCEL_INSIGHTS ? <Analytics /> : null}
        {SHOULD_RENDER_VERCEL_INSIGHTS ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
