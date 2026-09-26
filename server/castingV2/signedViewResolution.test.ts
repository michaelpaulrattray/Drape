import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join, resolve } from "node:path";

import { readListedSource } from "../testing/listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "../testing/childProcessTimeout";

/* The sweep at the bottom spawns `git ls-files` AND reads hundreds of files off
   the real tree, so it is in both derived timeout populations (#548 and #741).
   ONE declaration satisfies both: the sweep guard accepts either constant, the
   child-process guard accepts only this one, and the two values are equal. It is
   file-level rather than a per-arm third argument, which is what both readers
   look for. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE TIER A SIGNED VIEW IS ASKED FOR, AND THE TEST THAT MUST NOT FOLLOW IT.
 *
 * His word, 2026-09-26 (#1373): *"when generating the views on sign it must use
 * high/max quality"*. On the identity engine the views render on, that is the
 * top tier, and the value moved from seven copies of a literal to
 * `SIGNED_VIEW_RESOLUTION`.
 *
 * ⚠ **THE ARM THIS FILE EXISTS FOR IS THE OLD-TIER ONE, AND THE CARD ASKED FOR
 * THE CHANGE THAT BREAKS IT.** #1373's body said the `"2K"` tests in
 * `packageOrchestrator.ts` *"move to the same declaration or the whole package
 * reads as unbuilt"*. `unsettledPackageAngles` is recovery's REFUND list. Point
 * it at a constant that now says `4K` and every view already on disk at 2K reads
 * as unsettled — **27 delivered views with bytes on production, 35 on dev, all
 * of them 2K** — so the sweep would refund and re-render pictures the customer
 * already has. The question those two tests ask is *"is this a delivered view or
 * the free anchor"*, never *"is this today's tier"*, which is what their own
 * docblock already said.
 *
 * So the behaviour arms below are the ones that matter, and the
 * tier-no-longer-asked-for arm is the one that goes red under the card's
 * prescribed repair. They are driven through the real readers rather than
 * asserted about the source, because a guard reading the source cannot tell a
 * reader that works from one that merely mentions the right constant.
 *
 * The sweep at the bottom is the other half: a bare tier literal reappearing on
 * the sign road. It is derived from the tree with a floor, and its remainder is
 * enumerated with a reason and asserted REACHED — an exemption that cannot be
 * proven visited is a hole, not a debt.
 */

vi.mock("../db/castingV2Sign", () => ({
  commitPackageSlotAsset: vi.fn(),
  recordPackageSlotFailure: vi.fn(),
  activateSignedCast: vi.fn(),
  listCastAssets: vi.fn(async () => []),
  listOperationViewSteps: vi.fn(async () => []),
}));

