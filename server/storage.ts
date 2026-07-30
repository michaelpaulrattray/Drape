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

async function readStorageBytesExact(
  config: StorageConfig,
  key: string,
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
    || !response.ContentType.startsWith("image/")
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
