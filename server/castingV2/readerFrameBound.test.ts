/**
 * EVERY READER THAT POSTS A FRAME TO A TEXT ENGINE BOUNDS IT FIRST (#1413).
 *
 * # What this guards, and why a hand-written arm per reader would not
 *
 * #1408 bounded ONE post — the conformance judge's. The class is wider, and its
 * sweep found nine more live posts across eight modules. Nine hand-written arms
 * would cover the nine that exist today and say nothing about the tenth, which
 * is the shape this repository has been bitten by (working law 4). So the
 * population here is **DERIVED from the source tree**: every non-test module
 * under `server/castingV2/` and `server/casting/evidence/` that writes
 * `images: [` must reach it through the bound, or be named on
 * {@link PARKED_R7_POSTS} with its reason.
 *
 * ⚠ **THE DERIVED ARM ALONE WOULD BE A SUBSTRING TEST**, which is precisely
 * what the Atlas's own `strictInput` was for months before anyone noticed it
 * learned nothing. So the arms below it DRIVE each reader through its real
 * exported function with a recording engine and an over-sized frame, and assert
 * on the bytes that actually left — invariant 5, *assert at the wire*. The two
 * halves answer different questions: the derived one asks whether a tenth post
 * exists, the driven ones ask whether the nine work.
 *
 * # The parked remainder is named, not silently excluded
 *
 * Three R7 evidence modules post eleven frames between them and are **parked**
 * under #6 (founder ruling, 2026-08-25: parked until the casting push lands).
 * #1413's own body says to name them and leave them. ⚠ **Its table named TWO of
 * the three** — `casting/evidence/composer/inkProbe.ts` and its six posts were
 * absent, because the card's derivation globbed `evidence` with a doubled
 * wildcard under a shell with no `globstar`, which reaches exactly one directory
 * level. Recorded here because the list is the thing
 * this suite is made of: a population read through a glob nobody drove is how a
 * sweep comes to be short by a sixth of itself.
 *
 * # The one reader that also goes the OTHER way
 *
 * `realizationCaption` enlarges a crop too small to read (`LEGIBLE_LONG_EDGE`,
 * measured: an earring at 27 px was described wrong 4/4 and right 4/4 once
 * resized). #1413 warns those two directions must be one pipeline or a crop will
 * be enlarged past the bound. The last block here holds the two constants in
 * their order and drives both sides of the single threshold, so a later move of
 * either cannot quietly invert it.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { readListedSource } from "../testing/listedSource";
import { JUDGE_FRAME_LONG_EDGE } from "./judgeFrame";
import { LEGIBLE_LONG_EDGE, captionRealization, captionSlot } from "./realizationCaption";
import { describeFace } from "./faceDescribe";
import { capturePresentation } from "./presentationState";
import { aboutFacet, verifyRender } from "./renderVerification";
import { facetOfSubject } from "./refineFacets";
import { describeConcept } from "./conceptDescribe";
import { readHairColourFromReference } from "./hairColourFromReference";
import { readMakeupFromReference } from "./makeupFromReference";
import { readReferenceMedium } from "./referenceMediumDoor";

/* A tree-walking suite declares this at file level — three suites' worth of
   red were paid for learning that (PR #1250). */
const CONTENDED_TEST_TIMEOUT_MS = 60_000;

const REPO_ROOT = path.resolve(__dirname, "..", "..");

/**
 * The posts that are deliberately NOT bounded, each with the reason it stands.
 *
 * Every entry here is an R7 evidence module under #6's park. A module that
 * leaves the park leaves this list in the same commit — and the arm below
 * refuses a name on this list that no longer posts anything, so a stale entry
 * cannot sit here granting an exemption to nothing.
 */
const PARKED_R7_POSTS: ReadonlyArray<{ file: string; reason: string }> = [
  { file: "casting/evidence/composer/inkProbe.ts", reason: "R7 evidence composer — parked (#6)" },
  { file: "casting/evidence/evidencePackageProbe.ts", reason: "R7 evidence package probe — parked (#6)" },
  { file: "casting/evidence/inkProjectionComposition.ts", reason: "R7 ink projection — parked (#6)" },
];

