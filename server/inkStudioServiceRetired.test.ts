/**
 * THE INK STUDIO'S SERVICE CHAIN IS GONE, AND WHAT IT SHARED IS NOT — #1158
 * slice 2, on his ruling of 2026-09-24 (Crew reply #208): *"It retires with N2"*.
 *
 * Slice 1 shut the door (`server/inkUploadEntranceRetired.test.ts`). This slice
 * removed what stood behind it: the upload's order-owning orchestration
 * (`uploadInkDesign`), and the whole plate road it called at step 5 — the mint,
 * its two engine modules, the plate door and the template loader.
 *
 * # ⚠ THIS FILE'S REAL JOB IS THE SECOND HALF, NOT THE ABSENCES
 *
 * The census for this card (`docs/specs/INK_STUDIO_RETIREMENT_2026-09-24.md`)
 * listed the modules slice 2 would take. **Read at the bytes, that list was
 * wrong in BOTH directions**, which is the finding this suite exists to keep:
 *
 *   - three modules it named are the HELD reference road's and must survive —
 *     `inkUploadDoor.ts` (ten importers outside the studio), `inkReferenceCutter.ts`
 *     and `inkReferenceCrop.ts` (reached from `refineService.ts`, live for every
 *     account);
 *   - the plate road it did NOT name is what actually became unreachable, and
 *     `inkTemplates.ts` came with it because its only two readers were the plate
 *     door and the plate mint.
 *
 * So every absence below is paired with the survival it could be mistaken for.
 * An arm that only proved a file was gone would pass just as well if the ink
 * roads had been deleted wholesale, and wholesale is exactly what his ruling
 * does NOT say: he retired the studio, HELD the take from an attached picture
 * (Crew reply #213, moved to N3), and `CASTING_INK_WORDS_SCOPE` stands at `all`.
 *
 * # THE TWO EXPORTS THAT STAYED, AND WHY THEY ARE ASSERTED AS IDENTITIES
 *
 * `defaultManifest` and `defaultCutDesign` outlived the upload they were written
 * for because `inkReferenceMint.ts` wires them as its REAL dependencies, and
 * `inkDeliveryMint.ts` wires the manifest on the live carry road. A `typeof`
 * check would pass against any two functions, so the arm compares the SAME
 * INSTANCE the mint holds — the pattern `inkReferenceMint.test.ts` already uses,
 * repeated here because this is the file a later slice will read before deciding
 * whether the module may go.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.resolve(ROOT, file), "utf8");
const has = (file: string) => existsSync(path.resolve(ROOT, file));

/**
 * The plate road, by path. Each is a whole-module deletion, so a path is the
 * honest reading — there is no symbol left to import and no suite to drive.
 */
const PLATE_ROAD = [
  "server/castingV2/inkPlateMint.ts",
  "server/castingV2/inkPlateEngine.ts",
  "server/castingV2/inkPlateEngines.ts",
  "server/castingV2/inkPlateDoor.ts",
  "server/castingV2/inkTemplates.ts",
] as const;

/**
 * What the census wrongly put in slice 2's scope, and what a sweep reading the
 * word "ink" takes by mistake. Every one of these is reached by a road he HELD
 * or by the live refine road, and each is named with its reacher so a later
 * slice has to argue with a fact rather than with a list.
 */
const MUST_SURVIVE: Readonly<Record<string, string>> = {
  "server/castingV2/inkUploadDoor.ts":
    "the shared door — referenceAttachService, inkReferenceMint, inkRideFloor and six more read it",
  "server/castingV2/inkReferenceCutter.ts":
    "the cut itself — inkReferenceMint's, and refineService/refineReask import its InkCutFocus",
  "server/castingV2/inkReferenceCrop.ts":
    "the geometry the cutter and the delivered-crop road both stand on",
  "server/castingV2/inkDeliveryCrop.ts":
    "the delivered crop's arithmetic — refineService mints one on the live carry road",
  "server/castingV2/inkDeliveryMint.ts":
    "that mint itself, called from refineService for every account",
  "server/castingV2/inkReferenceMint.ts":
    "the take from an attached picture — HELD and moved to N3 (Crew reply #213)",
  "server/castingV2/inkRealism.ts":
    "the ink prose's owner — recipeAssembler and inkViewReferences say it on live roads",
  "server/castingV2/inkViewReferences.ts":
    "the sign views' clause — the DELIVERED-CROP lane, which is the one that paints",
  "server/db/castingV2InkDesigns.ts":
    "the design store, whose table keeps a live writer in the held road",
  "server/db/castingV2InkPlates.ts":
    "the plate store — PURGE ONLY since slice 4f; retention and an owner's delete still sweep it",
};

