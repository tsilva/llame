import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { chatPageMetadata } from "@/lib/siteMetadata";
import Script from "next/script";
import "../globals.css";
import "./chat.css";

export const metadata: Metadata = chatPageMetadata;

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const SHOULD_RENDER_VERCEL_INSIGHTS =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === "true";
const SHOULD_RENDER_GOOGLE_ANALYTICS =
  process.env.NODE_ENV === "production" &&
  Boolean(GA_MEASUREMENT_ID);

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      {SHOULD_RENDER_GOOGLE_ANALYTICS ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
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
    </>
  );
}
