import type { MetadataRoute } from "next";
import { getIndexableModelIds } from "@/lib/indexableModelIds";
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
    ...getIndexableModelIds().map((modelId) => ({
      url: getAbsoluteSiteUrl(getModelChatPath(modelId)),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
