import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  PrivateEvidenceStorageConfigurationError,
  PrivateEvidenceStorageError,
  createPrivateEvidenceStorageAdapter,
  parsePrivateEvidenceStorageConfig,
  type EvidenceS3Client,
} from "./privateEvidenceStorage";

const plateId = "10000000-0000-4000-8000-000000000001";
const key = `users/1/models/4/evidence/plates/${plateId}.webp`;
const config = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  bucket: "private-evidence",
  accessKeyId: "dedicated-id",
  secretAccessKey: "dedicated-secret",
};
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);

function client(
  send: (command: unknown) => Promise<unknown>,
): EvidenceS3Client {
  return { send } as EvidenceS3Client;
}

function body(chunks: readonly Uint8Array[]) {
  return {
    destroy: vi.fn(),
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

async function collect(source: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of source) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe("R7-7C5B private evidence adapter", () => {
  it("accepts only an absent or complete dedicated configuration", () => {
    expect(parsePrivateEvidenceStorageConfig({ R2_ENDPOINT: config.endpoint }))
      .toBeNull();
    expect(() => parsePrivateEvidenceStorageConfig({
      R2_ENDPOINT: config.endpoint,
      R2_EVIDENCE_BUCKET: config.bucket,
    })).toThrow(PrivateEvidenceStorageConfigurationError);
    expect(() => parsePrivateEvidenceStorageConfig({
      R2_ENDPOINT: config.endpoint,
      R2_BUCKET: config.bucket,
      R2_ACCESS_KEY_ID: config.accessKeyId,
      R2_SECRET_ACCESS_KEY: config.secretAccessKey,
      R2_EVIDENCE_BUCKET: config.bucket,
      R2_EVIDENCE_ACCESS_KEY_ID: config.accessKeyId,
      R2_EVIDENCE_SECRET_ACCESS_KEY: config.secretAccessKey,
    })).toThrow(PrivateEvidenceStorageConfigurationError);
    expect(parsePrivateEvidenceStorageConfig({
      R2_ENDPOINT: config.endpoint,
      R2_EVIDENCE_BUCKET: config.bucket,
      R2_EVIDENCE_ACCESS_KEY_ID: config.accessKeyId,
      R2_EVIDENCE_SECRET_ACCESS_KEY: config.secretAccessKey,
    })).toEqual(config);
  });

  it("puts only canonical WebP bytes at the exact private key", async () => {
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      const input = (command as PutObjectCommand).input;
      expect(input).toMatchObject({
        Bucket: config.bucket,
        Key: key,
        ContentType: "image/webp",
        ContentLength: webp.length,
      });
      expect(input.Body).toBe(webp);
      return {};
    });
    const adapter = createPrivateEvidenceStorageAdapter(config, client(send));
    await expect(adapter.putCanonical(key, webp, "image/webp"))
      .resolves.toEqual({ key });
    await expect(adapter.putCanonical(`${key}.jpg`, webp, "image/webp"))
      .rejects.toMatchObject({ code: "invalid_key" });
    expect(send).toHaveBeenCalledTimes(1);

    const failing = createPrivateEvidenceStorageAdapter(config, client(async () => {
      throw new Error("credential-and-key-detail");
    }));
    const error = await failing.putCanonical(key, webp, "image/webp")
      .catch((caught) => caught);
    expect(error).toEqual(new PrivateEvidenceStorageError("write_failed"));
    expect(JSON.stringify(error)).not.toContain("credential-and-key-detail");
  });

  it("streams an exact declared byte count and destroys the body afterward", async () => {
    const responseBody = body([webp.subarray(0, 5), webp.subarray(5)]);
    const adapter = createPrivateEvidenceStorageAdapter(config, client(async (command) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      return {
        ContentType: "image/webp",
        ContentLength: webp.length,
        Body: responseBody,
      };
    }));
    const object = await adapter.readCanonical({
      key,
      expectedByteSize: webp.length,
    });
    await expect(collect(object.body)).resolves.toEqual(webp);
    expect(responseBody.destroy).toHaveBeenCalledTimes(1);
  });

  it("offers explicit abort and destroys an early-abandoned stream", async () => {
    const responseBody = body([webp.subarray(0, 4), webp.subarray(4)]);
    const adapter = createPrivateEvidenceStorageAdapter(config, client(async () => ({
      ContentType: "image/webp",
      ContentLength: webp.length,
      Body: responseBody,
    })));
    const object = await adapter.readCanonical({
      key,
      expectedByteSize: webp.length,
    });
    object.abort();
    expect(responseBody.destroy).toHaveBeenCalledTimes(1);

    const secondBody = body([webp.subarray(0, 4), webp.subarray(4)]);
    const second = await createPrivateEvidenceStorageAdapter(
      config,
      client(async () => ({
        ContentType: "image/webp",
        ContentLength: webp.length,
        Body: secondBody,
      })),
    ).readCanonical({ key, expectedByteSize: webp.length });
    for await (const _chunk of second.body) break;
    expect(secondBody.destroy).toHaveBeenCalledTimes(1);
  });

  it("refuses lying headers, truncated streams and oversized streams opaquely", async () => {
    const wrongHeaderBody = body([webp]);
    const wrongHeader = createPrivateEvidenceStorageAdapter(config, client(async () => ({
      ContentType: "image/webp",
      ContentLength: webp.length - 1,
      Body: wrongHeaderBody,
    })));
    await expect(wrongHeader.readCanonical({
      key,
      expectedByteSize: webp.length,
    })).rejects.toEqual(new PrivateEvidenceStorageError("read_size_mismatch"));
    expect(wrongHeaderBody.destroy).toHaveBeenCalledTimes(1);

    for (const chunks of [
      [webp.subarray(0, webp.length - 1)],
      [webp, Buffer.from([0])],
    ]) {
      const streamBody = body(chunks);
      const adapter = createPrivateEvidenceStorageAdapter(config, client(async () => ({
        ContentType: "image/webp",
        ContentLength: webp.length,
        Body: streamBody,
      })));
      const object = await adapter.readCanonical({
        key,
        expectedByteSize: webp.length,
      });
      await expect(collect(object.body)).rejects.toEqual(
        new PrivateEvidenceStorageError("read_size_mismatch"),
      );
      expect(streamBody.destroy).toHaveBeenCalledTimes(1);
    }
  });

  it("returns only closed delete classifications and never calls storage for invalid keys", async () => {
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      throw { $metadata: { httpStatusCode: 503 }, message: "secret provider detail" };
    });
    const adapter = createPrivateEvidenceStorageAdapter(config, client(send));
    await expect(adapter.deleteExact(`${key}.bad`)).resolves.toEqual({
      success: false,
      errorCode: "private_storage_invalid_request",
      retryable: false,
    });
    expect(send).not.toHaveBeenCalled();
    await expect(adapter.deleteExact(key)).resolves.toEqual({
      success: false,
      errorCode: "private_storage_unavailable",
      retryable: true,
    });
    expect(JSON.stringify(await adapter.deleteExact(key)))
      .not.toContain("secret provider detail");

    const refused = createPrivateEvidenceStorageAdapter(config, client(async () => {
      throw { $metadata: { httpStatusCode: 403 } };
    }));
    await expect(refused.deleteExact(key)).resolves.toEqual({
      success: false,
      errorCode: "private_storage_refused",
      retryable: false,
    });
  });

  it("resolves only owner-bound same-origin routes", async () => {
    const adapter = createPrivateEvidenceStorageAdapter(config, client(vi.fn()));
    await expect(adapter.resolveOwnerDelivery(1, key))
      .resolves.toBe(`/api/evidence/plate/${plateId}`);
    await expect(adapter.resolveOwnerDelivery(2, key))
      .rejects.toMatchObject({ code: "owner_mismatch" });
  });

  it("lists through bounded pagination and refuses noncanonical bucket residue", async () => {
    const cropId = "20000000-0000-4000-8000-000000000002";
    const cropKey = `users/2/models/5/evidence/crops/${cropId}.webp`;
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(ListObjectsV2Command);
      const token = (command as ListObjectsV2Command).input.ContinuationToken;
      return token
        ? { Contents: [{ Key: cropKey }], IsTruncated: false }
        : {
          Contents: [{ Key: key }],
          IsTruncated: true,
          NextContinuationToken: "page-2",
        };
    });
    const adapter = createPrivateEvidenceStorageAdapter(config, client(send));
    await expect(adapter.listCanonicalKeys({ maxKeys: 3 }))
      .resolves.toEqual([key, cropKey].sort());
    expect(send).toHaveBeenCalledTimes(2);

    const malformed = createPrivateEvidenceStorageAdapter(config, client(async () => ({
      Contents: [{ Key: "wrong-prefix/object.webp" }],
      IsTruncated: false,
    })));
    await expect(malformed.listCanonicalKeys())
      .rejects.toMatchObject({ code: "list_failed" });
  });

  it("contains no public or presigned delivery escape hatch", async () => {
    const source = await readFile(
      new URL("./privateEvidenceStorage.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /R2_EVIDENCE_PUBLIC_URL|R2_PUBLIC_URL|getSignedUrl|presign|publicUrl/i,
    );
    expect(source).toContain("R2_EVIDENCE_ACCESS_KEY_ID");
    expect(source).toContain("R2_EVIDENCE_SECRET_ACCESS_KEY");
  });
});
