import {
  createSocialImageResponse,
  socialImageAlt,
  socialImageContentType,
  socialImageSize,
} from "@/lib/socialImage";

export const alt = socialImageAlt;
export const size = socialImageSize;
export const contentType = socialImageContentType;
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return createSocialImageResponse();
}
