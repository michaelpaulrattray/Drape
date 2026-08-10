import {
  DeleteObjectCommand,
  type DeleteObjectCommandOutput,
  GetObjectCommand,
  type GetObjectCommandOutput,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
  type PutObjectCommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";
import { supportedImageMime } from "../../security/trustedImageFetch";
import {
  EvidenceDeliveryError,
  isPrivateEvidenceDeletableKey,
  parseEvidenceStorageKey,
  type EvidenceDeleteResult,
  type PrivateEvidenceStorageAdapter,
} from "./evidenceDelivery";
import {
  EVIDENCE_CANONICAL_MIME,
  MAX_EVIDENCE_CANONICAL_BYTES,
} from "./imageValidation";

export const PRIVATE_EVIDENCE_BUCKET_ENV = "R2_EVIDENCE_BUCKET";
export const PRIVATE_EVIDENCE_ACCESS_KEY_ENV = "R2_EVIDENCE_ACCESS_KEY_ID";
export const PRIVATE_EVIDENCE_SECRET_KEY_ENV = "R2_EVIDENCE_SECRET_ACCESS_KEY";
const MAX_PRIVATE_EVIDENCE_LIST_KEYS = 100_000;

export interface PrivateEvidenceStorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class PrivateEvidenceStorageConfigurationError extends Error {
  constructor() {
    super(
      "Private evidence storage must be either fully unconfigured or provide its bucket and dedicated credentials.",
    );
    this.name = "PrivateEvidenceStorageConfigurationError";
  }
}

export type PrivateEvidenceStorageErrorCode =
  | "invalid_payload"
  | "read_failed"
  | "read_size_mismatch"
  | "write_failed"
  | "list_failed"
  | "list_limit_exceeded";

export class PrivateEvidenceStorageError extends Error {
  readonly code: PrivateEvidenceStorageErrorCode;

  constructor(code: PrivateEvidenceStorageErrorCode) {
    super("Evidence storage is temporarily unavailable.");
    this.name = "PrivateEvidenceStorageError";
    this.code = code;
  }
}

export interface EvidenceS3Client {
  send(command: PutObjectCommand): Promise<PutObjectCommandOutput>;
  send(command: GetObjectCommand): Promise<GetObjectCommandOutput>;
  send(command: DeleteObjectCommand): Promise<DeleteObjectCommandOutput>;
  send(command: ListObjectsV2Command): Promise<ListObjectsV2CommandOutput>;
}

function present(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Parse the private adapter independently from the permanent-public R2
 * client. Partial configuration is an operator error; a completely absent
 * configuration is the valid scope-off state.
 */
export function parsePrivateEvidenceStorageConfig(
  env: NodeJS.ProcessEnv,
): PrivateEvidenceStorageConfig | null {
  const endpoint = env.R2_ENDPOINT;
  const bucket = env[PRIVATE_EVIDENCE_BUCKET_ENV];
  const accessKeyId = env[PRIVATE_EVIDENCE_ACCESS_KEY_ENV];
  const secretAccessKey = env[PRIVATE_EVIDENCE_SECRET_KEY_ENV];
  const dedicatedValues = [bucket, accessKeyId, secretAccessKey];
  if (dedicatedValues.every((value) => !present(value))) return null;
  if (
    !present(endpoint)
    || !present(bucket)
    || !present(accessKeyId)
    || !present(secretAccessKey)
    || bucket !== bucket.trim()
    || accessKeyId !== accessKeyId.trim()
    || secretAccessKey !== secretAccessKey.trim()
    || bucket === env.R2_BUCKET
    || accessKeyId === env.R2_ACCESS_KEY_ID
    || secretAccessKey === env.R2_SECRET_ACCESS_KEY
  ) {
    throw new PrivateEvidenceStorageConfigurationError();
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function privateEvidenceClient(config: PrivateEvidenceStorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function destroyBody(body: unknown): void {
  if (
    body
    && typeof body === "object"
    && "destroy" in body
    && typeof body.destroy === "function"
  ) {
    body.destroy();
  }
}

function iterableBody(body: unknown): AsyncIterable<unknown> {
  if (
    body
    && typeof body === "object"
    && Symbol.asyncIterator in body
    && typeof body[Symbol.asyncIterator] === "function"
  ) {
    return body as AsyncIterable<unknown>;
  }
  throw new PrivateEvidenceStorageError("read_failed");
}

function boundedBody(input: {
  body: unknown;
  expectedByteSize: number;
}): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      let delivered = 0;
      try {
        for await (const rawChunk of iterableBody(input.body)) {
          if (
            !(rawChunk instanceof Uint8Array)
            && typeof rawChunk !== "string"
          ) {
            throw new PrivateEvidenceStorageError("read_failed");
          }
          const chunk = typeof rawChunk === "string"
            ? Buffer.from(rawChunk)
            : rawChunk;
          delivered += chunk.byteLength;
          if (
            delivered > input.expectedByteSize
            || delivered > MAX_EVIDENCE_CANONICAL_BYTES
          ) {
            throw new PrivateEvidenceStorageError("read_size_mismatch");
          }
          yield chunk;
        }
        if (delivered !== input.expectedByteSize) {
          throw new PrivateEvidenceStorageError("read_size_mismatch");
        }
      } catch (error) {
        if (error instanceof PrivateEvidenceStorageError) throw error;
        throw new PrivateEvidenceStorageError("read_failed");
      } finally {
        destroyBody(input.body);
      }
    },
  };
}

function deleteFailure(error: unknown): EvidenceDeleteResult {
  const metadata = (
    error
    && typeof error === "object"
    && "$metadata" in error
    && error.$metadata
    && typeof error.$metadata === "object"
  ) ? error.$metadata as { httpStatusCode?: unknown } : undefined;
  const status = Number(metadata?.httpStatusCode ?? 0);
  if (status === 400 || status === 404) {
    return {
      success: false,
      errorCode: "private_storage_invalid_request",
      retryable: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      success: false,
      errorCode: "private_storage_refused",
      retryable: false,
    };
  }
  return {
    success: false,
    errorCode: "private_storage_unavailable",
    retryable: status === 0 || status === 408 || status === 429 || status >= 500,
  };
}

export function createPrivateEvidenceStorageAdapter(
  config: PrivateEvidenceStorageConfig,
  client: EvidenceS3Client = privateEvidenceClient(config),
): PrivateEvidenceStorageAdapter {
  return {
    async putCanonical(key, bytes, mime) {
      parseEvidenceStorageKey(key);
      if (
        mime !== EVIDENCE_CANONICAL_MIME
        || bytes.byteLength === 0
        || bytes.byteLength > MAX_EVIDENCE_CANONICAL_BYTES
        || supportedImageMime(Buffer.from(
          bytes.buffer as ArrayBuffer,
          bytes.byteOffset,
          bytes.byteLength,
        )) !== EVIDENCE_CANONICAL_MIME
      ) {
        throw new PrivateEvidenceStorageError("invalid_payload");
      }
      try {
        await client.send(new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentType: EVIDENCE_CANONICAL_MIME,
          ContentLength: bytes.byteLength,
        }));
      } catch {
        throw new PrivateEvidenceStorageError("write_failed");
      }
      return { key };
    },

    async readCanonical(input) {
      parseEvidenceStorageKey(input.key);
      if (
        !Number.isSafeInteger(input.expectedByteSize)
        || input.expectedByteSize <= 0
        || input.expectedByteSize > MAX_EVIDENCE_CANONICAL_BYTES
      ) {
        throw new PrivateEvidenceStorageError("read_size_mismatch");
      }
      let response: GetObjectCommandOutput;
      try {
        response = await client.send(new GetObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
        }));
      } catch {
        throw new PrivateEvidenceStorageError("read_failed");
      }
      const contentLength = Number(response.ContentLength);
      if (
        response.ContentType !== EVIDENCE_CANONICAL_MIME
        || !Number.isSafeInteger(contentLength)
        || contentLength !== input.expectedByteSize
        || !response.Body
      ) {
        destroyBody(response.Body);
        throw new PrivateEvidenceStorageError("read_size_mismatch");
      }
      return {
        key: input.key,
        mime: EVIDENCE_CANONICAL_MIME,
        byteSize: input.expectedByteSize,
        body: boundedBody({
          body: response.Body,
          expectedByteSize: input.expectedByteSize,
        }),
        abort: () => destroyBody(response.Body),
      };
    },

    async resolveOwnerDelivery(userId, key) {
      const parsed = parseEvidenceStorageKey(key);
      if (parsed.userId !== userId) {
        throw new EvidenceDeliveryError("owner_mismatch");
      }
      return `/api/evidence/${parsed.kind}/${parsed.entityId}`;
    },

    async deleteExact(key) {
      /* Every shape this bucket legitimately holds, enumerated — the evidence
         keys AND the casting diagnostic frames. See
         `isPrivateEvidenceDeletableKey`: guarding with the evidence parser
         alone is what left six of the founder's frames undeletable. */
      if (!isPrivateEvidenceDeletableKey(key)) {
        return {
          success: false,
          errorCode: "private_storage_invalid_request",
          retryable: false,
        };
      }
      try {
        await client.send(new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        return { success: true };
      } catch (error) {
        return deleteFailure(error);
      }
    },

    async listCanonicalKeys(input = {}) {
      const maxKeys = input.maxKeys ?? 10_000;
      if (
        !Number.isSafeInteger(maxKeys)
        || maxKeys <= 0
        || maxKeys > MAX_PRIVATE_EVIDENCE_LIST_KEYS
      ) {
        throw new PrivateEvidenceStorageError("list_limit_exceeded");
      }
      const keys: string[] = [];
      let continuationToken: string | undefined;
      const seenTokens = new Set<string>();
      do {
        let page: ListObjectsV2CommandOutput;
        try {
          page = await client.send(new ListObjectsV2Command({
            Bucket: config.bucket,
            ContinuationToken: continuationToken,
            MaxKeys: Math.min(1_000, maxKeys - keys.length),
          }));
        } catch {
          throw new PrivateEvidenceStorageError("list_failed");
        }
        for (const object of page.Contents ?? []) {
          if (!object.Key) continue;
          try {
            parseEvidenceStorageKey(object.Key);
          } catch {
            throw new PrivateEvidenceStorageError("list_failed");
          }
          keys.push(object.Key);
          if (keys.length > maxKeys) {
            throw new PrivateEvidenceStorageError("list_limit_exceeded");
          }
        }
        if (!page.IsTruncated) break;
        const next = page.NextContinuationToken;
        if (!next || seenTokens.has(next) || keys.length >= maxKeys) {
          throw new PrivateEvidenceStorageError(
            keys.length >= maxKeys ? "list_limit_exceeded" : "list_failed",
          );
        }
        seenTokens.add(next);
        continuationToken = next;
      } while (true);
      return keys.sort();
    },
  };
}

let cachedConfiguredAdapter: PrivateEvidenceStorageAdapter | null | undefined;

/** Infrastructure-only access in C5B. Product routes stay disabled until C5C. */
export function getConfiguredPrivateEvidenceStorageAdapter():
PrivateEvidenceStorageAdapter | null {
  if (cachedConfiguredAdapter !== undefined) return cachedConfiguredAdapter;
  const config = parsePrivateEvidenceStorageConfig(process.env);
  cachedConfiguredAdapter = config
    ? createPrivateEvidenceStorageAdapter(config)
    : null;
  return cachedConfiguredAdapter;
}
