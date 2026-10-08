/**
 * Batch 3 Hardening Tests
 * - Fix 12: Placeholder image detection
 * - Fix 13: Dead code removal (compile-time verification)
 * - Fix 14: Account deletion (GDPR)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { allowColdImports } from "./testing/suiteClocks";

/* This file's tests are dominated by cold module loading, not by logic —
   see `suiteClocks.ts` for the flake this ends and why the raise is
   here rather than global (fable-233 §5). */
allowColdImports();

// ─── Fix 12: Placeholder Detection ────────────────────────────────────────

describe("Placeholder Image Detection", () => {
  let detection: typeof import("./casting/placeholderDetection");

  beforeEach(async () => {
    vi.resetModules();
    detection = await import("./casting/placeholderDetection");
  });

  it("rejects empty base64 string", () => {
    expect(detection.isPlaceholderImage("")).toBe(true);
  });

  it("rejects very small images (< 5KB)", () => {
    // Create a base64 string representing < 5KB of data
    const tinyImage = Buffer.from("x".repeat(100)).toString("base64");
    expect(detection.isPlaceholderImage(tinyImage)).toBe(true);
  });

  it("detects uniform color images via low variance", () => {
    // Create a buffer of all identical bytes (simulates solid gray)
    const uniformBytes = new Uint8Array(10000).fill(128);
    const base64 = Buffer.from(uniformBytes).toString("base64");
    expect(detection.isPlaceholderImage(base64)).toBe(true);
  });

  it("accepts images with varied byte content", () => {
    // Create pseudo-random bytes that simulate a real image with high variance
    const variedBytes = new Uint8Array(10000);
    for (let i = 0; i < variedBytes.length; i++) {
      variedBytes[i] = (i * 37 + 127) % 256;
    }
    const base64 = Buffer.from(variedBytes).toString("base64");
    expect(detection.isPlaceholderImage(base64)).toBe(false);
  });

  it("validateNotPlaceholder skips non-data-URL strings", () => {
    // Should not throw for regular URLs
    expect(() => {
      detection.validateNotPlaceholder("https://storage.example.com/image.png");
    }).not.toThrow();
  });

  it("validateNotPlaceholder throws for placeholder data URLs", () => {
    // Create a solid-color image as data URL
    const uniformBytes = new Uint8Array(10000).fill(200);
    const base64 = Buffer.from(uniformBytes).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    expect(() => {
      detection.validateNotPlaceholder(dataUrl);
    }).toThrow("blank image");
  });
});

// ─── Fix 14: Account Deletion ──────────────────────────────────────────────

/*
  ⚠ **"Fix 14: Account Deletion" IS NOW ONE PROCEDURE, NOT TWO — #1962, and the
  two arms that stood here are retired rather than moved.**

  They asserted that `accountRouter` EXPORTS a `deleteAccount` procedure and
  that its schema refuses a wrong confirmation phrase. That procedure is gone:
  it was the app's unused second erasure entrance, with a rate limit that
  enforced nothing. Keeping the arms pointed at `auth.deleteAccount` instead
  would be a rename rather than a decision — the surviving entrance has its own
  coverage, and what is actually owed here is the opposite claim.

  **`server/accountErasureEntrance.test.ts` carries it**: exactly one procedure
  erases an account, the retired one does not come back, and the survivor keeps
  its cookie clear and its refusal. It is an ABSENCE test, in the shape the
  deleted public Cast registry's already uses, and it holds a positive control
  so it cannot pass by the capability having vanished altogether.
*/

describe("Account Deletion DB Helper", () => {
  it("exports deleteUserAccount function", async () => {
    const { deleteUserAccount } = await import("./db/accountDeletion");
    expect(typeof deleteUserAccount).toBe("function");
  });
});

// ─── Fix 13: Dead Code Removal ────────────────────────────────────────────

describe("Dead Code Removal - generateAllViews", () => {
  it("generateAllViews procedure no longer exists in castingImaging router", async () => {
    const { castingImagingRouter } = await import("./routes/generation/castingImaging");
    const procedures = castingImagingRouter._def.procedures;
    expect(procedures).not.toHaveProperty("generateAllViews");
  });

  // D-46 (stage-lock unification): the ungated view-generation endpoints were
  // removed — they added back/walk/side views with NO identity gate (the D-43
  // bypass class). All view generation now flows through mintPackage, which
  // gates back/walk. There must be no ungated view endpoint.
  it("multiView procedure is REMOVED (ungated view path closed)", async () => {
    const { castingImagingRouter } = await import("./routes/generation/castingImaging");
    const procedures = castingImagingRouter._def.procedures;
    expect(procedures).not.toHaveProperty("multiView");
  });

  it("fullBody procedure is REMOVED (ungated view path closed)", async () => {
    const { castingImagingRouter } = await import("./routes/generation/castingImaging");
    const procedures = castingImagingRouter._def.procedures;
    expect(procedures).not.toHaveProperty("fullBody");
  });
});
