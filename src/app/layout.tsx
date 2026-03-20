import type { Metadata, Viewport } from "next";
import {
  metadataIcons,
  metadataManifestPath,
  siteDescription,
  siteKeywords,
  socialImage,
  siteName,
  siteTitle,
  siteUrl,
  webApplicationJsonLd,
} from "@/lib/siteMetadata";
import "./globals.css";

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
    title: siteTitle,
    description: siteDescription,
    type: "website",
    url: siteUrl,
    siteName,
    locale: "en_US",
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
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
        {children}
      </body>
    </html>
  );
}
