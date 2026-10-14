// Storage helpers backed by Cloudflare R2 (S3-compatible API).
// Replaces the legacy Manus Forge storage proxy. The exported interface is
// unchanged: callers pass relative keys and persist the returned URLs.
//
// URLs are public bucket URLs (R2_PUBLIC_URL), not presigned: callers store
// them in database records and serve them indefinitely, so expiring URLs
// would break stored content.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import { createModuleLogger } from "./logging/logger";
import {
  isViewThumbnailBearingKey,
  withViewThumbnailSuffix,
} from "../shared/viewThumbnails";
const log = createModuleLogger("storage");

type StorageConfig = {
  endpoint: string;
  bucket: string;
  publicUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getStorageConfig(): StorageConfig {
  const { r2Endpoint, r2Bucket, r2PublicUrl, r2AccessKeyId, r2SecretAccessKey } = ENV;

  if (!r2Endpoint || !r2Bucket || !r2PublicUrl || !r2AccessKeyId || !r2SecretAccessKey) {
    throw new Error(
      "R2 storage credentials missing: set R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY"
    );
  }

  return {
    endpoint: r2Endpoint,
    bucket: r2Bucket,
    publicUrl: r2PublicUrl.replace(/\/+$/, ""),
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  };
}

let cachedClient: S3Client | null = null;

function getClient(config: StorageConfig): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildPublicUrl(publicUrl: string, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${publicUrl}/${encodedKey}`;
}

/**
 * The public URL for a key we already hold.
 *
 * Casting V2 persists candidate *keys* rather than URLs, because a candidate's
 * object and its row are deleted together and no durable record may outlive
 * either (§J). Projections therefore build the URL at read time instead of
 * storing one — this is the single place that reconstruction happens.
 */
export function storagePublicUrl(key: string): string {
  const config = getStorageConfig();
  return buildPublicUrl(config.publicUrl, normalizeKey(key));
}

const MAX_FORK_COPY_BYTES = 20 * 1024 * 1024;

function destroyStorageBody(body: unknown): void {
  if (
    body
    && typeof body === "object"
    && "destroy" in body
    && typeof body.destroy === "function"
  ) {
    body.destroy();
  }
}

/**
 * Which family of object a read is willing to accept.
 *
 * ⚠ **IT IS A PARAMETER RATHER THAN A SECOND READER, AND THAT IS WORKING LAW 4
 * ON A BOUNDED READ.** Every check around it — a declared length, a ceiling, a
 * streamed total that must equal the declaration — is the part a copy would get
 * subtly wrong, and a second audio-shaped reader beside this one would drift
 * from it the first time either was touched. The FAMILY is the only thing that
 * differs between callers, so the family is the only thing that is passed.
 *
 * ⚠ **AND IT STAYS AN ALLOWLIST PER CALLER — never widened to "anything".** The
 * image-only rule here was not decoration: the callers that read bytes to hand
 * to a provider are reading a customer's face, and an object that is not what
 * the caller expects must fail at the read rather than downstream. `audio/` was
 * added by #2470 for the kept voice clip, and the way it was found is the
 * argument for keeping each caller narrow: the clip route was written against
 * `storageReadBytes`, every unit arm passed because they stub the reader, and
 * the first real press in the running app answered **500** — *"Storage copy
 * source is unavailable"* — because an MP3 is not an image. Law 6, earning its
 * keep.
 */
export type StorageReadFamily = "image" | "audio";

const FAMILY_PREFIX: Readonly<Record<StorageReadFamily, string>> = {
  image: "image/",
  audio: "audio/",
};

async function readStorageBytesExact(
  config: StorageConfig,
  key: string,
  family: StorageReadFamily = "image",
): Promise<{ bytes: Buffer; contentType: string; contentHash: string }> {
  const response = await getClient(config).send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
  const declared = Number(response.ContentLength);
  if (
    !response.Body
    || !Number.isSafeInteger(declared)
    || declared <= 0
    || declared > MAX_FORK_COPY_BYTES
    || typeof response.ContentType !== "string"
    || !response.ContentType.startsWith(FAMILY_PREFIX[family])
  ) {
    destroyStorageBody(response.Body);
    throw new Error("Storage copy source is unavailable");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > declared || total > MAX_FORK_COPY_BYTES) {
        throw new Error("Storage copy source is unavailable");
      }
      chunks.push(buffer);
    }
  } finally {
    destroyStorageBody(response.Body);
  }
  if (total !== declared) throw new Error("Storage copy source is unavailable");
  const bytes = Buffer.concat(chunks, total);
  return {
    bytes,
    contentType: response.ContentType,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;

  try {
    await getClient(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  } catch (err: any) {
    throw new Error(`Storage upload failed for ${key}: ${err?.message ?? err}`);
  }

  return { key, url: buildPublicUrl(config.publicUrl, key) };
}

/**
 * Read one owned image object's bytes.
 *
 * Added for the Sign package (M7): the identity engine and the conformance
 * judge both need the signed anchor as BYTES, and the alternative — handing
 * either of them the object's public URL — would make a provider fetch our
 * customer's face over the open internet, which is the one thing the
 * public-bucket compromise is supposed to keep to a minimum. Same bounded,
 * image-only reader the exact copy uses, so a hostile or corrupt object fails
 * the same way in both places.
 */
export async function storageReadBytes(
  relKey: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const config = getStorageConfig();
  const { bytes, contentType } = await readStorageBytesExact(config, normalizeKey(relKey));
  return { bytes, contentType };
}

/**
 * Read one owned AUDIO object's bytes — a cast's kept voice clip (#2470).
 *
 * The same bounded reader as the image one, with the one difference that
 * matters stated in its own type: this caller accepts `audio/`. It exists
 * because the clip is served by an owner-only route and never by a URL
 * (`shared/voiceClipDelivery.ts`), so this server is the only thing that ever
 * opens those bytes.
 *
 * The ceiling is the shared 20 MB. A measured clip is **2.15 MB**
 * (`mp3_44100_128`, 137.7 s — #2469's receipt), so the bound is generous
 * against the real object and still refuses anything that has grown a decimal
 * place.
 */
export async function storageReadAudioBytes(
  relKey: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const config = getStorageConfig();
  const { bytes, contentType } = await readStorageBytesExact(config, normalizeKey(relKey), "audio");
  return { bytes, contentType };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  return { key, url: buildPublicUrl(config.publicUrl, key) };
}

/**
 * Fork-only exact public-object copy. It reads, bounds and hashes the source,
 * writes a distinct destination, then re-reads and hashes the destination.
 */
export async function storageCopyExact(input: {
  sourceKey: string;
  destinationKey: string;
  /*
    THE VERIFIED BYTES, OFFERED ONCE (#1389).

    This function already reads the destination back in full to prove the copy
    is exact, and then throws those bytes away. A caller that wants to make
    something FROM them — the anchor's small copy is the only one today — would
    otherwise have to read the object a third time, and an anchor is the same
    19 MB the whole card is about.

    ⚠ **It is offered rather than returned, on purpose.** Returning the buffer
    would hand every caller a copy of a customer's picture to hold for as long
    as it liked; a callback scopes it to the one that asked. And it is called
    only AFTER verification, so nothing can be built from bytes this function is
    about to reject.

    ⚠ **It cannot fail the copy.** Its rejection is caught and logged: the copy
    has already succeeded and been proven exact by the time it runs, and undoing
    a verified copy because a convenience failed would be the tail wagging the
    dog.
  */
  onVerifiedBytes?: (bytes: Buffer) => Promise<void>;
}): Promise<{
  key: string;
  url: string;
  byteSize: number;
  contentHash: string;
  contentType: string;
}> {
  const config = getStorageConfig();
  const sourceKey = normalizeKey(input.sourceKey);
  const destinationKey = normalizeKey(input.destinationKey);
  if (
    !sourceKey
    || !destinationKey
    || sourceKey === destinationKey
    || destinationKey.length > 256
  ) {
    throw new Error("Storage copy identity is invalid");
  }
  const source = await readStorageBytesExact(config, sourceKey);
  try {
    await getClient(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: destinationKey,
        Body: source.bytes,
        ContentType: source.contentType,
      }),
    );
  } catch {
    throw new Error("Storage copy failed");
  }
  const destination = await readStorageBytesExact(config, destinationKey);
  if (
    destination.bytes.length !== source.bytes.length
    || destination.contentHash !== source.contentHash
    || destination.contentType !== source.contentType
  ) {
    throw new Error("Storage copy verification failed");
  }
  if (input.onVerifiedBytes) {
    await input.onVerifiedBytes(destination.bytes).catch((err: unknown) => {
      // Classification only — never the key, which names a customer's object.
      log.warn(
        { errorName: err instanceof Error ? err.name : "unknown" },
        "A reader of a verified copy's bytes failed; the copy itself stands",
      );
    });
  }
  return {
    key: destinationKey,
    url: buildPublicUrl(config.publicUrl, destinationKey),
    byteSize: destination.bytes.length,
    contentHash: destination.contentHash,
    contentType: destination.contentType,
  };
}

export async function storageDelete(
  relKey: string
): Promise<{ success: true } | { success: false; errorCode: string; retryable: boolean }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  /*
    THE SMALL COPY DIES WITH ITS PICTURE (#1389).

    A signed view's thumbnail is a DERIVED key rather than a recorded one, so
    nothing in the database would ever point a cleanup at it — and an object no
    record names is exactly the litter this product's deletion road exists to
    prevent. Sweeping it HERE, at the one exported deletion primitive, covers
    every one of its call sites (the cleanup worker, the mint's own rollback,
    permanent Cast deletion) with nothing for any of them to remember.

    ⚠ **Narrow on purpose, and it must stay narrow.** `isViewThumbnailBearingKey`
    is false for everything that is not a signed view, so a garment, an avatar
    or an evidence crop issues no second request — a blanket rule would double
    the request count of the cleanup worker's bulk sweeps for a derivative that
    does not exist. It is also false for a derivative itself, so this cannot
    recurse.

    ⚠ **Its outcome is deliberately NOT part of this function's result.** The
    callers count deletions and retry the retryable; a missing thumbnail (every
    view signed before #1389 shipped) is the normal case, not a failure, and
    letting it reach that arithmetic would make a correct sweep look broken.
  */
  if (isViewThumbnailBearingKey(key)) {
    await getClient(config)
      .send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: withViewThumbnailSuffix(key),
      }))
      .catch((err: any) => {
        // Classification only — never the key, which names a customer's object.
        log.warn(
          { stage: "thumbnail", errorName: typeof err?.name === "string" ? err.name : "unknown" },
          "Could not sweep a view thumbnail; its picture is being deleted regardless",
        );
      });
  }

  try {
    await getClient(config).send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
    );
    return { success: true };
  } catch (err: any) {
    const status = Number(err?.$metadata?.httpStatusCode ?? err?.statusCode ?? 0);
    const rawCode = typeof err?.name === "string"
      ? err.name
      : typeof err?.Code === "string"
        ? err.Code
        : "STORAGE_DELETE_FAILED";
    const errorCode = rawCode.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 64) || "STORAGE_DELETE_FAILED";
    // Authentication, authorization and malformed-request failures will not
    // heal with retries. Network errors, throttling and 5xx responses may.
    const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
    // The exact key remains in the durable cleanup item for authorized support
    // repair. Production logs carry classification only — never keys, URLs or
    // raw provider text that may echo request details or credentials.
    log.warn({ errorCode, retryable, httpStatus: status || undefined }, "Storage delete failed");
    return { success: false, errorCode, retryable };
  }
}


/** Read-only bucket inventory for guarded orphan audits. Runtime product code
 * does not use this surface, and it never deletes or returns object bodies. */
export async function storageListKeys(): Promise<string[]> {
  const config = getStorageConfig();
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await getClient(config).send(new ListObjectsV2Command({
      Bucket: config.bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1_000,
    }));
    for (const object of page.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !continuationToken) {
      throw new Error("Storage listing returned a truncated page without a continuation token");
    }
  } while (continuationToken);
  return keys;
}
