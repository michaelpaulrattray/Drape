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
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
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
