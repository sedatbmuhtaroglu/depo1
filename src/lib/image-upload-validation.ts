import path from "path";

type ImageFormat = "jpeg" | "png" | "gif" | "webp";

const MIME_TO_FORMAT: Record<string, ImageFormat> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const FORMAT_TO_EXTENSION: Record<ImageFormat, string> = {
  jpeg: ".jpg",
  png: ".png",
  gif: ".gif",
  webp: ".webp",
};

function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "gif";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

function extensionMatchesFormat(fileName: string, format: ImageFormat) {
  const ext = path.extname(fileName).toLowerCase();
  if (!ext) return true;
  const allowedExtByFormat: Record<ImageFormat, string[]> = {
    jpeg: [".jpg", ".jpeg"],
    png: [".png"],
    gif: [".gif"],
    webp: [".webp"],
  };
  return allowedExtByFormat[format].includes(ext);
}

export async function validateUploadedImageFile(params: {
  file: File;
  maxBytes: number;
}) {
  const { file, maxBytes } = params;

  if (!file || file.size === 0) {
    return { success: false as const, message: "Dosya bulunamadı." };
  }

  if (file.size > maxBytes) {
    return { success: false as const, message: "Dosya boyutu sınırı aşıldı." };
  }

  const declaredType = file.type?.toLowerCase().trim();
  if (declaredType && !MIME_TO_FORMAT[declaredType]) {
    return { success: false as const, message: "Sadece görsel dosyaları yükleyebilirsiniz." };
  }

  const fullBuffer = Buffer.from(await file.arrayBuffer());
  const signature = fullBuffer.subarray(0, 16);
  const detectedFormat = detectImageFormat(signature);

  if (!detectedFormat) {
    return { success: false as const, message: "Geçersiz görsel formatı." };
  }

  if (declaredType) {
    const declaredFormat = MIME_TO_FORMAT[declaredType];
    if (declaredFormat !== detectedFormat) {
      return { success: false as const, message: "Dosya türü doğrulanamadı." };
    }
  }

  if (!extensionMatchesFormat(file.name || "", detectedFormat)) {
    return { success: false as const, message: "Dosya uzantısı görsel türüyle eşleşmiyor." };
  }

  return {
    success: true as const,
    buffer: fullBuffer,
    extension: FORMAT_TO_EXTENSION[detectedFormat],
    format: detectedFormat,
  };
}
