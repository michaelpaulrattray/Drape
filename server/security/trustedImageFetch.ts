import { validateProxyUrl } from "./urlValidator";

export const DEFAULT_TRUSTED_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_TRUSTED_IMAGE_TIMEOUT_MS = 15_000;

export class TrustedImageFetchError extends Error {
  constructor() {
    super("The image could not be fetched.");
    this.name = "TrustedImageFetchError";
  }
}

export type TrustedImage = {
  bytes: Buffer;
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

export function supportedImageMime(bytes: Buffer): TrustedImage["mime"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6
    && (
      bytes.subarray(0, 6).toString("ascii") === "GIF87a"
      || bytes.subarray(0, 6).toString("ascii") === "GIF89a"
    )
  ) {
    return "image/gif";
  }
  return null;
}

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

async function readBoundedImage(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) throw new TrustedImageFetchError();
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new TrustedImageFetchError();
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof TrustedImageFetchError) throw error;
    throw new TrustedImageFetchError();
  } finally {
    reader.releaseLock();
  }
  if (length === 0) throw new TrustedImageFetchError();
  return Buffer.concat(chunks, length);
}

export async function fetchTrustedImage(
  url: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<TrustedImage> {
  if (!validateProxyUrl(url).valid) throw new TrustedImageFetchError();

  const maxBytes = options.maxBytes ?? DEFAULT_TRUSTED_IMAGE_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TRUSTED_IMAGE_TIMEOUT_MS;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TrustedImageFetchError();
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TrustedImageFetchError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      await cancelBody(response);
      throw new TrustedImageFetchError();
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType?.startsWith("image/")) {
      await cancelBody(response);
      throw new TrustedImageFetchError();
    }

    const declaredHeader = response.headers.get("content-length");
    if (declaredHeader !== null) {
      const declaredLength = Number(declaredHeader);
      if (
        !Number.isSafeInteger(declaredLength)
        || declaredLength < 0
        || declaredLength > maxBytes
      ) {
        await cancelBody(response);
        throw new TrustedImageFetchError();
      }
    }

    const bytes = await readBoundedImage(response, maxBytes);
    const mime = supportedImageMime(bytes);
    if (!mime) throw new TrustedImageFetchError();
    return { bytes, mime };
  } catch (error) {
    if (error instanceof TrustedImageFetchError) throw error;
    throw new TrustedImageFetchError();
  } finally {
    clearTimeout(timeout);
  }
}
