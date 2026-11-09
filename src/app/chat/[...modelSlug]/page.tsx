import type { Metadata } from "next";
import HomeApp from "@/components/HomeApp";
import { getIndexableModelIds } from "@/lib/indexableModelIds";
import { getModelIdFromRouteSlug, getModelRouteSlug } from "@/lib/modelRoutes";
import { createModelChatPageMetadata } from "@/lib/siteMetadata";

interface ModelChatPageProps {
  params: Promise<{
    modelSlug: string[];
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getIndexableModelIds().map((modelId) => ({
    modelSlug: getModelRouteSlug(modelId),
  }));
}

export async function generateMetadata({ params }: ModelChatPageProps): Promise<Metadata> {
  const { modelSlug } = await params;

  return createModelChatPageMetadata(getModelIdFromRouteSlug(modelSlug));
}

export default async function ModelChatPage({ params }: ModelChatPageProps) {
  const { modelSlug } = await params;

  return (
    <HomeApp
      forceNewChat
      initialModelId={getModelIdFromRouteSlug(modelSlug)}
    />
  );
}
