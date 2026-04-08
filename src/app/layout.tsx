import type { Metadata, Viewport } from "next";
import {
  siteBackgroundColor,
  siteThemeColor,
  sharedSiteMetadata,
} from "@/lib/siteMetadata";
import { getSentryTestHookInlineScript } from "@/lib/sentryTestHook";
import "./base.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: siteThemeColor,
  colorScheme: "dark",
};

export const metadata: Metadata = sharedSiteMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="msapplication-TileColor" content={siteBackgroundColor} />
        <script
          id="sentry-test-hook"
          dangerouslySetInnerHTML={{ __html: getSentryTestHookInlineScript() }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
