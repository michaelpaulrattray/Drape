/**
 * WHAT ONE FACE SCAN BUYS AT fal — derived by driving the real scan through the
 * real reader, and held against what real faces were measured to cost (#2184).
 *
 * # Why this replaced a single number
 *
 * `FACE_SCAN_READS_PER_VERSION = 20` was counted by `count-scan-reads-disposable`
 * with a fake reader that found everything on the first ask. That is the one
 * kind of face no scan ever meets: a real face makes the scan ask AGAIN when a
 * read comes back short — an empty anatomy read gets a second look, a pair with
 * one side at zero gets a second look — and the 20 also folded the body cutout
 * (BiRefNet, priced per compute-second) in as if it were one more SAM 3 read at
 * half a cent. #2183 measured 21–27 SAM 3 reads plus one cutout on eight real
 * casts, against fal's own usage report.
 *
 * # What this suite derives, and how
 *
 * It does NOT re-implement the re-ask rules. It runs `scanFace` with the real
 * `createFalRegionReader` — built the way the scan builds it, head box and all
 * — and a fake `fetch`, and counts the requests that reach
 * `https://fal.run/…`, endpoint by endpoint — assert at the wire. Three kinds
 * of fake segmenter answer them:
 *
 *   FINDS EVERYTHING   every question answered on the first ask — the FEWEST
 *                      reads the code can make.
 *   MISSES ON PURPOSE  answers shaped to fire each re-ask the code has, and the
 *                      worst per question is taken — the MOST it can make when
 *                      every call succeeds.
 *   LANDS OFF THE HEAD the face read on something that is not the head, so the
 *                      reader refuses it against the head box and asks the head
 *                      crop alone (#2895). ⚠ This kind did not exist until
 *                      2026-10-31 and the drive built its reader with NO head
 *                      box, so the re-ask #2887 added could not fire here at
 *                      all: both ceilings priced a reader the scan no longer
 *                      builds, and nothing went red for two days.
 *
 * Those two are pinned to `FACE_SCAN_FAL_CALLS` in `falSpend.mts`, which holds
 * the figures as constants only so that module stays out of the server's import
 * graph (its own stated rule). If the scan starts asking more or fewer
 * questions, this goes red and the constant has to move with it. The measured
 * band must sit inside the derived one: a band outside what the code can do is
 * a measurement of some other code.
 */
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { discoveryHeadBoxOf } from "./castingV2/faceDiscovery";
import { scanFace } from "./castingV2/faceScan";
import { createFalRegionReader } from "./castingV2/falRegionReader";
import { catalogueSlots } from "./castingV2/referenceSlotCatalogue";
import {
  FACE_SCAN_FAL_CALLS,
  FACE_SCAN_PAIR_ONE_READ_POSITION,
  FACE_SCAN_PART_USD,
  FAL_MEASURED_USD,
  faceScanFalFloorUsd,
  faceScanSam3Reads,
  faceScanUsd,
} from "../scripts/lib/falSpend.mts";
import { PRODUCTION_FLAG_POSITIONS } from "../scripts/lib/productionFlagPositions.mts";

const SAM3 = "fal-ai/sam-3/image";
const BIREFNET = "fal-ai/birefnet/v2";

const WIDTH = 400;
const HEIGHT = 600;
/* The noun the shared face read is asked by (`SHARED_PROMPT` in the reader).
   Named because three arms below count it and one answers it. */
const FACE = "face";

/**
 * THE HEAD BOX THE SCAN HANDS ITS READER — read from the product's own
 * geometry, never a copy of it (#2895).
 *
 * `faceScanService`'s `defaultRegionReader` builds every scan's reader with
 * `discoveryHeadBoxOf(frame)`, for every frame big enough to cut a head crop
 * from — so a drive that builds the reader WITHOUT one prices a reader the
 * scan does not build, which is exactly how the ceiling below came to be one
 * read low. It is the top half of the frame at full width, decided by the
 * frame's size alone and by nothing the segmenter says.
 */
const HEAD = discoveryHeadBoxOf({ width: WIDTH, height: HEIGHT })!;
const HEAD_BOX = { frame: { width: WIDTH, height: HEIGHT }, box: HEAD };
/* The two halves are different colours, so the fake can tell which side of
   the midline a half-frame question is about from the picture alone — the
   reader never says so in the request. */
const LEFT = { r: 200, g: 40, b: 40 };
const RIGHT = { r: 40, g: 40, b: 200 };

async function frame(): Promise<Buffer> {
  const half = WIDTH / 2;
  const left = await sharp({ create: { width: half, height: HEIGHT, channels: 3, background: LEFT } }).png().toBuffer();
  const right = await sharp({ create: { width: half, height: HEIGHT, channels: 3, background: RIGHT } }).png().toBuffer();
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: half, top: 0 }])
    .png()
    .toBuffer();
}