vi.mock("../logging/logger", () => {
  const shape = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

const { committedPackageAngles, unsettledPackageAngles } = await import("./packageOrchestrator");
const { ANCHOR_RESOLUTION, SIGNED_VIEW_RESOLUTION, CAST_PACKAGE_VIEWS } =
  await import("./castViewPackage");
const { NANO_BANANA_PRO_USD_PER_IMAGE } = await import("../providers/falQueue");

/**
 * The tier every view already on disk was asked for, written down as the thing
 * it is: **the tier the product no longer asks for.**
 *
 * Deliberately NOT derived from the declaration — deriving it is the very
 * mistake this file guards. The day the ask moves again, this constant still
 * names 2K, because 2K rows will still be on disk.
 */
const A_TIER_NO_LONGER_ASKED_FOR = "2K" as const;

async function assets(rows: Array<Record<string, unknown>>) {
  const { listCastAssets } = await import("../db/castingV2Sign");
  vi.mocked(listCastAssets).mockResolvedValue(rows as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a delivered view is told from the free anchor, never from today's tier", () => {
  it("counts a view delivered at the tier the product no longer asks for", async () => {
    /*
      THE REGRESSION ARM. Every signed Cast in both worlds holds its views at
      this tier. If recovery stops seeing them, it refunds them.
    */
    expect(A_TIER_NO_LONGER_ASKED_FOR).not.toBe(SIGNED_VIEW_RESOLUTION);

    await assets([
      { viewType: "frontFull", resolution: A_TIER_NO_LONGER_ASKED_FOR, storageUrl: "u", status: null },
    ]);
    await expect(committedPackageAngles({ userId: 1, modelId: 9 })).resolves.toEqual(["frontFull"]);

    await assets([
      { viewType: "frontFull", resolution: A_TIER_NO_LONGER_ASKED_FOR, storageUrl: "u", status: null },
    ]);
    await expect(unsettledPackageAngles({ userId: 1, modelId: 9 }))
      .resolves.not.toContain("frontFull");
  });

  it("counts a view delivered at the tier the product asks for today", async () => {
    await assets([
      { viewType: "frontFull", resolution: SIGNED_VIEW_RESOLUTION, storageUrl: "u", status: null },
    ]);
    await expect(committedPackageAngles({ userId: 1, modelId: 9 })).resolves.toEqual(["frontFull"]);

    await assets([
      { viewType: "frontFull", resolution: SIGNED_VIEW_RESOLUTION, storageUrl: "u", status: null },
    ]);
    await expect(unsettledPackageAngles({ userId: 1, modelId: 9 }))
      .resolves.not.toContain("frontFull");
  });

  it("never counts the anchor, and the promise is widened so the profile cannot pass this for us", async () => {
    /*
      ⚠ `frontClose` is NOT in `CAST_PACKAGE_VIEWS`, so the profile filter drops
      it and a bare call would give the right answer whatever the test inside
      said. The promised set is widened here on purpose: without it this arm is a
      selector both states satisfy.
    */
    expect(CAST_PACKAGE_VIEWS).not.toContain("frontClose");
    const promised = ["frontClose", ...CAST_PACKAGE_VIEWS] as never;

    await assets([
      { viewType: "frontClose", resolution: ANCHOR_RESOLUTION, storageUrl: "anchor", status: null },
    ]);
    await expect(committedPackageAngles({ userId: 1, modelId: 9, promised })).resolves.toEqual([]);

    await assets([
      { viewType: "frontClose", resolution: ANCHOR_RESOLUTION, storageUrl: "anchor", status: null },
    ]);
    await expect(unsettledPackageAngles({ userId: 1, modelId: 9, promised }))
      .resolves.toContain("frontClose");
  });

  it("never counts a row with no bytes, whatever tier it records", async () => {
    await assets([
      { viewType: "frontFull", resolution: SIGNED_VIEW_RESOLUTION, storageUrl: "", status: null },
    ]);
    await expect(committedPackageAngles({ userId: 1, modelId: 9 })).resolves.toEqual([]);

    await assets([
      { viewType: "frontFull", resolution: SIGNED_VIEW_RESOLUTION, storageUrl: "", status: null },
    ]);
    await expect(unsettledPackageAngles({ userId: 1, modelId: 9 }))
      .resolves.toContain("frontFull");
  });
});

describe("the ask sits at the engine's top step, and the house price follows it", () => {
  it("asks for a tier the price table prices", () => {
    /*
      The type already forces the tier into the engine's own vocabulary; what
      this adds is the LEDGER half. `falQueue` reads `estimatedCostUsd` out of
      the request's own `resolution`, so a tier with no price would bill zero for
      a real render rather than failing loudly.
    */
    expect(Object.keys(NANO_BANANA_PRO_USD_PER_IMAGE)).toContain(SIGNED_VIEW_RESOLUTION);
    expect(NANO_BANANA_PRO_USD_PER_IMAGE[SIGNED_VIEW_RESOLUTION]).toBeGreaterThan(0);
  });

  it("is the engine's top step, which is what 'high/max quality' means on it", () => {
    /*
      His word was a QUALITY word and this engine has no quality word — its tiers
      ARE its resolutions. So the guard is that no tier the engine prices sits
      above the one the views ask for. A fifth tier appearing above would redden
      this rather than quietly leaving Sign one step below what he asked for.
    */
    const tiers = Object.keys(NANO_BANANA_PRO_USD_PER_IMAGE);
    const step = (tier: string) => Number.parseInt(tier.replace(/K$/, ""), 10);
    expect(tiers.every((tier) => Number.isFinite(step(tier)))).toBe(true);
    expect(Math.max(...tiers.map(step))).toBe(step(SIGNED_VIEW_RESOLUTION));
  });
});

/**
 * THE REMAINDER, enumerated with a reason, every entry asserted REACHED.
 *
 * These modules state a tier as a bare literal and are NOT on the signed-view
 * road. They are listed rather than swept because each holds a DIFFERENT fact
 * that happens to share a value — a candidate's own render tier, the legacy
 * studio's asset tier, the parked evidence family's (#6) — and folding them into
 * the signed views' declaration is the mistake of deriving from a set that
 * answers another question.
 */
const KNOWN_DEBT: Array<{ file: string; because: string }> = [
  /*
    Two of these state the tier as a TYPE UNION rather than as a choice —
    `resolution?: "1K" | "2K" | "4K"` — which is a third and fourth copy of the
    engine's own vocabulary and is working law 4 in miniature. They are on the
    list rather than swept, and named as their own class, because the honest move
    was NOT to narrow this regex until they stopped showing up.
  */
  { file: "server/casting/identity/identityCommit.ts", because: "a mirrored tier VOCABULARY as a type, on the legacy identity road" },
  { file: "server/casting/restoreSlotTransition.ts", because: "a mirrored tier VOCABULARY as a type, on the legacy restore road" },
  { file: "server/casting/evidence/evidencePackageExecution.ts", because: "the parked evidence family (#6)" },
  { file: "server/casting/evidence/inkAcceptanceCommit.ts", because: "the parked evidence family (#6)" },
  { file: "server/casting/evidence/inkFeatureGraph.ts", because: "the parked evidence family (#6)" },
  { file: "server/casting/mintPackage.ts", because: "the legacy studio's own package mint" },
  { file: "server/casting/snapshotTransitions.ts", because: "the legacy studio's snapshot road" },
  { file: "server/castingV2/refineService.ts", because: "a CANDIDATE's own render tier — a different fact from a view's" },
  { file: "server/lib/boardOps.ts", because: "the legacy studio's board assets" },
  { file: "shared/exportPlan.ts", because: "the legacy export's own claim, already wrong for a 2K view today" },
];

/** Comments quote the old code on purpose; the sweep reads code, never prose. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

const TIER_LITERAL = /\bresolution\b[^\n]{0,40}?["'](?:1K|2K|4K)["']/;

function trackedSource(repoRoot: string): string[] {
  return execFileSync("git", ["ls-files", "-z", "server", "shared"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"));
}

describe("no bare tier literal comes back on the signed-view road", () => {
  it("finds every module that states a tier, and each is the declaration or a named debt", () => {
    const repoRoot = resolve(__dirname, "..", "..");
    const listed = trackedSource(repoRoot);

    /* The floor: a walk that found nothing looks exactly like a clean tree. */
    expect(listed.length).toBeGreaterThan(400);

    const offenders: string[] = [];
    let read = 0;
    for (const path of listed) {
      const full = join(repoRoot, path);
      if (!statSync(full, { throwIfNoEntry: false })?.isFile()) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      read += 1;
      if (TIER_LITERAL.test(withoutComments(source))) offenders.push(path);
    }
    expect(read).toBeGreaterThan(400);

    /*
      The declaration states both tiers — that is its job. The provider modules
      state the engine's vocabulary and its price table, which is the source the
      declaration is typed against.
    */
    const allowed = new Set<string>([
      "server/castingV2/castViewPackage.ts",
      "server/providers/types.ts",
      "server/providers/falQueue.ts",
      ...KNOWN_DEBT.map((entry) => entry.file),
    ]);

    expect(offenders.filter((file) => !allowed.has(file))).toEqual([]);

    /*
      ⚠ AND THE DEBT IS PROVEN REACHED, not merely listed. An entry naming a file
      the sweep never saw excuses nothing while reading as coverage — and it goes
      on reading that way after the file is deleted or its literal removed.
    */
    for (const entry of KNOWN_DEBT) {
      expect(offenders, `${entry.file} — ${entry.because}`).toContain(entry.file);
    }
  });
});
