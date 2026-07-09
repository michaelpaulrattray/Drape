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
): Promise<{ success: boolean }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  try {
    await getClient(config).send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
    );
    return { success: true };
  } catch (err: any) {
    log.warn(`Storage delete failed for ${key}: ${err?.message ?? err}`);
    return { success: false };
  }
}
