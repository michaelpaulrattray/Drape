import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { readFileSync } from "node:fs";
import { CREDIT_COSTS } from "./casting/aiService";
import { resolvePdfPreferences } from "./casting/pdfPreferences";
import {
  buildExportPlan,
  exportPackResolutionSuffix,
  summarizeExportOutcomes,
} from "../shared/exportPlan";
import {
  assertExportPlanMatchesAssets,
  claimExportRun,
  canonicalExportAssets,
  prepareExportViews,
  preparedPdfImages,
  standingPaidUpscaleCopy,
} from "../client/src/features/export/prepareExportViews";
import { executePaidUpscale, normalizeUpscaleError } from "./casting/upscaleService";

const assets = [
  { id: 1, viewType: "frontClose", storageUrl: "https://images.test/head" },
  { id: 2, viewType: "sideClose", storageUrl: "https://images.test/side" },
];

describe("W1 server-derived export plan", () => {
  it("prices 1K at zero and 2K at filled view count × the server upscale constant", () => {
    const plan = buildExportPlan(6, CREDIT_COSTS.upscale);
    expect(plan.tiers["1K"].totalCost).toBe(0);
    expect(plan.tiers["2K"]).toEqual({ resolution: "2K", unitCost: 300, totalCost: 1_800 });
  });

  it("refuses a client asset set that no longer matches the priced package", () => {
    expect(() => assertExportPlanMatchesAssets(assets, 6)).toThrow("package changed");
    expect(() => assertExportPlanMatchesAssets(assets, 2)).not.toThrow();
  });
});

describe("W1 paid upscale authority", () => {
  it("charges exactly the upscale constant and creates collision-free refund references", async () => {
    const seen: Array<{ amount: number; referenceId: string }> = [];
    const withCredits = vi.fn(async (options, operation) => {
      seen.push(options);
      return operation();
    });
    const upscale = vi.fn().mockResolvedValue({ imageUrl: "https://images.test/2k", engineUsed: "test" });
    const ids = ["first", "second"];
    const dependencies = { withCredits, upscale, randomId: () => ids.shift()! };

    await executePaidUpscale({ userId: 1, imageUrl: "https://images.test/a", resolution: "2K" }, dependencies);
    await executePaidUpscale({ userId: 1, imageUrl: "https://images.test/b", resolution: "2K" }, dependencies);

    expect(seen.map((entry) => entry.amount)).toEqual([CREDIT_COSTS.upscale, CREDIT_COSTS.upscale]);
    expect(seen.map((entry) => entry.referenceId)).toEqual(["upscale-first", "upscale-second"]);
    expect(new Set(seen.map((entry) => entry.referenceId)).size).toBe(2);
  });

  it("preserves both refund-success wording and failed-refund support references verbatim", () => {
    for (const message of [
      "300 credits were refunded.",
      "The automatic refund could not be recorded — quote reference refund:upscale-abc and support will restore the 300 credits.",
    ]) {
      const original = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      expect(normalizeUpscaleError(original)).toBe(original);
      expect(normalizeUpscaleError(original).message).toBe(message);
    }
  });

  it("sanitizes unknown failures without exposing internals", () => {
    expect(normalizeUpscaleError(new Error("secret provider detail")).message).toBe("Failed to upscale image");
  });

  it("gives two same-millisecond failures distinct refund references", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const refunds: string[] = [];
    const ids = ["refund-a", "refund-b"];
    const dependencies = {
      randomId: () => ids.shift()!,
      upscale: vi.fn().mockRejectedValue(new Error("provider failed")),
      withCredits: vi.fn(async (options, operation) => {
        try {
          return await operation();
        } catch (error) {
          refunds.push(`refund:${options.referenceId}`);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `${options.amount} credits were refunded.` });
        }
      }),
    };

    await expect(executePaidUpscale({ userId: 1, imageUrl: "a", resolution: "2K" }, dependencies)).rejects.toThrow("300 credits were refunded");
    await expect(executePaidUpscale({ userId: 1, imageUrl: "b", resolution: "2K" }, dependencies)).rejects.toThrow("300 credits were refunded");
    expect(refunds).toEqual(["refund:upscale-refund-a", "refund:upscale-refund-b"]);
    expect(new Set(refunds).size).toBe(2);
    clock.mockRestore();
  });

  it("keeps the route wired to the refund-truth-preserving normalizer", () => {
    const route = readFileSync(new URL("./routes/generation/castingRefinement.ts", import.meta.url), "utf8");
    expect(route).toContain("throw normalizeUpscaleError(error)");
    expect(route).toContain("resolution: z.enum(['2K', '4K'])");
    expect(route).not.toContain("resolution: z.enum(['1K', '2K', '4K'])");
  });
});