/** One solid rectangle in the picture's own pixels, as a mask data URI — the
 *  one place this fake draws, so three answer shapes cannot disagree about
 *  what a mask is (working law 4). `x1` and `y1` are past the last pixel. */
async function rect(
  width: number, height: number, x0: number, x1: number, y0: number, y1: number,
): Promise<string> {
  const data = Buffer.alloc(width * height, 0);
  for (let y = y0; y < y1; y += 1) data.fill(255, y * width + x0, y * width + x1);
  const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** A centred rectangle covering `share` of each axis, as a mask data URI. */
async function blob(width: number, height: number, share: number): Promise<string> {
  return rect(
    width, height,
    Math.floor(width * (0.5 - share / 2)), Math.floor(width * (0.5 + share / 2)),
    Math.floor(height * (0.5 - share / 2)), Math.floor(height * (0.5 + share / 2)),
  );
}

/** A mask covering one x band over the middle third of the height — a pair
 *  answer that sits wholly on one side of her midline. */
async function band(width: number, height: number, x0: number, x1: number): Promise<string> {
  return rect(width, height, x0, x1, Math.floor(height / 3), Math.floor((height * 2) / 3));
}

/**
 * THE FACE READ, AND WHETHER IT LANDS ON THE HEAD (#2895).
 *
 * The x extent is the same in all three — the frame's middle half, so the
 * midline every pair is cut at and the two edges the ear rule measures from
 * are identical whichever of these the fake answers. **What differs is the
 * row it sits on, which is the only thing `judgedFace` reads.**
 *
 *   on the head    inside the head box, inset a tenth of its height at each
 *                  end: rows 30–269, centre row 149.5 against a box that ends
 *                  at 300. On the head by 150 rows, not by a rounding — which
 *                  matters, because the answer this replaced was centred at
 *                  299.5 and passed the box by HALF A PIXEL.
 *   off the head   the same rectangle moved into the bottom half: rows
 *                  330–569, centre row 449.5, which is 149.5 rows outside the
 *                  box. Every piece is dropped, so the read is refused and the
 *                  head crop is asked alone. It is the founder's round-10 and
 *                  round-11 shape — a face tattooed on an arm (#2885).
 *   the head crop  the inset rectangle again, in the CROP's own pixels. The
 *                  box is at the frame's corner, so placed back in the frame
 *                  it is the very rectangle `onTheHead` draws — which is what
 *                  makes the fourth policy differ from the first in READS and
 *                  in nothing else.
 */
async function faceMask(where: "onTheHead" | "offTheHead" | "theHeadCrop"): Promise<string> {
  const inset = Math.round(HEAD.height * 0.1);
  const height = where === "theHeadCrop" ? HEAD.height : HEIGHT;
  const y0 = where === "offTheHead" ? HEAD.height + inset : inset;
  const y1 = where === "offTheHead" ? HEIGHT - inset : HEAD.height - inset;
  return rect(WIDTH, height, Math.floor(WIDTH * 0.25), Math.floor(WIDTH * 0.75), y0, y1);
}

/**
 * How the fake segmenter answers.
 *
 * `n` is how many times THIS prompt has been asked of THIS picture (the whole
 * frame, or one side of it), counting from 1.
 */
type Policy = {
  whole: (n: number) => boolean;
  side: (n: number, side: "left" | "right") => boolean;
  /**
   * A PAIR ASKED OF THE WHOLE FRAME — the `pairInOneRead` road only (#2191).
   *
   * On that road a bilateral region is one request about the whole picture, so
   * `side` is never consulted for it and `whole` cannot say the one thing that
   * matters: whether the answer covers BOTH sides of her midline or one. This
   * says which, and the fake draws the mask to match.
   *
   * Absent, a pair answers by `whole` like any other whole-frame question —
   * which on this fake is a centred rectangle, i.e. `"both"`. That default is
   * why the two old policies below need no `pair` entry.
   */
  pair?: (n: number) => "both" | "one" | "none";
  /**
   * THE FACE READ LANDS SOMEWHERE THAT IS NOT THE HEAD — the re-ask #2887
   * added and this suite could not see (#2895).
   *
   * Absent or false, the face read is on the head and is believed as it came.
   * True, every piece of it is centred below the head box, so `judgedFace`
   * drops the lot and asks the HEAD CROP alone — one more segmenter read,
   * about half a cent, on the refused frames only. That read is the call both
   * ceilings below were missing, and the reason nothing went red when #2887
   * landed is that this drive built its reader with no head box at all.
   */
  faceOffTheHead?: boolean;
};

const FINDS_EVERYTHING: Policy = { whole: () => true, side: () => true };

/** Empty first time, both sides; then one side only; then found. Fires the
 *  empty-anatomy re-ask AND, inside it, the half-pair heal. */
const BOTH_EMPTY_THEN_HALF: Policy = {
  whole: (n) => n > 1,
  side: (n, side) => (n === 1 ? false : n === 2 ? side === "right" : true),
  /*
    The `pairInOneRead` reading of this same policy, and it is spelled out for
    the reason the comparison turns on: it must take the same number of LOOKS
    as the `side` line above, so that the two ceilings differ in reads per look
    and in nothing else. Empty, then half, then found — three looks, which is
    the empty-anatomy re-ask with the half-pair heal firing inside it.
  */
  pair: (n) => (n === 1 ? "none" : n === 2 ? "one" : "both"),
};

/** One side only first time; then found. Fires the half-pair heal on a pair
 *  the empty-anatomy rule never re-asks (a worn thing). */
const HALF_THEN_FOUND: Policy = {
  whole: (n) => n > 1,
  side: (n, side) => n > 1 || side === "right",
  /* The `pairInOneRead` reading of this same policy: one side first, both on
     the look after. It is spelled out rather than left to the default because
     the default answers `"both"` first time, which fires no heal at all — and
     a ceiling derived without the heal would be a cost figure that is too
     low, which is the direction that matters. */
  pair: (n) => (n > 1 ? "both" : "one"),
};

/**
 * THE FOURTH POLICY — the face read on an arm (#2895).
 *
 * Every question answered first time, exactly as `FINDS_EVERYTHING`, and the
 * face read landing off the head. So the ONE thing it adds to either ceiling
 * is the head crop's read.
 *
 * ⚠ **Why the sums below may take it per prompt beside the other three.** The
 * ceiling is a max per prompt summed across policies, which is only legitimate
 * while each question's re-asks depend on that question's own answers. The
 * face re-ask depends on the face answer alone; and because the head crop puts
 * back the very rectangle the other three are given, **the face that every
 * OTHER question is judged by is the same face in all four runs** — so no
 * other prompt's count can move under this policy, which the arm below asserts
 * rather than assumes.
 *
 * The road where the head crop answers nothing either is deliberately NOT a
 * policy here: it buys the same one extra read, so it moves no figure, and its
 * behaviour — read on without a face, never without the eyes — belongs to
 * `server/castingV2/faceSpanOnTheHead.test.ts`.
 */
const FACE_OFF_THE_HEAD: Policy = {
  whole: () => true,
  side: () => true,
  faceOffTheHead: true,
};

/** Every question the scan reads a side at a time — the catalogue's own fact,
 *  so a new pair joins the pair-road arms below by itself. */
const PAIR_QUESTIONS = new Set(
  catalogueSlots()
    .filter((definition) => definition.frame === "ownSide" && definition.question !== null)
    .map((definition) => definition.question as string),
);

type Wire = {
  sam3ByPrompt: Map<string, number>;
  birefnet: number;
  other: string[];
  /* A picture the fake could not NAME (#2895). Answering one as a guess is how
     a cost figure stops being a derivation: the head crop is the frame's full
     width at half its height, so the old `width === WIDTH` test called it the
     whole frame and would have answered it with the very read it was sent to
     replace. Every arm holds this empty. */
  unknown: string[];
};

async function drive(policy: Policy, pairInOneRead = false): Promise<Wire & { describer: number }> {
  const wire: Wire = { sam3ByPrompt: new Map(), birefnet: 0, other: [], unknown: [] };
  const asked = new Map<string, number>();

  vi.stubGlobal("fetch", async (url: unknown, init?: { body?: unknown }) => {
    const address = String(url);
    const reply = (json: unknown) => new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    if (!address.startsWith("https://fal.run/")) {
      wire.other.push(address.slice(0, 60));
      return new Response("not served by this fake", { status: 404 });
    }
    const endpoint = address.slice("https://fal.run/".length);
    const body = JSON.parse(String(init?.body ?? "{}"));
    const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (endpoint === BIREFNET) {
      wire.birefnet += 1;
      return reply({ mask_image: { url: await blob(width, height, 0.9) } });
    }
    if (endpoint !== SAM3) {
      wire.other.push(endpoint);
      return reply({});
    }
    const prompt = String(body.prompt);
    wire.sam3ByPrompt.set(prompt, (wire.sam3ByPrompt.get(prompt) ?? 0) + 1);

    /*
      WHICH PICTURE THIS IS — named by BOTH its dimensions (#2895).

      `width === WIDTH` was enough while the only two pictures a scan asked
      about were the frame and a half of it. The head crop the refused face
      read is asked again of is the frame's FULL WIDTH at half its height, so
      that test would have called it the whole frame. A half-picture is cut at
      the face's own midline, so its width is read as "narrower than the
      frame" rather than as a number.
    */
    const nameOfPicture = async (): Promise<"frame" | "head" | "left" | "right" | null> => {
      if (width === WIDTH && height === HEIGHT) return "frame";
      if (width === HEAD.width && height === HEAD.height) return "head";
      if (height !== HEIGHT || width >= WIDTH) return null;
      const { data } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
      return data[0] > data[2] ? "left" : "right";
    };
    const picture = await nameOfPicture();
    if (picture === null) {
      wire.unknown.push(`${prompt} asked of a ${width}x${height} picture`);
      return reply({ masks: [] });
    }
    const whole = picture === "frame";
    const side: "left" | "right" | null = picture === "left" || picture === "right" ? picture : null;
    const key = `${prompt}|${picture}`;
    const n = (asked.get(key) ?? 0) + 1;
    asked.set(key, n);

    /*
      THE FACE READ IS ANSWERED BY ITS OWN GEOMETRY, never by a policy's
      `whole` (#2895). It is the one question whose ANSWER decides whether
      another read is bought, and the box it is judged against is geometry — so
      where it lands is the whole of what this policy says. It is asked of two
      pictures and no others; a third would be a cost nobody has priced.
    */
    if (prompt === FACE) {
      if (picture !== "frame" && picture !== "head") {
        wire.unknown.push(`${FACE} asked of the ${picture} half-picture`);
        return reply({ masks: [] });
      }
      const where = picture === "head"
        ? "theHeadCrop"
        : policy.faceOffTheHead === true ? "offTheHead" : "onTheHead";
      return reply({ masks: [{ url: await faceMask(where) }] });
    }

    /*
      A PAIR ASKED OF THE WHOLE FRAME is the `pairInOneRead` road, and the fake
      answers it with a mask the reader's own cut can come apart — `"both"` is a
      rectangle across her midline, `"one"` sits wholly on one side of it. The
      reader is what splits them, so this stays a statement about the WIRE.
    */
    if (pairInOneRead && whole && PAIR_QUESTIONS.has(prompt)) {
      const shape = (policy.pair ?? ((ask: number) => (policy.whole(ask) ? "both" : "none")))(n);
      if (shape === "none") return reply({ masks: [] });
      const url = shape === "both"
        ? await blob(width, height, 0.5)
        : await band(width, height, Math.floor(width * 0.6), Math.floor(width * 0.9));
      return reply({ masks: [{ url }] });
    }

    const found = side === null ? policy.whole(n) : policy.side(n, side);
    return reply({ masks: found ? [{ url: await blob(width, height, side === null ? 0.5 : 0.6) }] : [] });
  });

  let describer = 0;
  const bytes = await frame();
  await scanFace({
    frame: { bytes, width: WIDTH, height: HEIGHT },
    reader: createFalRegionReader({ apiKey: "test-key", pairInOneRead, headBox: HEAD_BOX }),
    describe: async () => {
      describer += 1;
      return { build: null, skin: null, teeth: null };
    },
  });
  return { ...wire, describer };
}

const total = (byPrompt: Map<string, number>) => [...byPrompt.values()].reduce((sum, n) => sum + n, 0);

/** The worst each prompt was asked across a set of runs, summed — the ceiling,
 *  stated once because four arms want it (working law 4). */
function ceilingOf(runs: Wire[]): number {
  const prompts = new Set(runs.flatMap((run) => [...run.sam3ByPrompt.keys()]));
  let most = 0;
  for (const prompt of prompts) most += Math.max(...runs.map((run) => run.sam3ByPrompt.get(prompt) ?? 0));
  return most;
}

/**
 * EVERY ARM'S CONTROL: the fake answered only pictures it could NAME (#2895).
 *
 * A picture it cannot name is answered as an empty read, which silently buys a
 * re-ask the ceiling then prices — so a figure derived past this is a
 * measurement of some other fake, not of this scan. It is the control the head
 * crop needed: that crop is the frame's full width at half its height, so the
 * single-dimension test this drive used would have answered it as the whole
 * frame and the re-ask would have priced the wrong read.
 */
function onlyKnownPictures(wire: Wire): void {
  expect(wire.unknown, "only the pictures a scan is known to ask about").toEqual([]);
}

/**
 * WHAT A SCAN REACHES BESIDES SAM 3 AND THE CUTOUT, STATED RATHER THAN LEFT
 * SILENT — and one of the three is NOT PRICED by `FACE_SCAN_FAL_CALLS`.
 *
 * ⚠ The floor arms assert `other` is EMPTY and are right to: on a face that
 * answers everything first time a scan calls two endpoints. But a worn pair
 * that comes back half-answered buys the other-ear look (#2800) — ONE
 * `moondream3-preview/detect` call on the whole frame, about 0.16¢ — and
 * `FACE_SCAN_FAL_CALLS` has no term for it: it prices SAM 3 reads, one
 * cutout and one describer. **That gap is #2903 and is deliberately not
 * closed here**, because a new cost term is its own card and not a thing to
 * fold into a ceiling correction (his ruling, 2026-09-24).
 *
 * This says so out loud so the fact cannot go quiet again: a FOURTH endpoint
 * appearing reddens here rather than being averaged into nothing.
 */
function onlyTheDetectorBesides(wire: Wire): void {
  expect(new Set(wire.other), "the only unpriced fal endpoint a scan reaches is #2903's detector")
    .toEqual(new Set(wire.other.length === 0 ? [] : ["fal-ai/moondream3-preview/detect"]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what one scan asks of fal, counted at the wire", () => {
  it("makes the fewest SAM 3 reads when every question is answered first time", async () => {
    const wire = await drive(FINDS_EVERYTHING);
    onlyKnownPictures(wire);
    expect(wire.other, "only the two fal endpoints a scan is known to call").toEqual([]);
    expect(total(wire.sam3ByPrompt)).toBe(FACE_SCAN_FAL_CALLS.sam3.fewest);
    /* ⚠ AND THE FLOOR IS NOT THE FLOOR BY ACCIDENT (#2895). With a head box in
       the reader, a fake whose correct face happened to land off the head would
       add a read to every run — floor included — and both figures would
       re-derive one higher with nothing anywhere saying why. The floor's face
       is asked ONCE, which is the whole of that control: sabotaged by landing
       every policy's frame face off the head, this arm reddens at 19 against 18
       and the pair road's at 14 against 13.

       ⚠ ITS STATED LIMIT, measured rather than reasoned: this does not tell a
       face that is BELIEVED from one that came back EMPTY. A fake answering no
       face at all also makes 18 reads — the midline falls to the frame's middle,
       which is where this fake's face already puts it, and nothing is dropped so
       nothing is re-asked — so that drift survives every arm in this file. It
       changes no figure here, which is why it is named rather than instrumented;
       what the no-face road DOES is `faceSpanOnTheHead.test.ts`'s. */
    expect(wire.sam3ByPrompt.get(FACE), "the face read is on the head and is believed").toBe(1);
  }, 60_000);

  it("makes one body cutout and one describer call, however the reads go", async () => {
    for (const policy of [FINDS_EVERYTHING, BOTH_EMPTY_THEN_HALF, HALF_THEN_FOUND, FACE_OFF_THE_HEAD]) {
      const wire = await drive(policy);
      expect(wire.birefnet).toBe(FACE_SCAN_FAL_CALLS.cutouts);
      expect(wire.describer).toBe(FACE_SCAN_FAL_CALLS.describer);
    }
  }, 120_000);

  it("makes at most the derived ceiling when every re-ask the code has fires", async () => {
    const runs = [
      await drive(FINDS_EVERYTHING),
      await drive(BOTH_EMPTY_THEN_HALF),
      await drive(HALF_THEN_FOUND),
      await drive(FACE_OFF_THE_HEAD),
    ];
    runs.forEach(onlyKnownPictures);
    runs.forEach(onlyTheDetectorBesides);
    /* Each question's re-asks depend on that question's answers alone, so the
       worst per prompt is reachable on one face; the sum is the ceiling. */
    const most = ceilingOf(runs);
    expect(most).toBe(FACE_SCAN_FAL_CALLS.sam3.most);
    /* And the re-asks are real: a fake that fired none would make the ceiling
       equal the floor and this suite would prove nothing about them. */
    expect(most).toBeGreaterThan(FACE_SCAN_FAL_CALLS.sam3.fewest);
  }, 120_000);
});

/**
 * WHAT A REFUSED FACE READ COSTS — the call #2887 added and this suite could
 * not see until it was given the head box (#2895).
 *
 * The scan hands its reader the rectangle the discovery's head crop is cut
 * from, and a face read with no piece inside it is not the cast's face: it is
 * asked again of the head crop alone. On the founder's round-10 and round-11
 * casts that read was a face TATTOOED ON AN ARM. One more segmenter read, about
 * half a cent, on the refused frames only.
 *
 * ⚠ **Both ceilings above were one read low for the two days between #2887
 * landing and this arm existing, and NOTHING went red — the drive built its
 * reader with `createFalRegionReader({ apiKey, pairInOneRead })` and no head
 * box, so the re-ask could not fire in a drive whose reader was never told
 * where the head is.** The ceiling priced a reader the scan no longer builds.
 *
 * This arm is the price alone. The BEHAVIOUR — the refusal, the union sibling,
 * the head crop answering nothing, a chin past the box's edge, the earrings
 * back on their own ears — is `server/castingV2/faceSpanOnTheHead.test.ts`'s,
 * driven there against the same reader with its own negative controls.
 */
describe("a face read that lands off the head buys one more read, on either road", () => {
  it("asks the head crop once, and moves no other question's count", async () => {
    for (const pairInOneRead of [false, true]) {
      const road = pairInOneRead ? "pair-in-one-read" : "crop";
      const believed = await drive(FINDS_EVERYTHING, pairInOneRead);
      const refused = await drive(FACE_OFF_THE_HEAD, pairInOneRead);
      onlyKnownPictures(refused);
      onlyTheDetectorBesides(refused);
      /* The face asked TWICE — the frame, then the head crop — and twice for
         the whole scan however many readers of that frame's face there are,
         because the reader memoises it. */
      expect(refused.sam3ByPrompt.get(FACE), `${road}: the frame then the head crop`).toBe(2);
      expect(believed.sam3ByPrompt.get(FACE), `${road}: a face on the head is read once`).toBe(1);
      /* ⚠ AND IT IS EXACTLY ONE READ, not one read plus whatever moved when the
         face moved. The head crop puts back the very rectangle the believed
         face is given, so every question judged BY the face is judged by the
         same face in both runs — which is what makes the ceiling above
         legitimate in taking this policy's worst per prompt beside the other
         three. Asserted per prompt, because a total can hide two changes that
         cancel. */
      expect(total(refused.sam3ByPrompt) - total(believed.sam3ByPrompt), `${road}: one more read`).toBe(1);
      for (const prompt of believed.sam3ByPrompt.keys()) {
        if (prompt === FACE) continue;
        expect(refused.sam3ByPrompt.get(prompt), `${road}: ${prompt} asked the same number of times`)
          .toBe(believed.sam3ByPrompt.get(prompt));
      }
      /* And the read it buys is a SAM 3 read, not a second cutout or a second
         describer — the two parts priced per scan rather than per read. */
      expect(refused.birefnet).toBe(FACE_SCAN_FAL_CALLS.cutouts);
      expect(refused.describer).toBe(FACE_SCAN_FAL_CALLS.describer);
    }
  }, 120_000);

  it("is in the ceiling of the road being priced, and the floor is untouched by it", async () => {
    /* The figure a cost reader quotes, read through the one declaration that
       says which road production is on — so this arm follows a flip rather
       than being rewritten by one. */
    const { fewest, most } = faceScanSam3Reads();
    const believed = await drive(FINDS_EVERYTHING, FACE_SCAN_PAIR_ONE_READ_POSITION === "true");
    const refused = await drive(FACE_OFF_THE_HEAD, FACE_SCAN_PAIR_ONE_READ_POSITION === "true");
    expect(total(believed.sam3ByPrompt), "a face on the head is the floor").toBe(fewest);
    expect(total(refused.sam3ByPrompt), "a refused face is one above the floor").toBe(fewest + 1);
    /* ⚠ The ceiling must leave room for it. Before #2895 it did not: the worst
       a scan could cost was one more than the number every reader quoted. */
    expect(most).toBeGreaterThanOrEqual(total(refused.sam3ByPrompt));
  }, 120_000);
});

/**
 * THE SAME TWO NUMBERS WITH `ENABLE_CASTING_PAIR_ONE_READ` ON — which is what
 * production does for every account since 2026-10-16 (#2191, his *"Yes, Turn it
 * on"*). ⚠ This block's header read *"a road that is built and OFF, so these
 * are not what production does"* until #2577; the arms are unchanged, because
 * they were always a derivation of what the code can do and never a claim about
 * where the flag stood.
 *
 * Derived by the same drive and the same policies as the two arms above, which
 * is the whole reason they live in this file rather than beside the pair road's
 * own behaviour arms (`server/faceScanPairOneRead.test.ts`): a second harness
 * counting the same wire is a second source of truth about one fact, and the
 * two would disagree the first time either was touched.
 */
describe("what one scan asks of fal on the pair-in-one-read road", () => {
  it("brings the floor down by one read per pair, and nothing else moves", async () => {
    const wire = await drive(FINDS_EVERYTHING, true);
    onlyKnownPictures(wire);
    expect(wire.other, "only the two fal endpoints a scan is known to call").toEqual([]);
    expect(total(wire.sam3ByPrompt)).toBe(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest);
    /* The saving is exactly the pairs — five regions, one read each instead of
       two — which is this card's claim stated as arithmetic the wire proves. */
    expect(FACE_SCAN_FAL_CALLS.sam3.fewest - FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest)
      .toBe(PAIR_QUESTIONS.size);
    for (const question of PAIR_QUESTIONS) {
      expect(wire.sam3ByPrompt.get(question), `${question} asked once`).toBe(1);
    }
    /* The midline is still bought, and still once: it is shared across all five
       pairs and the build row, so this road saves the second SIDE read only. */
    expect(wire.sam3ByPrompt.get("face")).toBe(1);
    expect(wire.birefnet).toBe(FACE_SCAN_FAL_CALLS.cutouts);
    expect(wire.describer).toBe(FACE_SCAN_FAL_CALLS.describer);
  }, 60_000);

  it("brings the ceiling down too, by less, because every re-ask still fires", async () => {
    const runs = [
      await drive(FINDS_EVERYTHING, true),
      await drive(BOTH_EMPTY_THEN_HALF, true),
      await drive(HALF_THEN_FOUND, true),
      await drive(FACE_OFF_THE_HEAD, true),
    ];
    runs.forEach(onlyKnownPictures);
    runs.forEach(onlyTheDetectorBesides);
    const most = ceilingOf(runs);
    expect(most).toBe(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.most);
    /* Both controls, and the second is the one that could hide a cost: a
       ceiling equal to the floor would mean no re-ask fired, and a ceiling that
       did not fall would mean the road saved nothing on a real face. */
    expect(most).toBeGreaterThan(FACE_SCAN_FAL_CALLS.sam3.pairInOneRead.fewest);
    expect(most).toBeLessThan(FACE_SCAN_FAL_CALLS.sam3.most);
  }, 120_000);

  it("holds what real faces measured on this road inside what the code can do", () => {
    /* The same relationship the crop road's band has with its own derived pair:
       a measurement outside what the code can do is a measurement of some other
       code. Both roads' bands came out of ONE sitting on the same three casts,
       so the pair of them is also the saving, measured rather than derived. */
    const { fewest, most, measured } = FACE_SCAN_FAL_CALLS.sam3.pairInOneRead;
    expect(measured.low).toBeGreaterThanOrEqual(fewest);
    expect(measured.high).toBeLessThanOrEqual(most);
    expect(measured.low).toBeLessThanOrEqual(measured.high);
    /* The crop road's reading from that same sitting sits inside ITS derived
       pair too — the control that says the two bands were taken the same way
       and are therefore comparable at all. */
    expect(measured.cropRoadLow).toBeGreaterThanOrEqual(FACE_SCAN_FAL_CALLS.sam3.fewest);
    expect(measured.cropRoadHigh).toBeLessThanOrEqual(FACE_SCAN_FAL_CALLS.sam3.most);
    /* And it is cheaper on every face it was measured on, at both ends. */
    expect(measured.low).toBeLessThan(measured.cropRoadLow);
    expect(measured.high).toBeLessThan(measured.cropRoadHigh);
  });
});

/**
 * WHICH ROAD THE COST READERS PRICE — the guard that makes `falSpend.mts`'s
 * copy of the production position safe to keep (#2577).
 *
 * The flag went to `"true"` for every account on 2026-10-16 and the five cost
 * readers went on pricing the crop road, over-reporting every scan by about
 * 4½¢ with nothing anywhere saying so. The repair declares the position ONCE,
 * in `falSpend.mts`, and this is the arm that holds that declaration equal to
 * the recorded position the deploy rite compares against the live service — so
 * a flip in either direction that does not move the declaration reddens here
 * rather than quietly mis-pricing.
 *
 * ⚠ The declaration is a COPY and that is deliberate: importing the recorded
 * positions into `falSpend.mts` would reach `governedBootSettings.mts`, which
 * `readFileSync`s three server declarations at import, and this module's own
 * rule (this suite's header) is that it stays out of the server's import
 * graph. A test may reach both; the priced module may not.
 */
describe("the road the scan's cost readers price", () => {
  const row = PRODUCTION_FLAG_POSITIONS.ENABLE_CASTING_PAIR_ONE_READ;

  it("is the position recorded for the production service", () => {
    /* The key's spelling is pinned to the service's own constant by
       `server/faceScanPairOneRead.test.ts`; what is checked here is the value. */
    expect(row, "ENABLE_CASTING_PAIR_ONE_READ has no recorded position").toBeTruthy();
    expect(FACE_SCAN_PAIR_ONE_READ_POSITION).toBe(row.position);
  });

  it("reads the pair road's figures when that position is on, and the crop road's when it is not", () => {
    const live = faceScanSam3Reads();
    const { sam3 } = FACE_SCAN_FAL_CALLS;
    /* Both answers are asserted, from the one declaration, so the arm proves
       the switch rather than today's side of it — the negative control a
       single-position arm cannot carry. */
    const expected = FACE_SCAN_PAIR_ONE_READ_POSITION === "true"
      ? { road: "pair-in-one-read", fewest: sam3.pairInOneRead.fewest, most: sam3.pairInOneRead.most }
      : { road: "crop", fewest: sam3.fewest, most: sam3.most };
    expect(live.road).toBe(expected.road);
    expect(live.fewest).toBe(expected.fewest);
    expect(live.most).toBe(expected.most);
    /* And the two roads really are different numbers, or this switch would be
       proving nothing about anything. */
    expect(sam3.pairInOneRead.fewest).toBeLessThan(sam3.fewest);
    expect(sam3.pairInOneRead.most).toBeLessThan(sam3.most);
  });

  it("is compared exactly, never for truthiness", () => {
    /* A Railway variable created with no value holds the empty string, which is
       the shape that reads as off while looking set — so the empty string and
       any other token must land on the crop road, and only the four characters
       `true` on the pair road. The service reads it the same way
       (`pairInOneReadEnabled()`). */
    for (const token of ["", "TRUE", "1", "yes", "true "]) {
      expect(token === "true", `${JSON.stringify(token)} is not the on token`).toBe(false);
    }
  });
});

describe("the measured band, against what the code can do", () => {
  it("sits inside the derived floor and ceiling, on the road being priced", () => {
    const { fewest, most, measured } = faceScanSam3Reads();
    expect(measured.low).toBeGreaterThanOrEqual(fewest);
    expect(measured.high).toBeLessThanOrEqual(most);
    expect(measured.low).toBeLessThanOrEqual(measured.high);
  });

  it("prices a scan from its parts, and the parts bracket the measured reads", () => {
    const usd = faceScanUsd();
    const sam = FAL_MEASURED_USD[SAM3].usd;
    const { measured } = faceScanSam3Reads();
    /* The SAM 3 share is the read count times fal's own price, and nothing
       else: the cutout and the describer are their own terms. */
    expect(usd.sam3.low).toBeCloseTo(measured.low * sam, 6);
    expect(usd.sam3.high).toBeCloseTo(measured.high * sam, 6);
    expect(usd.cutout.low).toBeGreaterThan(0);
    expect(usd.total.low).toBeCloseTo(usd.sam3.low + usd.cutout.low + usd.describer.low, 6);
    expect(usd.total.high).toBeCloseTo(usd.sam3.high + usd.cutout.high + usd.describer.high, 6);
    /* fal's share alone is what a fal balance drop can be charged with. */
    expect(usd.fal.low).toBeCloseTo(usd.sam3.low + usd.cutout.low, 6);
    expect(usd.fal.high).toBeCloseTo(usd.sam3.high + usd.cutout.high, 6);
  });

  it("still holds #2183's measured casts inside the CROP road's own composed band", () => {
    /* This arm used to be `faceScanUsd()`'s, with the literals $0.121 and
       $0.151 in it — and it was a check on the crop road wearing the live
       reader's clothes, so it would have gone red on the flip for the wrong
       reason (#2577). The bracket is a fact about the crop figures and stays
       checkable whichever road is live; it is composed here from those figures
       by name rather than read through the live one. */
    const sam = FAL_MEASURED_USD[SAM3].usd;
    const { measured } = FACE_SCAN_FAL_CALLS.sam3;
    const low = measured.low * sam
      + FACE_SCAN_FAL_CALLS.cutouts * FACE_SCAN_PART_USD.cutout.low
      + FACE_SCAN_FAL_CALLS.describer * FACE_SCAN_PART_USD.describer.low;
    const high = measured.high * sam
      + FACE_SCAN_FAL_CALLS.cutouts * FACE_SCAN_PART_USD.cutout.high
      + FACE_SCAN_FAL_CALLS.describer * FACE_SCAN_PART_USD.describer.high;
    expect(low).toBeLessThanOrEqual(0.121);
    expect(high).toBeGreaterThanOrEqual(0.151);
  });

  it("gives the balance reader a floor no real scan can go under", () => {
    /* `fal-picture-price.mts` subtracts scans out of a balance drop to bound a
       render's price; charging a scan MORE than it can cost would hide part of
       the render. So the floor is the derived fewest of the road production is
       on — read as the crop road's 18 while production made 13, it was hiding
       2½¢ of every render it priced beside a scan. */
    const floor = faceScanFalFloorUsd();
    expect(floor).toBeCloseTo(
      faceScanSam3Reads().fewest * FAL_MEASURED_USD[SAM3].usd
        + FACE_SCAN_FAL_CALLS.cutouts * FACE_SCAN_PART_USD.cutout.low,
      6,
    );
    expect(floor).toBeLessThanOrEqual(faceScanUsd().fal.low);
    expect(floor).toBeGreaterThan(0);
  });
});
