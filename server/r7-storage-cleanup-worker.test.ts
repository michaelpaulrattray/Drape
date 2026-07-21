import { describe, expect, it } from "vitest";
import { storageCleanupRetryDelayMs } from "./casting/storageCleanupWorker";

describe("R7-5D storage-cleanup worker contract", () => {
  it("uses bounded exponential backoff", () => {
    expect([1, 2, 3, 4, 5, 20].map(storageCleanupRetryDelayMs)).toEqual([
      60_000,
      300_000,
      900_000,
      3_600_000,
      3_600_000,
      3_600_000,
    ]);
  });

  it("keeps the runtime worker off unless explicitly enabled", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(
      new URL("./casting/storageCleanupWorker.ts", import.meta.url),
      "utf8",
    ));
    expect(source).toContain('process.env.ENABLE_STORAGE_CLEANUP_WORKER !== "true"');
    expect(source).toContain("startup.unref?.()");
    expect(source).toContain("sweepTimer.unref?.()");
  });

  it("keeps failed storage keys and raw provider messages out of logs", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(
      new URL("./storage.ts", import.meta.url),
      "utf8",
    ));
    const deleteBlock = source.slice(source.indexOf("export async function storageDelete"), source.indexOf("export async function storageListKeys"));
    expect(deleteBlock).toContain(
      'log.warn({ errorCode, retryable, httpStatus: status || undefined }, "Storage delete failed")',
    );
    expect(deleteBlock).not.toContain("Storage delete failed for ${key}");
    expect(deleteBlock).not.toContain("err?.message ?? err");
  });
});
