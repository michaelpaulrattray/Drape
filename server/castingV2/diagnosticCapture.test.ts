/**
 * The flag ships DARK, so the test that matters most is that the dark path
 * writes nothing, asks nothing and cannot be reached — a deploy of this must
 * change production not at all.
 *
 * And then the half the founder's approval actually turns on: it never reaches
 * the public bucket, it never breaks a render, and it refuses to boot in a
 * configuration where the frames it keeps would never be purged.
 */
import { describe, expect, it } from "vitest";

import {
  CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV,
  DIAGNOSTIC_KEY_PREFIX,
  DiagnosticCaptureConfigurationError,
  MAX_DIAGNOSTIC_BYTES,
  assertDiagnosticCaptureConfigured,
  captureRefusedRender,
  diagnosticCaptureEnabledFor,
  diagnosticKey,
} from "./diagnosticCapture";

const CONFIGURED: NodeJS.ProcessEnv = {
  R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  R2_BUCKET: "public-bucket",
  R2_ACCESS_KEY_ID: "public-key",
  R2_SECRET_ACCESS_KEY: "public-secret",
  R2_EVIDENCE_BUCKET: "private-evidence",
  R2_EVIDENCE_ACCESS_KEY_ID: "private-key",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "private-secret",
  ENABLE_STORAGE_CLEANUP_WORKER: "true",
};

const frame = (name: string, size = 1024) => ({ name, bytes: Buffer.alloc(size, 7) });

function recordingWriter() {
  const wrote: { key: string; bytes: number }[] = [];
  return {
    wrote,
    writer: async ({ key, bytes }: { key: string; bytes: Buffer }) => {
      wrote.push({ key, bytes: bytes.byteLength });
    },
  };
}

describe("the flag is off, and off means nothing happens", () => {
  it("is off when absent", () => {
    expect(diagnosticCaptureEnabledFor(1, undefined)).toBe(false);
    expect(diagnosticCaptureEnabledFor(1, "off")).toBe(false);
  });

  it("is scoped to a named account, never to everyone by accident", () => {
    expect(diagnosticCaptureEnabledFor(1, "users:1")).toBe(true);
    expect(diagnosticCaptureEnabledFor(2, "users:1")).toBe(false);
    expect(diagnosticCaptureEnabledFor(undefined, "users:1"), "unattributed never opts in").toBe(false);
  });

  it("writes nothing at all while dark", async () => {
    const { wrote, writer } = recordingWriter();
    const result = await captureRefusedRender({
      userId: 1,
      operationId: "op-1",
      reason: "facts_missing",
      frames: [frame("composite")],
      writer,
      env: { ...CONFIGURED, [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "off" },
    });
    expect(result.captured).toBe(false);
    expect(result.reason).toBe("not in scope");
    expect(wrote, "a dark path that still writes is not dark").toEqual([]);
  });
});

describe("what it keeps, and where", () => {
  const env = { ...CONFIGURED, [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1" };

  it("keeps every frame under an owner-scoped key", async () => {
    const { wrote, writer } = recordingWriter();
    const result = await captureRefusedRender({
      userId: 1,
      operationId: "5afc8b62-b94b-4f41-b890-0f98efd71ebb",
      reason: "facts_missing",
      frames: [frame("painted"), frame("composite")],
      writer,
      env,
    });
    expect(result.captured).toBe(true);
    expect(wrote.map((row) => row.key)).toEqual([
      `${DIAGNOSTIC_KEY_PREFIX}/1/5afc8b62-b94b-4f41-b890-0f98efd71ebb/painted.png`,
      `${DIAGNOSTIC_KEY_PREFIX}/1/5afc8b62-b94b-4f41-b890-0f98efd71ebb/composite.png`,
    ]);
  });

  it("never writes a key outside its own prefix", () => {
    const key = diagnosticKey({ userId: 1, operationId: "op", name: "painted" });
    expect(key.startsWith(`${DIAGNOSTIC_KEY_PREFIX}/`)).toBe(true);
  });

  it("skips a frame outside the size bounds rather than storing it", async () => {
    const { wrote, writer } = recordingWriter();
    const result = await captureRefusedRender({
      userId: 1,
      operationId: "op-2",
      reason: "composite_fault",
      frames: [
        { name: "empty", bytes: Buffer.alloc(0) },
        { name: "huge", bytes: Buffer.alloc(MAX_DIAGNOSTIC_BYTES + 1) },
        frame("fine"),
      ],
      writer,
      env,
    });
    expect(wrote.map((row) => row.key.split("/").pop())).toEqual(["fine.png"]);
    expect(result.captured).toBe(true);
  });

  it("NEVER breaks the render it is diagnosing", async () => {
    /* The caller is already refusing and refunding. A capture failure that
       became a different error would make the diagnostics worse than useless. */
    const result = await captureRefusedRender({
      userId: 1,
      operationId: "op-3",
      reason: "facts_missing",
      frames: [frame("composite")],
      writer: async () => { throw new Error("bucket on fire"); },
      env,
    });
    expect(result.captured).toBe(false);
  });

  it("refuses to invent a bucket when the configuration is missing", async () => {
    const { wrote, writer } = recordingWriter();
    const result = await captureRefusedRender({
      userId: 1,
      operationId: "op-4",
      reason: "facts_missing",
      frames: [frame("composite")],
      /* No writer injected, and no private bucket configured: it must not fall
         back to the public one. */
      env: {
        [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
        R2_ENDPOINT: CONFIGURED.R2_ENDPOINT,
        R2_BUCKET: "public-bucket",
      },
    });
    expect(result.captured).toBe(false);
    expect(result.reason).toBe("unconfigured");
    expect(wrote).toEqual([]);
  });
});

describe("the boot guard refuses rather than degrading", () => {
  it("asserts nothing when the flag is absent — the 2026-07-31 lesson", () => {
    /* Production crash-looped on evidence boot guards. The default configuration
       must make no demands at all. */
    expect(() => assertDiagnosticCaptureConfigured({})).not.toThrow();
    expect(() => assertDiagnosticCaptureConfigured({ [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "off" }))
      .not.toThrow();
  });

  it("refuses to start with capture on and no purge", () => {
    expect(() => assertDiagnosticCaptureConfigured({
      ...CONFIGURED,
      ENABLE_STORAGE_CLEANUP_WORKER: undefined,
      [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
    })).toThrow(DiagnosticCaptureConfigurationError);
  });

  it("refuses to start with capture on and no private bucket", () => {
    expect(() => assertDiagnosticCaptureConfigured({
      R2_ENDPOINT: CONFIGURED.R2_ENDPOINT,
      R2_BUCKET: "public-bucket",
      ENABLE_STORAGE_CLEANUP_WORKER: "true",
      [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
    })).toThrow(/private evidence bucket/);
  });

  it("starts when the founder's approved shape is configured", () => {
    expect(() => assertDiagnosticCaptureConfigured({
      ...CONFIGURED,
      [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
    })).not.toThrow();
  });
});
