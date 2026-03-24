import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  RESTAURANT_LOGO_MAX_SIZE_BYTES,
  RESTAURANT_LOGO_TOO_LARGE_MESSAGE,
} from "@/lib/restaurant-logo-config";
import { validateUploadedImageFile } from "@/lib/image-upload-validation";

const LOGO_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "restaurants");
const LOGO_PUBLIC_PREFIX = "/uploads/restaurants/";

export function isRestaurantLogoLocalUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith(LOGO_PUBLIC_PREFIX));
}

export async function saveRestaurantLogoFile(params: {
  tenantId: number;
  file: File;
}): Promise<{ success: true; url: string } | { success: false; message: string }> {
  const { tenantId, file } = params;

  const validated = await validateUploadedImageFile({
    file,
    maxBytes: RESTAURANT_LOGO_MAX_SIZE_BYTES,
  });

  if (!validated.success) {
    if (file && file.size > RESTAURANT_LOGO_MAX_SIZE_BYTES) {
      return { success: false, message: RESTAURANT_LOGO_TOO_LARGE_MESSAGE };
    }
    return { success: false, message: validated.message };
  }

  await mkdir(LOGO_UPLOAD_DIR, { recursive: true });
  const fileName = `${tenantId}_${Date.now()}_${randomUUID()}${validated.extension}`;
  const filePath = path.join(LOGO_UPLOAD_DIR, fileName);

  await writeFile(filePath, validated.buffer);

  return { success: true, url: `${LOGO_PUBLIC_PREFIX}${fileName}` };
}

export async function deleteRestaurantLogoFileIfLocal(
  logoUrl: string | null | undefined,
): Promise<void> {
  if (!isRestaurantLogoLocalUrl(logoUrl)) return;

  const safeFileName = path.basename(logoUrl ?? "");
  if (!safeFileName || safeFileName === "." || safeFileName === "..") return;

  const filePath = path.join(LOGO_UPLOAD_DIR, safeFileName);
  try {
    await unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}