describe("the studio's service chain is retired", () => {
  it("⚠ what the retirement must NOT have taken is all still here — the control, first", () => {
    /*
      Deliberately the first arm in the file. If the reader below cannot resolve
      a path, every absence in this suite is vacuous — and a retirement's guard
      passing because it is looking at nothing is this repository's most
      expensive shape.
    */
    const missing = Object.keys(MUST_SURVIVE).filter((file) => !has(file));
    expect(missing).toEqual([]);
    expect(Object.keys(MUST_SURVIVE).length).toBeGreaterThan(5);
  });

  it("the plate road is gone, whole modules at a time", () => {
    expect(PLATE_ROAD.filter((file) => has(file))).toEqual([]);
    /* And their suites, which drove only that road. */
    expect(PLATE_ROAD.map((file) => file.replace(/\.ts$/, ".test.ts")).filter(has)).toEqual([]);
  });

  it("the upload's orchestration is gone and the two shared defaults are not", async () => {
    const service = await import("./castingV2/inkUploadService");
    /* THE POSITIVE HALF FIRST — a module that failed to load would satisfy
       every absence below on its own. */
    expect(typeof service.defaultManifest).toBe("function");
    expect(typeof service.defaultCutDesign).toBe("function");
    expect(service).not.toHaveProperty("uploadInkDesign");
    expect(service).not.toHaveProperty("defaultMintPlate");
  });

  it("⚠ the held road's real dependencies ARE those two functions, by identity", async () => {
    /*
      The load-bearing reason the module survived, asserted as identity rather
      than as shape: a `typeof` check would hold against any two functions, and
      the thing that must be true is that the reference mint calls THESE.
    */
    const { MINT_DEPENDENCIES } = await import("./castingV2/inkReferenceMint");
    const { defaultCutDesign, defaultManifest } = await import("./castingV2/inkUploadService");
    expect(MINT_DEPENDENCIES.cut).toBe(defaultCutDesign);
    expect(MINT_DEPENDENCIES.manifest).toBe(defaultManifest);
  });

  it("the router carries no reference to the retired service at all", () => {
    /*
      Slice 1 removed the procedure and LEFT ITS IMPORT — one line, no caller,
      and `import is not a call site` is a founder-ruled lesson in `CLAUDE.md`
      precisely because an importer count of one reads as a live reach. The
      Atlas builds its edges from imports, so a dead one makes a retired module
      look reached, which is the reading that stops a later slice removing it.
    */
    const router = read("server/routes/castingV2.ts");
    expect(router).not.toContain("uploadInkDesign");
    expect(router).not.toContain("inkUploadService");
    /* The control: the file was read and does hold the neighbour that stays. */
    expect(router).toContain("castingV2InkDesignRemoval");
  });

  it("⚠ the flag whose last reader went is still the boot parent of a live one", () => {
    /*
      `CASTING_INK_CUT_SCOPE` had exactly one read in the product — the retired
      upload's `cutEnabled` dependency — so nothing consults it from this commit.
      It is NOT therefore removable, and this arm is here so slice 4 cannot miss
      why: `CASTING_INK_REGION_CROP_SCOPE` is its CHILD, `defaultCutDesign` still
      reads the child, and a child scope refuses to boot when it reaches past its
      parent. Unsetting the parent over a live child is a crash-looping deploy.
    */
    const service = read("server/castingV2/inkUploadService.ts");
    expect(service).toContain("captureCastingInkRegionCropEnabled");
    expect(service).not.toContain("captureCastingInkCutEnabled");

    const scope = read("server/castingV2/castingV2Scope.ts");
    /* The parent relationship itself, read at the source that declares it. */
    expect(scope).toContain("CASTING_INK_REGION_CROP_SCOPE");
    expect(scope).toContain("CASTING_INK_CUT_SCOPE");
  });

  it("the plate mint's fal allowance is gone, and the courtesy pool did not take its slot back", () => {
    /*
      ⚠ THIS ARM USED TO ASSERT THE OPPOSITE (#1158 slice 4d, 2026-09-24). It
      read *"the slot stays declared until slice 4 because the variable is set
      on the service"* — and that premise was never true. Read at the running
      service on the day the row came out, by two independent readers with a
      positive and a negative control: **not one of the five allowance
      variables is set on production.** All five ran on their declared
      fallbacks, so there was no production act in this slice at all. The
      caution cost two slices of delay and nothing else; it is recorded here
      because a reason nobody re-reads is how a wrong premise survives.

      What has NOT changed is the second half, which is the one with teeth.
    */
    const budget = read("server/castingV2/falBudget.ts");
    expect(budget).not.toContain('env: "INK_PLATE_CONCURRENCY"');
    const spenders = ["server/castingV2/inkPlateEngine.ts", ...PLATE_ROAD].filter(has);
    expect(spenders).toEqual([]);
    /* The courtesy pool is NOT widened by the retirement — handing the freed 1
       back to region reads would be a capability change wearing a cleanup's
       clothes, which is his own rule from the switch sitting. */
    expect(budget).toContain('env: "FAL_CONCURRENCY", fallback: 5');
  });
});
