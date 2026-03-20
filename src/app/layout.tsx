import type { Metadata, Viewport } from "next";
import {
  generatedMetadata,
  metadataIcons,
  metadataManifestPath,
  socialImage,
  siteName,
  siteUrl,
  webApplicationJsonLd,
} from "@/lib/siteMetadata";
import { ClientTelemetry } from "@/components/ClientTelemetry";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081412",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  ...generatedMetadata,
  applicationName: siteName,
  authors: [{ name: "Tiago Silva" }],
  creator: "Tiago Silva",
  publisher: "Tiago Silva",
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
    ...generatedMetadata.openGraph,
    type: "website",
    url: siteUrl,
    siteName,
    locale: "en_US",
    images: [socialImage],
  },
  twitter: {
    ...generatedMetadata.twitter,
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
      <body className="antialiased">
        <ClientTelemetry />
        {children}
      </body>
    </html>
  );
}
