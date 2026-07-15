/**
 * Batch B review correction 1 — the shared export-eligibility decision.
 *
 * Lifecycle read-state and export eligibility are separate contracts: a
 * status-minted model with no agencyId reads minted everywhere but is
 * INELIGIBLE to export (the pack prints the ID), refusing with repair copy
 * before any proxy/upscale/PDF/credit work. The zero-mutation property in
 * the hooks follows from this decision plus the guard-pinned ordering in
 * modelLifecycleGuard.test.ts (eligibility resolves before the first
 * mutation call in every export action).
 */
import { describe, it, expect, vi } from "vitest";
import {
  resolveExportEligibility,
  withExportEligibility,
  MISSING_AGENCY_ID_COPY,
} from "../shared/exportEligibility";

describe("resolveExportEligibility — the full status × agencyId table", () => {
  const ID = "MOD-26-A1B2C3";

  it("draft (no ID) → not_minted (mint-door routing)", () => {
    expect(resolveExportEligibility({ status: "draft", agencyId: null })).toEqual({ ok: false, reason: "not_minted" });
  });

  it("draft with a STRAY agencyId → still not_minted — the ID never makes it exportable", () => {
    expect(resolveExportEligibility({ status: "draft", agencyId: ID })).toEqual({ ok: false, reason: "not_minted" });
  });

  it("active with ID → eligible, returns the verified ID", () => {
    expect(resolveExportEligibility({ status: "active", agencyId: ID })).toEqual({ ok: true, agencyId: ID });
  });

  it("legacy locked with ID → eligible (minted by status)", () => {
    expect(resolveExportEligibility({ status: "locked", agencyId: ID })).toEqual({ ok: true, agencyId: ID });
  });

  it("active MISSING its ID → missing_agency_id — reads minted but may not export", () => {
    expect(resolveExportEligibility({ status: "active", agencyId: null })).toEqual({ ok: false, reason: "missing_agency_id" });
  });

  it("locked missing its ID → missing_agency_id (same integrity contract)", () => {
    expect(resolveExportEligibility({ status: "locked", agencyId: null })).toEqual({ ok: false, reason: "missing_agency_id" });
  });

  it("a whitespace-only ID counts as missing, never printed", () => {
    expect(resolveExportEligibility({ status: "active", agencyId: "   " })).toEqual({ ok: false, reason: "missing_agency_id" });
  });

  it("archived → not_minted even with the ID intact (FR-4: deleted everywhere)", () => {
    expect(resolveExportEligibility({ status: "archived", agencyId: ID })).toEqual({ ok: false, reason: "not_minted" });
  });

  it("unknown/missing status and missing model fail conservatively", () => {
    expect(resolveExportEligibility({ status: "somefuturestatus", agencyId: ID })).toEqual({ ok: false, reason: "not_minted" });
    expect(resolveExportEligibility({ agencyId: ID })).toEqual({ ok: false, reason: "not_minted" });
    expect(resolveExportEligibility(null)).toEqual({ ok: false, reason: "not_minted" });
    expect(resolveExportEligibility(undefined)).toEqual({ ok: false, reason: "not_minted" });
  });

  it("the repair copy names the problem without advertising a mint as the fix", () => {
    expect(MISSING_AGENCY_ID_COPY).toContain("missing its agency ID");
    expect(MISSING_AGENCY_ID_COPY.toLowerCase()).not.toContain("mint");
  });
});

// ── Final review round C: BEHAVIOR-LEVEL zero-mutation proof ────────────────
//
// withExportEligibility is the real action boundary every export flow runs
// through (useExportPack.downloadPdf/downloadZip, useCastingExport
// .handleExport — pinned by the literal guard). These tests EXECUTE that
// boundary with spied mutation functions and prove that on every rejected
// row the runner is never entered and every mutation call count stays zero.

describe("withExportEligibility — rejected exports make ZERO mutation calls", () => {
  function spies() {
    return {
      upscale: vi.fn().mockResolvedValue({ success: true, imageUrl: "u" }),
      proxyImage: vi.fn().mockResolvedValue({ success: true, base64: "data,AA" }),
      generatePdf: vi.fn().mockResolvedValue({ success: true, pdfBase64: "AA" }),
    };
  }
  /** A runner that would spend if it were ever entered — like the real
   *  export bodies, it calls every mutation it is handed. */
  const spendingRunner = async (agencyId: string, m: ReturnType<typeof spies>) => {
    await m.upscale({ imageUrl: "x", resolution: "2K" });
    await m.proxyImage({ imageUrl: "x" });
    await m.generatePdf({ modelId: 1, modelName: "X", images: {} });
    return agencyId;
  };

  const rejectedRows: Array<[string, { status: string; agencyId: string | null }, "not_minted" | "missing_agency_id"]> = [
    ["active, missing ID", { status: "active", agencyId: null }, "missing_agency_id"],
    ["locked, missing ID", { status: "locked", agencyId: null }, "missing_agency_id"],
    ["active, whitespace-only ID", { status: "active", agencyId: "   " }, "missing_agency_id"],
    ["locked, whitespace-only ID", { status: "locked", agencyId: "  " }, "missing_agency_id"],
    ["draft with a stray ID", { status: "draft", agencyId: "MOD-26-A1B2C3" }, "not_minted"],
  ];

  it.each(rejectedRows)("%s: refused, runner never entered, all mutation counts 0", async (_label, model, reason) => {
    const m = spies();
    const runner = vi.fn(spendingRunner);
    const outcome = await withExportEligibility(model, m, runner);
    expect(outcome).toEqual({ ok: false, reason });
    expect(runner).not.toHaveBeenCalled();
    expect(m.upscale).toHaveBeenCalledTimes(0);
    expect(m.proxyImage).toHaveBeenCalledTimes(0);
    expect(m.generatePdf).toHaveBeenCalledTimes(0);
  });

  it("an eligible row enters the runner exactly once with the TRIMMED verified ID and the same mutations", async () => {
    const m = spies();
    const runner = vi.fn(spendingRunner);
    const outcome = await withExportEligibility({ status: "locked", agencyId: "  MOD-26-LEGACY  " }, m, runner);
    expect(outcome).toEqual({ ok: true, value: "MOD-26-LEGACY" });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith("MOD-26-LEGACY", m);
    expect(m.upscale).toHaveBeenCalledTimes(1);
    expect(m.proxyImage).toHaveBeenCalledTimes(1);
    expect(m.generatePdf).toHaveBeenCalledTimes(1);
  });

  it("a runner failure propagates (the boundary adds no swallowing)", async () => {
    const m = spies();
    await expect(
      withExportEligibility({ status: "active", agencyId: "MOD-26-A1B2C3" }, m, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
