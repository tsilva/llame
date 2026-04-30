import type { MetadataRoute } from "next";
import { VERIFIED_MODELS } from "@/config/verifiedModels";
import { MODEL_PRESETS } from "@/lib/constants";
import { getModelChatPath } from "@/lib/modelRoutes";
import { siteUrl } from "@/lib/siteMetadata";

export const dynamic = "force-static";

function getAbsoluteSiteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

function getSitemapModelIds() {
  return Array.from(new Set([
    ...MODEL_PRESETS.map((preset) => preset.id),
    ...VERIFIED_MODELS.map((model) => model.id),
  ]));
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
    ...getSitemapModelIds().map((modelId) => ({
      url: getAbsoluteSiteUrl(getModelChatPath(modelId)),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
