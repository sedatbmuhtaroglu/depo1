import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { validateUploadedImageFile } from "@/lib/image-upload-validation";

const MAX_MEDIA_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function readUInt16LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32BE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

function extractJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const size = buffer.readUInt16BE(offset + 2);

    const isSofMarker =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isSofMarker && offset + 8 < buffer.length) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }

    if (!Number.isFinite(size) || size < 2) break;
    offset += 2 + size;
  }

  return null;
}

export function extractImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  const type = mimeType.toLowerCase();

  if (type === "image/png" && buffer.length >= 24) {
    const width = readUInt32BE(buffer, 16);
    const height = readUInt32BE(buffer, 20);
    if (width > 0 && height > 0) return { width, height };
  }

  if (type === "image/gif" && buffer.length >= 10) {
    const width = readUInt16LE(buffer, 6);
    const height = readUInt16LE(buffer, 8);
    if (width > 0 && height > 0) return { width, height };
  }

  if (type === "image/jpeg") {
    return extractJpegDimensions(buffer);
  }

  if (type === "image/webp" && buffer.length >= 30) {
    const chunkType = buffer.toString("ascii", 12, 16);
    if (chunkType === "VP8X" && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      if (width > 0 && height > 0) return { width, height };
    }

    if (chunkType === "VP8 " && buffer.length >= 30) {
      const width = readUInt16LE(buffer, 26) & 0x3fff;
      const height = readUInt16LE(buffer, 28) & 0x3fff;
      if (width > 0 && height > 0) return { width, height };
    }

    if (chunkType === "VP8L" && buffer.length >= 25) {
      const b0 = buffer[21] ?? 0;
      const b1 = buffer[22] ?? 0;
      const b2 = buffer[23] ?? 0;
      const b3 = buffer[24] ?? 0;
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      if (width > 0 && height > 0) return { width, height };
    }
  }

  return null;
}

export function normalizeOptionalMediaText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = (value?.toString() ?? "").trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

export function parseOptionalPositiveInteger(value: FormDataEntryValue | null): number | null {
  const parsed = Number.parseInt((value?.toString() ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function resolvePublicMediaFilePath(storagePath: string): string {
  const normalized = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
  return path.join(process.cwd(), "public", normalized);
}

export async function saveMediaFile(file: File) {
  const validated = await validateUploadedImageFile({
    file,
    maxBytes: MAX_MEDIA_FILE_SIZE_BYTES,
  });

  if (!validated.success) {
    return {
      success: false as const,
      message: validated.message,
    };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "media");
  await mkdir(uploadDir, { recursive: true });

  const baseName = path.basename(file.name || "asset", path.extname(file.name || "asset"));
  const safeBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "asset";

  const fileName = `${Date.now()}-${safeBase}-${randomUUID()}${validated.extension}`;
  const filePath = path.join(uploadDir, fileName);
  await writeFile(filePath, validated.buffer);

  const storagePath = `/uploads/media/${fileName}`;
  const mimeByFormat: Record<typeof validated.format, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };

  return {
    success: true as const,
    storagePath,
    fileName,
    mimeType: mimeByFormat[validated.format],
    byteSize: validated.buffer.byteLength,
    inferredDimensions: extractImageDimensions(validated.buffer, mimeByFormat[validated.format]),
  };
}

export async function removeMediaFile(storagePath: string): Promise<void> {
  const absolutePath = resolvePublicMediaFilePath(storagePath);
  try {
    await unlink(absolutePath);
  } catch {
    // missing files should not block DB cleanup
  }
}
