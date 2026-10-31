import { createClient } from "@/lib/supabase/client";

export const EMAIL_IMAGE_BUCKET = "email-images";
export const EMAIL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const EMAIL_IMAGE_MAX_DISPLAY_WIDTH = 600;
export const EMAIL_IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

const EXTENSION_BY_MIME_TYPE = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type EmailImageFile = Pick<File, "name" | "size" | "type">;
type EmailImageMimeType = keyof typeof EXTENSION_BY_MIME_TYPE;

export class EmailImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailImageUploadError";
  }
}

function isEmailImageMimeType(value: string): value is EmailImageMimeType {
  return value in EXTENSION_BY_MIME_TYPE;
}

export function validateEmailImage(file: EmailImageFile): string | null {
  if (!isEmailImageMimeType(file.type)) {
    return "Choose a JPEG, PNG, GIF, or WebP image.";
  }
  if (file.size <= 0) return "Choose an image that is not empty.";
  if (file.size > EMAIL_IMAGE_MAX_BYTES) return "Choose an image smaller than 5 MB.";
  return null;
}

export function emailImageAltText(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const readable = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return readable.slice(0, 200) || "Uploaded image";
}

export function emailImageObjectPath(
  userId: string,
  mimeType: EmailImageMimeType,
  objectId = crypto.randomUUID(),
): string {
  return `${userId}/${objectId}.${EXTENSION_BY_MIME_TYPE[mimeType]}`;
}

export async function emailImageDisplayWidth(file: File): Promise<number | undefined> {
  if (typeof window === "undefined") return undefined;

  const objectUrl = URL.createObjectURL(file);
  try {
    const width = await new Promise<number>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image.naturalWidth);
      image.onerror = () => reject(new Error("The selected image could not be read."));
      image.src = objectUrl;
    });
    return width > 0 ? Math.min(width, EMAIL_IMAGE_MAX_DISPLAY_WIDTH) : undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadEmailImage(file: File): Promise<string> {
  const validationError = validateEmailImage(file);
  if (validationError) throw new EmailImageUploadError(validationError);

  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new EmailImageUploadError("Sign in again before uploading an image.");
  }

  const objectPath = emailImageObjectPath(
    userData.user.id,
    file.type as EmailImageMimeType,
  );
  const { error: uploadError } = await supabase.storage
    .from(EMAIL_IMAGE_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new EmailImageUploadError("Image upload failed. Check your connection and try again.");
  }

  const { data } = supabase.storage.from(EMAIL_IMAGE_BUCKET).getPublicUrl(objectPath);
  if (!data.publicUrl) {
    throw new EmailImageUploadError("The uploaded image URL could not be created.");
  }
  return data.publicUrl;
}
