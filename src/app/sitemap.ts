import type { MetadataRoute } from "next";
import { MODEL_PRESETS } from "@/lib/constants";
import { getModelChatPath } from "@/lib/modelRoutes";
import { siteUrl } from "@/lib/siteMetadata";

export const dynamic = "force-static";

function getAbsoluteSiteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...MODEL_PRESETS.map((preset) => ({
      url: getAbsoluteSiteUrl(getModelChatPath(preset.id)),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
