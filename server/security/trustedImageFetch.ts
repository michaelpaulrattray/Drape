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

/**
 * WHAT THESE BYTES ACTUALLY ARE, when they are not an image — for the error.
 *
 * An assertion that says only "not an image" sends the reader back to the
 * network to find out what it was. The canonical specimen is an HTML page
 * served with HTTP 200 from a bucket base that routes unknown keys to the app's
 * own index; quoting its first line names the mistake in the message itself.
 */
export function describeNonImageBytes(bytes: Buffer): string {
  if (bytes.length === 0) return "0 bytes";
  const head = bytes.subarray(0, 80).toString("utf8");
  /* Printable-ASCII-dominant means it is a document, not a truncated image. */
  const printable = head.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "").length;
  if (printable >= head.length * 0.9) {
    const label = /^\s*<(!doctype html|html)/i.test(head) ? "an HTML page" : "text";
    return `${bytes.length} bytes of ${label}: ${JSON.stringify(head.replace(/\s+/g, " ").trim())}…`;
  }
  const magic = bytes.subarray(0, 8).toString("hex").replace(/(..)(?=.)/g, "$1 ");
  return `${bytes.length} bytes of unrecognised binary (starts ${magic})`;
}

export class NotAnImageError extends Error {
  constructor(context: string, bytes: Buffer) {
    super(`${context}: these are not image bytes — ${describeNonImageBytes(bytes)}`);
    this.name = "NotAnImageError";
  }
}

/**
 * REFUSE TO ANSWER A QUESTION ABOUT A MEDIUM THESE BYTES ARE NOT.
 *
 * The law this enforces (fable-062, from the third costume of *an instrument
 * that can complete with nothing must fail on nothing*): a reading may only
 * ever be granted bytes that are provably the medium the question is about.
 *
 * The specimen: a glasses sweep fetched each master, checked `response.ok`,
 * and handed the body to a segmenter with `absentIsAnswer: true`. **A 200
 * carrying an HTML page passes `response.ok`** — and `absentIsAnswer` then
 * turned *this is not an image* into *this face wears no glasses*. The sweep
 * reported clean over thirty faces and meant nothing. The failure needs no
 * outage and no exception; it is an affirmative answer produced from a
 * document.
 *
 * Magic bytes rather than the `content-type` header, because the header is the
 * server's claim and the bytes are the fact — and it was a truthful
 * `text/html` header nobody read that would have caught this one.
 */
export function assertImageBytes(bytes: Buffer, context: string): TrustedImage["mime"] {
  const mime = supportedImageMime(bytes);
  if (!mime) throw new NotAnImageError(context, bytes);
  return mime;
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