describe("W1 PDF identity-document authority", () => {
  it("falls back from technicalSchema to persisted preferences without overwriting known schema values", () => {
    const prefs = resolvePdfPreferences(
      { subject: { gender: "Female" }, hair: { style: "Center part" } },
      { gender: "Male", hairStyle: "Waves", hairLength: "Very Long", eyeColor: "Hazel" },
    );
    expect(prefs.gender).toBe("Female");
    expect(prefs.hairStyle).toBe("Center part");
    expect(prefs.hairLength).toBe("Very Long");
    expect(prefs.eyeColor).toBe("Hazel");
  });

  it("leaves genuinely unknown values undefined for the PDF's em dash", () => {
    const prefs = resolvePdfPreferences({}, { gender: "   " });
    expect(prefs.gender).toBeUndefined();
    expect(prefs.hairLength).toBeUndefined();
  });
});

describe("W1 per-view export outcomes", () => {
  it("uses exact prepared bytes for PDF, keeps refund truth, and names mixed output honestly", async () => {
    const refundTruth = "The 300-credit charge was automatically refunded.";
    const upscale = vi.fn()
      .mockResolvedValueOnce({ success: true, imageUrl: "https://images.test/head-2k" })
      .mockRejectedValueOnce(new Error(refundTruth));
    const proxyImage = vi.fn(async ({ imageUrl }: { imageUrl: string }) => ({
      success: true,
      base64: imageUrl.includes("head")
        ? "data:image/png;base64,/9j/4AAQSkZJRgABAQ"
        : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg",
    }));

    const onIssue = vi.fn();
    const prepared = await prepareExportViews({ assets, resolution: "2K", mutations: { upscale, proxyImage }, onIssue });
    expect(prepared.map((view) => view.deliveredResolution)).toEqual(["2K", "1K"]);
    expect(prepared[0].filename).toBe("01_Headshot_Primary.jpg");
    expect(prepared[1].filename).toBe("03_Profile_Head.png");
    expect(prepared[1].issues.join(" ")).toContain(refundTruth);
    expect(onIssue).toHaveBeenCalledWith(expect.stringContaining(refundTruth), "sideClose");

    const pdfImages = preparedPdfImages(prepared);
    expect(pdfImages.headshot).toBe(prepared[0].dataUrl);
    expect(pdfImages.profile).toBe(prepared[1].dataUrl);
    expect(exportPackResolutionSuffix("2K", prepared)).toBe("MIXED");
    const summary = summarizeExportOutcomes("2K", prepared);
    expect(summary.title).toBe("Export completed with mixed resolution");
    expect(summary.description).toContain("Side profile");
    expect(summary.description).toContain(refundTruth);
  });

  it("reports a paid 2K proxy failure before falling back to original bytes", async () => {
    const upscale = vi.fn().mockResolvedValue({ success: true, imageUrl: "https://images.test/head-2k" });
    const proxyImage = vi.fn()
      .mockRejectedValueOnce(new Error("2K delivery failed"))
      .mockResolvedValueOnce({ success: true, base64: "data:image/jpeg;base64,/9j/4AAQ" });
    const prepared = await prepareExportViews({ assets: assets.slice(0, 1), resolution: "2K", mutations: { upscale, proxyImage } });
    expect(prepared[0].deliveredResolution).toBe("1K");
    expect(prepared[0].paidUpscaleSucceeded).toBe(true);
    expect(prepared[0].issues.join(" ")).toContain("paid 2K image was generated but could not be added");
    expect(exportPackResolutionSuffix("2K", prepared)).toBe("MIXED");
    expect(standingPaidUpscaleCopy("2K", prepared)).toBe("1 paid 2K upscale completed successfully, so that charge remains.");
  });

  it("prevents a same-tick duplicate paid submission", () => {
    const lock = { current: false };
    expect(claimExportRun(lock)).toBe(true);
    expect(claimExportRun(lock)).toBe(false);
  });

  it("labels an all-success paid pack as 2K and discloses standing charges", () => {
    const outcomes = assets.map((asset) => ({
      viewType: asset.viewType as "frontClose" | "sideClose",
      deliveredResolution: "2K" as const,
      paidUpscaleSucceeded: true,
      issues: [],
    }));
    expect(exportPackResolutionSuffix("2K", outcomes)).toBe("2K");
    expect(standingPaidUpscaleCopy("2K", outcomes.map((outcome, index) => ({
      ...outcome,
      sourceUrl: assets[index].storageUrl,
      deliveredUrl: `${assets[index].storageUrl}-2k`,
      dataUrl: "data:image/jpeg;base64,/9j/",
      filename: `${index}.jpg`,
    })))).toBe("2 paid 2K upscales completed successfully, so those charges remain.");
  });

  it("uses the newest duplicate slot rather than exporting stale history", () => {
    const duplicateAssets = [
      ...assets,
      { id: 3, viewType: "frontClose", storageUrl: "https://images.test/head-new" },
    ];
    expect(canonicalExportAssets(duplicateAssets).find((asset) => asset.viewType === "frontClose")?.storageUrl)
      .toBe("https://images.test/head-new");
  });
});
