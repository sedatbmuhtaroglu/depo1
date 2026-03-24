"use server";

import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { validateUploadedImageFile } from "@/lib/image-upload-validation";
import { logServerError } from "@/lib/server-error-log";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadProductImage(formData: FormData) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, message: "Dosya bulunamadı." };
    }

    const validated = await validateUploadedImageFile({
      file,
      maxBytes: MAX_FILE_SIZE_BYTES,
    });

    if (!validated.success) {
      return { success: false, message: validated.message };
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${tenantId}_${Date.now()}_${randomUUID()}${validated.extension}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, validated.buffer);

    const publicUrl = `/uploads/products/${fileName}`;
    return { success: true, url: publicUrl };
  } catch (error) {
    logServerError("upload-product-image", error);
    return {
      success: false,
      message: "Görsel yüklenirken bir hata oluştu.",
    };
  }
}
