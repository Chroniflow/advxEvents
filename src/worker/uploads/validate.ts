import type { StoryImage } from "../../shared/contracts";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 12_000;

type SupportedImageType = StoryImage["contentType"];

export interface ImageInspection {
  contentType: SupportedImageType;
  width: number;
  height: number;
  size: number;
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return signature.every((value, index) => bytes[index] === value);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  );
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    if (length < 2) break;
    offset += length + 2;
  }
  throw new Error("Unable to read image dimensions");
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } {
  const chunk = new TextDecoder().decode(bytes.slice(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  throw new Error("Unsupported WebP encoding");
}

export function inspectImage(
  bytes: Uint8Array,
  declaredType: string,
): ImageInspection {
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image exceeds size limit");

  let contentType: SupportedImageType;
  let dimensions: { width: number; height: number };
  if (isPng(bytes) && bytes.length >= 24) {
    contentType = "image/png";
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    dimensions = { width: view.getUint32(16), height: view.getUint32(20) };
  } else if (isJpeg(bytes)) {
    contentType = "image/jpeg";
    dimensions = jpegDimensions(bytes);
  } else if (isWebp(bytes)) {
    contentType = "image/webp";
    dimensions = webpDimensions(bytes);
  } else {
    throw new Error("Unsupported image type");
  }

  if (declaredType !== contentType) {
    throw new Error("Image type does not match file content");
  }
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION
  ) {
    throw new Error("Image dimensions exceed limit");
  }

  return { contentType, ...dimensions, size: bytes.byteLength };
}