/** Every non-test `.ts` under the two roots, listed then read, race-tolerantly. */
function sourceFilesUnder(...roots: readonly string[]): ReadonlyArray<{ file: string; source: string }> {
  const found: Array<{ file: string; source: string }> = [];
  const walk = (absolute: string) => {
    let entries: string[];
    try {
      entries = readdirSync(absolute);
    } catch {
      /* A directory that vanished between its parent's listing and this read.
         #223's stated limit; skipping it is the correct answer, and the floor
         arm below is what stops a blind walk passing vacuously. */
      return;
    }
    for (const entry of entries) {
      const full = path.join(absolute, entry);
      /* `throwIfNoEntry: false` — the race is at every step that touches a
         listed path, not only the read (#223's list-side twin). */
      const stat = statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      found.push({ file: path.relative(path.join(REPO_ROOT, "server"), full).split(path.sep).join("/"), source });
    }
  };
  for (const root of roots) walk(path.join(REPO_ROOT, "server", root));
  return found;
}

const SOURCES = sourceFilesUnder("castingV2", path.join("casting", "evidence"));
const POSTING = SOURCES.filter((entry) => entry.source.includes("images: ["));

describe("the population — derived from the tree, so a TENTH post cannot arrive unbounded", () => {
  it("found the modules at all — the floor, so a blind walk cannot pass", () => {
    /*
      A walk that silently read nothing is indistinguishable from a repository
      where every post is bounded. Both numbers are floors read at the tree on
      2026-09-27 (`grep -rn "images: \[" server/ --include=*.ts`): 12 posting
      modules, of which 9 are live and 3 are R7-parked.
    */
    expect(SOURCES.length).toBeGreaterThan(50);
    expect(POSTING.length).toBeGreaterThanOrEqual(12);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("every posting module either bounds its frame or is a named park", () => {
    const parked = new Set(PARKED_R7_POSTS.map((entry) => entry.file));
    const unbounded = POSTING
      .filter((entry) => !parked.has(entry.file))
      /*
        BOUNDED MEANS IT REACHES THE TOOL, however the call is spelled. Three
        spellings are live and all three are the same act: `boundForJudge` at
        the post, `boundedForReader` (realizationCaption's one-threshold
        wrapper), and a `frame` bound once above a retry closure. Asking for the
        IMPORT rather than for one call shape is what keeps this from being a
        test of today's formatting.
      */
      .filter((entry) => !entry.source.includes('from "./judgeFrame"'))
      .map((entry) => entry.file);
    expect(unbounded).toEqual([]);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("a name on the park list that no longer posts is REFUSED, so the list cannot rot", () => {
    /*
      An exemption for a module that has stopped posting is an exemption
      granted to nothing, and it is exactly how a list comes to describe a tree
      that has moved on — the class that produced four rotting documents in one
      day (law 7c).
    */
    const posting = new Set(POSTING.map((entry) => entry.file));
    const stale = PARKED_R7_POSTS.filter((entry) => !posting.has(entry.file)).map((entry) => entry.file);
    expect(stale).toEqual([]);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("every park carries a reason naming the ruling that parks it", () => {
    for (const entry of PARKED_R7_POSTS) {
      expect(entry.reason).toMatch(/#6/);
    }
  });
});

/* ── The driven half: what actually left, on a frame bigger than the edge ── */

/** A frame over the reader's edge, as PNG — the shape every render arrives in. */
async function oversizedFrame(width = 3008, height = 4136): Promise<{ bytes: Buffer; contentType: string }> {
  const bytes = await sharp({
    create: { width, height, channels: 3, background: { r: 140, g: 90, b: 70 } },
  })
    /* Noise, so the JPEG has something to compress and a flat-colour artefact
       cannot make a bound look like it did nothing. */
    .composite([{
      input: await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 0, b: 0 }, noise: { type: "gaussian", mean: 128, sigma: 60 } } })
        .png().toBuffer(),
      tile: true,
      blend: "over",
    }])
    .png()
    .toBuffer();
  return { bytes, contentType: "image/png" };
}

type Posted = { bytes: Buffer; contentType: string };

/** An engine that answers plausibly and keeps what it was handed. */
function recordingEngine(text: string) {
  const posted: Posted[] = [];
  const engine = {
    id: "test:recording",
    complete: async (request: { images?: ReadonlyArray<Posted> }) => {
      for (const image of request.images ?? []) posted.push(image);
      return { text, tokensIn: 1, tokensOut: 1 };
    },
  } as never;
  return { engine, posted };
}

async function expectBounded(posted: ReadonlyArray<Posted>) {
  expect(posted.length).toBeGreaterThan(0);
  for (const image of posted) {
    const meta = await sharp(image.bytes).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(JUDGE_FRAME_LONG_EDGE);
    /* The encoding half is the one that moves the number on today's frames —
       every one of them is already a PNG under the pixel edge or just over it. */
    expect(image.contentType).toBe("image/jpeg");
    expect(meta.format).toBe("jpeg");
  }
}

describe("the nine live posts, driven at the wire", () => {
  it("faceDescribe bounds the frame — and covers all four arms, because the post is shared", async () => {
    const frame = await oversizedFrame();
    const { engine, posted } = recordingEngine('{"build":"slight","skin":"fair","teeth":"even"}');
    const answered = await describeFace({ ...frame, engine });
    /* A positive control on the READER, not just on the bytes: a bound that
       broke the call would return the blank shape and this arm would still pass
       on `posted`. The answer proves the road was walked. */
    expect(answered.build).toBe("slight");
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("presentationState bounds the master", async () => {
    const frame = await oversizedFrame();
    const { engine, posted } = recordingEngine('{"hairWorn":"loose"}');
    await capturePresentation({ ...frame, engine });
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("renderVerification bounds the render", async () => {
    const frame = await oversizedFrame();
    const { engine, posted } = recordingEngine('{"1":{"visible":true,"saw":"a fringe"}}');
    await verifyRender({
      engine,
      ...frame,
      /* The real fact shape, built through the product's own constructors —
         a hand-typed `subject` string throws inside `subjectHeading` and would
         have made this arm pass on a road nobody walked. */
      facts: [{
        subject: aboutFacet(facetOfSubject("statedAccessories")),
        asked: "gold hoop earrings, one on each ear, a matching pair",
        binding: true,
      }],
    });
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("realizationCaption bounds the whole frame it reads a facet against", async () => {
    const frame = await oversizedFrame();
    const { engine, posted } = recordingEngine('{"caption":"a short bob","matches":true}');
    await captionRealization({ facet: "hair" as never, ...frame, engine });
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("captionSlot bounds a cut that is over the edge", async () => {
    const frame = await oversizedFrame();
    const { engine, posted } = recordingEngine('{"caption":"a gold hoop","visible":true}');
    await captionSlot({ noun: "left earring", view: "cut", ...frame, engine });
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("conceptDescribe bounds her uploaded picture ONCE, and the re-ask posts the same bytes", async () => {
    const frame = await oversizedFrame(4000, 6000);
    /*
      A reply that trips the sweep, so the re-ask actually fires — otherwise
      this arm would assert "bounded once" on a road that only ever reads once
      and would pass for the wrong reason.
    */
    const posted: Posted[] = [];
    let call = 0;
    const engine = {
      id: "test:recording",
      complete: async (request: { images?: ReadonlyArray<Posted> }) => {
        for (const image of request.images ?? []) posted.push(image);
        call += 1;
        return call === 1
          ? { text: '{"description":"lit by soft window light from the left"}', tokensIn: 1, tokensOut: 1 }
          : { text: '{"description":"a tall woman with close-cropped hair"}', tokensIn: 1, tokensOut: 1 };
      },
    } as never;
    await describeConcept({ ...frame, engine });
    expect(call).toBeGreaterThan(1);
    await expectBounded(posted);
    /*
      THE SAME PICTURE, not merely two bounded ones: the re-ask exists to correct
      WORDS, and a re-ask that also changed the picture would not be the same
      question asked again.

      ⚠ Its stated limit: sharp's JPEG encode is deterministic, so this arm
      cannot tell one bound reused from two bounds that agreed. What it pins is
      the contract that matters — the second read sees what the first read saw.
      The single encode is a cost, and the comment at the call site owns it.
    */
    expect(posted[0]?.bytes.equals(posted[1]!.bytes)).toBe(true);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("hairColourFromReference bounds her photograph", async () => {
    const frame = await oversizedFrame(4000, 6000);
    const { engine, posted } = recordingEngine('{"sections":[{"tone":"copper","where":"at the ends"}]}');
    await readHairColourFromReference({ ...frame, engine });
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("makeupFromReference bounds her photograph", async () => {
    const frame = await oversizedFrame(4000, 6000);
    const { engine, posted } = recordingEngine('{"surfaces":["a soft brown on the lids"]}');
    await readMakeupFromReference({ ...frame, engine });
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("referenceMediumDoor bounds her photograph", async () => {
    const frame = await oversizedFrame(4000, 6000);
    const { engine, posted } = recordingEngine('{"medium":"photograph"}');
    const medium = await readReferenceMedium({ ...frame, engine });
    /* The door's own answer, so a bound that broke the call cannot pass here as
       `unreadable` — which is the value this door returns on every failure. */
    expect(medium).toBe("photograph");
    await expectBounded(posted);
  }, CONTENDED_TEST_TIMEOUT_MS);
});

describe("realizationCaption's two directions are ONE pipeline on ONE threshold", () => {
  it("the enlargement's edge sits under the bound, so a crop can never be enlarged past it", () => {
    /*
      #1413's named risk, retired by arithmetic rather than by a second call.
      Read off both modules rather than restated, so moving either constant
      reddens here instead of silently inverting the ordering.
    */
    expect(LEGIBLE_LONG_EDGE).toBeLessThanOrEqual(JUDGE_FRAME_LONG_EDGE);
  });

  it("a cut UNDER the legible edge is posted byte-identical — the measured skip", async () => {
    /*
      THE NEGATIVE CONTROL, and it is the arm that gives the positive ones
      meaning. Driven: `boundForJudge` re-encodes a 27x74 PNG to a SMALLER JPEG,
      so without the skip this crop would arrive as JPEG — three kilobytes saved
      on the one read in this product whose legibility is measured, at 27 px,
      where JPEG's 8x8 blocks are a third of the width.
    */
    const bytes = await sharp({
      create: { width: 27, height: 74, channels: 3, background: { r: 0, g: 0, b: 0 }, noise: { type: "gaussian", mean: 120, sigma: 50 } },
    }).png().toBuffer();
    const { engine, posted } = recordingEngine('{"caption":"a gold hoop with a cross","visible":true}');
    await captionSlot({ noun: "left earring", view: "cut", bytes, contentType: "image/png", engine });
    expect(posted.length).toBeGreaterThan(0);
    expect(posted[0]?.contentType).toBe("image/png");
    expect(posted[0]?.bytes.equals(bytes)).toBe(true);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("a cut AT the legible edge is bounded — the threshold has no gap", async () => {
    const bytes = await sharp({
      create: { width: 400, height: LEGIBLE_LONG_EDGE, channels: 3, background: { r: 0, g: 0, b: 0 }, noise: { type: "gaussian", mean: 120, sigma: 50 } },
    }).png().toBuffer();
    const { engine, posted } = recordingEngine('{"caption":"a gold hoop","visible":true}');
    await captionSlot({ noun: "left earring", view: "cut", bytes, contentType: "image/png", engine });
    expect(posted[0]?.contentType).toBe("image/jpeg");
  }, CONTENDED_TEST_TIMEOUT_MS);
});
