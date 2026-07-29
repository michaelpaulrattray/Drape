import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { resolvePdfPreferences } from "./casting/pdfPreferences";
import { buildExportPlan } from "../shared/exportPlan";
import {
  assertExportPlanMatchesAssets,
  canonicalExportAssets,
  claimExportRun,
  deliverAtomicIdentityPack,
  prepareExportViews,
  preparedPdfImages,
  requireCompleteExportViews,
  requireIdentityPdf,
} from "../client/src/features/export/prepareExportViews";

const assets = [
  { id: 1, viewType: "frontClose", storageUrl: "https://images.test/head" },
  { id: 2, viewType: "sideClose", storageUrl: "https://images.test/side" },
];

describe("D-74 fixed 1K export authority", () => {
  it("returns one zero-credit 1K contract", () => {
    expect(buildExportPlan(6)).toEqual({
      viewCount: 6,
      resolution: "1K",
      totalCost: 0,
    });
  });

  it("refuses a client asset set that no longer matches the package", () => {
    expect(() => assertExportPlanMatchesAssets(assets, 6))
      .toThrow("package changed");
    expect(() => assertExportPlanMatchesAssets(assets, 2)).not.toThrow();
  });

  it("has no paid export derivative, price, prompt, or callable service", () => {
    const plan = readFileSync(
      new URL("../shared/exportPlan.ts", import.meta.url),
      "utf8",
    );
    const preparation = readFileSync(
      new URL(
        "../client/src/features/export/prepareExportViews.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const route = readFileSync(
      new URL("./routes/generation/castingExport.ts", import.meta.url),
      "utf8",
    );
    const service = readFileSync(
      new URL("./casting/upscaleService.ts", import.meta.url),
      "utf8",
    );
    const prompts = readFileSync(
      new URL("./casting/geminiPrompts.ts", import.meta.url),
      "utf8",
    );
    const costs = readFileSync(
      new URL("./casting/castingCreditCosts.ts", import.meta.url),
      "utf8",
    );
    expect(plan).not.toMatch(/\b2K\b|\b4K\b|upscale/i);
    expect(preparation).not.toMatch(/\b2K\b|\b4K\b|upscale/i);
    expect(route).not.toContain("upscale: protectedProcedure");
    expect(service).not.toMatch(/export (?:async )?function|withAtomicCredits/);
    expect(prompts).not.toContain("UPSCALE_PROMPT");
    expect(costs).not.toMatch(/upscale\s*:|exportPack\s*:/);
  });
});

describe("1K Identity Pack preparation", () => {
  it("uses the selected package bytes for both ZIP and PDF", async () => {
    const proxyImage = vi.fn(
      async ({ imageUrl }: { imageUrl: string }) => ({
        success: true,
        base64: imageUrl.includes("head")
          ? "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ"
          : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg",
      }),
    );
    const prepared = await prepareExportViews({
      assets,
      mutations: { proxyImage },
    });
    expect(prepared.map((view) => view.deliveredResolution))
      .toEqual(["1K", "1K"]);
    expect(prepared.map((view) => view.deliveredUrl))
      .toEqual(assets.map((asset) => asset.storageUrl));
    expect(prepared[0].filename).toBe("01_Headshot_Primary.jpg");
    expect(prepared[1].filename).toBe("03_Profile_Head.png");
    const pdfImages = preparedPdfImages(prepared);
    expect(pdfImages.headshot).toBe(prepared[0].dataUrl);
    expect(pdfImages.profile).toBe(prepared[1].dataUrl);
  });

  it("marks an unavailable original as missing without a fallback spend", async () => {
    const onIssue = vi.fn();
    const prepared = await prepareExportViews({
      assets: assets.slice(0, 1),
      mutations: {
        proxyImage: vi.fn().mockRejectedValue(new Error("fetch failed")),
      },
      onIssue,
    });
    expect(prepared[0]).toMatchObject({
      deliveredResolution: "missing",
      deliveredUrl: null,
      dataUrl: null,
    });
    expect(onIssue).toHaveBeenCalledWith(
      expect.stringContaining("fetch failed"),
      "frontClose",
    );
  });

  it("prevents a same-tick duplicate submission", () => {
    const lock = { current: false };
    expect(claimExportRun(lock)).toBe(true);
    expect(claimExportRun(lock)).toBe(false);
  });

  it("uses the newest duplicate slot rather than stale history", () => {
    const duplicateAssets = [
      ...assets,
      {
        id: 3,
        viewType: "frontClose",
        storageUrl: "https://images.test/head-new",
      },
    ];
    expect(
      canonicalExportAssets(duplicateAssets)
        .find((asset) => asset.viewType === "frontClose")
        ?.storageUrl,
    ).toBe("https://images.test/head-new");
  });
});

describe("atomic Identity Pack and PDF truth", () => {
  it("requires every prepared view and a successful named PDF", () => {
    const complete = Array.from({ length: 6 }, (_, index) => ({
      viewType: "frontClose",
      sourceUrl: `source-${index}`,
      deliveredUrl: `delivered-${index}`,
      deliveredResolution: "1K",
      dataUrl: "data:image/png;base64,AA==",
      filename: `${index}.png`,
      issues: [],
    })) as any;
    expect(() => requireCompleteExportViews(complete, 6)).not.toThrow();
    expect(() =>
      requireCompleteExportViews([{ ...complete[0], dataUrl: null }], 1)
    ).toThrow("could not be prepared");
    expect(requireIdentityPdf({
      success: true,
      pdfBase64: "cGRm",
      filename: "identity.pdf",
    })).toEqual({ pdfBase64: "cGRm", filename: "identity.pdf" });
    expect(() => requireIdentityPdf({ success: false }))
      .toThrow("identity document could not be created");
  });

  it("does not build or deliver an archive when the PDF fails", async () => {
    const buildArchive = vi.fn(async () => new Blob());
    const deliver = vi.fn();
    await expect(deliverAtomicIdentityPack({
      generatePdf: vi.fn(async () => ({ success: false })),
      buildArchive,
      deliver,
    })).rejects.toThrow("identity document could not be created");
    expect(buildArchive).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it("prints the stored model name and an honest 1K record", () => {
    const route = readFileSync(
      new URL("./routes/generation/castingExport.ts", import.meta.url),
      "utf8",
    );
    const service = readFileSync(
      new URL("./casting/pdfService.ts", import.meta.url),
      "utf8",
    );
    expect(route)
      .toContain("modelName: model.name?.trim() || 'Unnamed Model'");
    expect(service).toContain("data.modelName.toUpperCase()");
    expect(service).toContain("1K (1024\\u00D71024)");
    expect(service).not.toContain("2K (2048");
  });

  it("preserves persisted PDF preferences without overwriting known schema", () => {
    const prefs = resolvePdfPreferences(
      { subject: { gender: "Female" }, hair: { style: "Center part" } },
      {
        gender: "Male",
        hairStyle: "Waves",
        hairLength: "Very Long",
        eyeColor: "Hazel",
      },
    );
    expect(prefs.gender).toBe("Female");
    expect(prefs.hairStyle).toBe("Center part");
    expect(prefs.hairLength).toBe("Very Long");
    expect(prefs.eyeColor).toBe("Hazel");
  });
});
