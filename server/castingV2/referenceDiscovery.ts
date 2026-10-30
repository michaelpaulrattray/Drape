/**
 * THE REFERENCE READING — what is in the picture a customer attached, and where
 * each thing sits (#14 slice 2, the build design's §4 and §9).
 *
 * # What it is for, in his words
 *
 * *"the selector should not be confined to a set list nothing should be confined
 * to a set list thats the old way of doing things the new way is the image is
 * analyzed and features are determined that way right?"* (2026-10-28). So this
 * road asks the PICTURE what is in it and boxes whatever it names. There is no
 * vocabulary here, and `REFERENCE_INTENTS` is deliberately not imported — his
 * word retired that routing for this road (the design's §2).
 *
 * # WHAT THIS SLICE PRODUCES, AND IT IS LESS THAN THE CARD
 *
 * A bounded list of named, boxed MARKERS, in memory. Nothing else. No cut is
 * taken, no `casting_reference_crops` row is minted, no byte is stored, nothing
 * reaches a render, and no customer sees a marker — the surface is slice 3's and
 * the tap's cut is slice 4's. This module buys the answer those slices draw.
 *
 * # THE READING IS THE DISCOVERY SHAPE WITH A DIFFERENT SUBJECT
 *
 * On a cast the read asks *what is on this character* over a head crop and a
 * full frame merged. A reference may be a person, a garment on a hanger, or a
 * product shot — so this variant asks the FULL FRAME FIRST and adds the head
 * crop only when a person is actually present.
 *
 * ⚠ **AND "A PERSON IS PRESENT" IS ANSWERED BY THE READING, NEVER BY A NOUN
 * LIST.** The tempting implementation is a set of person-ish words (`face`,
 * `hair`, `eyes`) checked against the names that came back — which is the fixed
 * list his word forbids, wearing a routing hat. The schema asks for it instead
 * ({@link REFERENCE_DISCOVERY_SCHEMA}'s `personPresent`), so the picture tells
 * us whether a head crop is worth buying and no vocabulary decides it.
 *
 * # ⚠ THE MEASURED CLAUSES ARE COPIED, NOT PARAPHRASED
 *
 * `faceDiscovery.ts`'s prompt carries a ⚠ forbidding re-wording: its grouping
 * paragraph is byte-identical to the one #2566's bench ran, and *"a paraphrase
 * of this clause invalidates the bench"*. Those clauses govern BARENESS, KIND
 * and COVERAGE, which this road needs unchanged — a name here becomes a
 * `regionInBox` neighbour and a detector prompt exactly as it does there.
 *
 * So they are copied VERBATIM and only the subject framing differs, and
 * {@link REFERENCE_DISCOVERY_SHARED_CLAUSES} is the list a guard holds equal in
 * both prompts (`referenceDiscovery.test.ts`). The cast prompt's bytes are not
 * touched by this build: it is frozen by a ruling, so copying from it is safe
 * in a way copying from a live artifact would not be — and the guard is what
 * stops the copy going quietly stale if the freeze is ever lifted.
 *
 * # IT FAILS OPEN TO WORDS, SILENTLY, COSTING NOTHING
 *
 * The same property `faceDiscovery.ts` holds for scans: `{ ok: false }` means
 * the picture simply presents with no markers and the words road untouched. A
 * provider's bad minute must never make an attach look broken, and nothing on
 * this road is charged to a customer either way.
 *
 * # ⚠ WHAT THE CAP ACTUALLY BOUNDS, SAID PRECISELY
 *
 * The design says markers are bounded *"(a cap near 12, largest-first) so a busy
 * photo is a surface and not a quiz"*. Read as written that orders markers by
 * area, which is only knowable AFTER every detect has been bought — so a
 * thirty-name photograph would buy thirty detects to then discard eighteen.
 * {@link REFERENCE_MARKER_CAP} therefore bounds BOTH: at most that many names
 * are asked of the detector, in the reading's own order, and the markers that
 * survive are ordered largest-first. Everything found stays takeable by WORDS
 * whether it was marked or not, which is why dropping the tail costs a customer
 * nothing — {@link ReferenceReading}'s `unmarked` carries them.
 *
 * # ⚠ TWO NAMES CAN COME BACK WITH ONE RECTANGLE, AND THAT IS #2787's
 *
 * The slice-1 court measured it on a real reference photograph: `nose ring` and
 * `earring` returned the same box to the pixel, and at the frame it was the
 * earring. **This module does not fix it and must not pretend to** — it is
 * #2787, its own card, `blocked`. What it does is refuse to ASSUME one noun is
 * one thing: a collision is counted and logged with both nouns, so the surface
 * slice inherits a measured fact rather than rediscovering it, and a marker is
 * never silently dropped on the strength of a box it shares.
 *
 * # ⚠ AND ONE NAME CAN COME BACK AS SEVERAL PARTS — #2842, ALSO RECORDED ONLY
 *
 * The other half of the same lesson, measured in the same court: `laces` on a
 * product shot returned **nine boxes** and the marker that reached the surface
 * was a **57x66 speck of one lace** on a 1536x1024 frame. {@link biggestOf} is
 * unchanged and still keeps the biggest, because a union is right for a lacing
 * and wrong for four pockets and nobody has measured which nouns are which.
 *
 * What changed is that nothing is thrown away any more:
 * {@link ReferenceMarker}'s `spread` carries the part count, their union and
 * its fill, **and the reading's own `count` and `coverage`**, which this road
 * had been dropping on the way into the marker while the CAST road decided
 * exactly this question on both of them. Every one of those facts was already
 * paid for. The law's clause 4 names that as the cheapest finding available,
 * and {@link referenceBoxes} carries the arithmetic for both reference roads.
 */
import { biggestOf, spreadOf } from "./referenceBoxes";
import { boundForJudge } from "./judgeFrame";
import { isBareNoun, mergeDiscoveries, parseDiscovery } from "./faceDiscovery";
import { createModuleLogger } from "../logging/logger";
import type { BoxSpread } from "./referenceBoxes";
import type { DiscoveredFeature, FeatureCoverage, FeatureKind, UnseenFeature } from "./faceDiscovery";
import type { PointerBox, RegionReader } from "./maskedRefine";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/referenceDiscovery");

/**
 * The geometry, taken from the cast road rather than chosen again.
 *
 * `ASK_WIDTH` and `HEAD_FRACTION` are `faceDiscovery.ts`'s own numbers. They are
 * restated here because that module does not export them, and they are kept
 * EQUAL on purpose: the only thing that should differ between a cast reading and
 * a reference reading is what is in the picture, not how many pixels the model
 * was handed.
 */
const HEAD_FRACTION = 0.5;
const ASK_WIDTH = 768;

/**
 * How many names reach the detector, and how many markers come back.
 *
 * Twelve is the design's *"a cap near 12"*. It is a CEILING on both halves —
 * see the module header for why one number does both jobs — and it is the only
 * thing bounding the detect spend on a busy photograph: the slice-1 court
 * measured ~1.8 s and a fraction of a cent per detect, so twelve is about 22 s
 * of house money at worst, and fourteen names was a real reading.
 */
export const REFERENCE_MARKER_CAP = 12;

/** One thing the reading named and the detector put a rectangle round. */
export type ReferenceMarker = {
  /** The reading's own bare noun — the detector's prompt, and the tap's word. */
  readonly name: string;
  /** What sort of thing it is, carried so slice 3 can group without re-asking. */
  readonly kind: FeatureKind;
  /** The detector's rectangle, in the attached picture's own pixels. */
  readonly box: PointerBox;
  /**
   * The box's area in pixels. Carried rather than recomputed because it is what
   * the cap ordered on, and a surface that re-derives it can order differently
   * from the list it was handed.
   */
  readonly area: number;
  /**
   * WHAT CAME BACK FOR THIS NOUN, AND WHAT THE READING SAID ABOUT IT — #2842.
   *
   * Recorded, never acted on. `box` above is still the biggest rectangle and
   * this slice decides nothing differently; what this closes is that the facts
   * were being bought and thrown away.
   */
  readonly spread: MarkerSpread;
};

/**
 * THE THREE THINGS THE ENGINE ALREADY ANSWERED ABOUT ONE NOUN — #2842.
 *
 * All of it was bought before this type existed and none of it was kept: the
 * detector's part count and their union were discarded by a sort, and the
 * READING's own `count` and `coverage` were dropped on the way into
 * {@link ReferenceMarker}. The disappearing-technology law's clause 4 — *read
 * what the engine already gives you before reaching for a better one* — is the
 * whole of why this is a recording and not a repair.
 *
 * ⚠ **AND THE SIBLING ROAD ALREADY DECIDES THIS EXACT QUESTION ON THE TWO
 * DROPPED FIELDS, which is the fact that makes the omission a defect rather
 * than a tidiness note.** On a cast, `pointerCut.ts` reads `coverage ===
 * "scattered"` to send a thing to WORDS with no cut at all (`foundRoadOf`), and
 * reads `count` to decide how many of the detector's rectangles become rows
 * (`boxes.slice(0, Math.max(1, feature.count))`) — so the cast road cuts one
 * region per instance where this road keeps one fragment of one.
 */
export type MarkerSpread = {
  /** How many rectangles the detector returned, their union, and its fill. */
  readonly boxes: BoxSpread;
  /** How many of it the READING said are visible. At least 1. */
  readonly said: number;
  /** `single` or `scattered`, as the READING answered it. */
  readonly saidCoverage: FeatureCoverage;
};

export type ReferenceReading =
  | {
    readonly ok: true;
    /** Largest-first, at most {@link REFERENCE_MARKER_CAP}. */
    readonly markers: readonly ReferenceMarker[];
    /**
     * Named and NOT marked — past the cap, not a bare noun, or the detector
     * found no such thing. Every one stays takeable by words, which is the
     * whole reason the cap costs a customer nothing.
     */
    readonly unmarked: readonly string[];
    /** Whether the picture held a person, as the reading itself answered. */
    readonly personPresent: boolean;
    /** Which crops answered, so a half-answer is legible rather than mysterious. */
    readonly crops: readonly ("head" | "full")[];
  }
  | {
    /**
     * The caller's behaviour is the same whatever `why` says: no markers, and
     * the words road exactly as it is today.
     */
    readonly ok: false;
    readonly why: string;
  };

/**
 * THE CLAUSES COPIED VERBATIM FROM THE CAST PROMPT — the guard's population.
 *
 * Each of these governs something this road needs identical to the cast road:
 * the bare-noun contract (a name becomes a detector prompt), and `coverage`.
 * The module header carries why they are copied rather than shared or
 * paraphrased. A guard asserts every one of them appears in
 * `DISCOVERY_SYSTEM_PROMPT` too, so the copy cannot go stale in silence.
 */
export const REFERENCE_DISCOVERY_SHARED_CLAUSES: readonly string[] = [
  "THE NAME MUST BE A SHORT BARE NOUN — one or two plain words, the words a person would",
  "use pointing at it. No description, no colour, no material, no position, no brackets, no",
  "commas, no 'with' or 'on' clauses. Write 'hair', not 'dark hair in a high bun'. Write",
  "- coverage: 'single' if it is one thing or one connected piece you could draw one tight",
  "  outline around (a tattoo piece or a jacket is single); 'scattered' if it is many separate",
  "  small bits spread over an area, like freckles, scales or stubble.",
];

/**
 * THE PROMPT — the cast prompt's measured clauses under a different subject.
 *
 * What differs, and it is only the subject: the opening says this is a picture
 * somebody attached rather than a frame of a character; the three questions the
 * design names are asked explicitly (*what is this picture of; what is the
 * person wearing; what is the standalone item*); and `personPresent` is asked
 * for, because the head crop is bought on its answer.
 *
 * What is identical: bareness, `coverage`, the count, and the two rules about
 * naming only what is visible. Those are the bench's and are copied.
 */
export const REFERENCE_DISCOVERY_SYSTEM_PROMPT = [
  "You are looking at a picture somebody attached as a reference, and naming the things in it",
  "that could be taken out and used.",
  "",
  "First say what this picture is of. It may be a person, a garment on a hanger or laid flat,",
  "a product shot of a single item, or something else entirely — do not assume a person.",
  "Then name EVERY distinct thing in it that somebody could point at and want: if there is a",
  "person, what they are wearing and what is on them; if it is a standalone item, that item",
  "and its parts. Do not work from a fixed list — name what is actually there, whatever it is.",
  "",
  "Say whether a person is present, in `personPresent`. True only if you can actually see a",
  "person or part of one.",
  "",
  "THE NAME MUST BE A SHORT BARE NOUN — one or two plain words, the words a person would",
  "use pointing at it. No description, no colour, no material, no position, no brackets, no",
  "commas, no 'with' or 'on' clauses. Write 'hair', not 'dark hair in a high bun'. Write",
  "'jacket', not 'oversized denim jacket'. Write 'earring', not 'dangling dark earrings'.",
  "Everything you want to add about it goes in `about`.",
  "",
  "Give a count. If a thing comes as a matched pair or set, say how many you can see.",
  "",
  "For each thing, also say what SORT of thing it is and where it belongs:",
  "- kind: 'anatomy' for a part of a body — INCLUDING anything fixed to or embedded in the",
  "  body, such as an implant, body hardware or a prosthetic, whatever word names it;",
  "  'clothing' for a garment, worn or not; 'accessory' for a small item such as jewellery, a",
  "  piercing ring, glasses or a bag; 'marking' for something on skin such as a tattoo, scar,",
  "  mole or freckles; 'makeup' for cosmetics.",
  "- on: if this thing sits on or is part of another thing you named, give that thing's bare",
  "  noun (a lip ring is on 'lips', a pocket is on 'jacket'). Otherwise ''.",
  "- coverage: 'single' if it is one thing or one connected piece you could draw one tight",
  "  outline around (a tattoo piece or a jacket is single); 'scattered' if it is many separate",
  "  small bits spread over an area, like freckles, scales or stubble.",
  "",
  "Two rules matter more than completeness:",
  "1. Name ONLY what you can actually see in this picture. Never infer a thing from what the",
  "   picture seems to be about, and never name something because a picture like this usually",
  "   has one.",
  "2. If something is hidden, cut off by the frame, or too small or blurred to be sure of, put",
  "   it in `cannotSee` with the reason instead of naming it. Saying you cannot see something",
  "   is a correct answer, not a failure.",
].join("\n");

/**
 * The shape, enforced by the provider rather than hoped for.
 *
 * `faceDiscovery.ts`'s schema with one field added: `personPresent`, which
 * decides whether a head crop is bought. The two closed facts stay ENUMS for
 * that module's stated reason — a sixth `kind` would be a vocabulary, which is
 * the thing the N3 principle forbids — and `on` stays open because it is a noun
 * the reading chose.
 */
export const REFERENCE_DISCOVERY_SCHEMA = {
  name: "reference_discovery",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["personPresent", "features", "cannotSee"],
    properties: {
      personPresent: {
        type: "boolean",
        description: "true only if a person or part of one is visible",
      },
      features: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "count", "about", "kind", "on", "coverage"],
          properties: {
            name: { type: "string", description: "a short bare noun, one or two plain words" },
            count: { type: "integer", description: "how many of this thing are visible" },
            about: { type: "string", description: "anything worth saying about it, in words" },
            kind: { type: "string", enum: ["anatomy", "clothing", "accessory", "marking", "makeup"] },
            on: { type: "string", description: "bare noun of the thing this sits on, or ''" },
            coverage: { type: "string", enum: ["single", "scattered"] },
          },
        },
      },
      cannotSee: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "why"],
          properties: { name: { type: "string" }, why: { type: "string" } },
        },
      },
    },
  },
} as const;

/** One picture the reading asks about. */
export type ReferenceCrop = { kind: "head" | "full"; bytes: Buffer; contentType: string };

/**
 * Whether the reading said a person is there.
 *
 * Read off the raw text rather than through `parseDiscovery`, which is the cast
 * road's parser and knows nothing about this field. A missing or non-boolean
 * answer reads FALSE — the conservative direction, because a false negative
 * costs one unbought head crop and a false positive buys a call on a hanger.
 */
export function parsePersonPresent(text: string): boolean {
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const read = (raw: string): boolean | null => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;
      const held = (parsed as { personPresent?: unknown }).personPresent;
      return typeof held === "boolean" ? held : null;
    } catch {
      return null;
    }
  };
  const direct = read(stripped);
  if (direct !== null) return direct;
  const brace = stripped.indexOf("{");
  const close = stripped.lastIndexOf("}");
  if (brace < 0 || close <= brace) return false;
  return read(stripped.slice(brace, close + 1)) ?? false;
}

/**
 * Cut one picture for the reading, at the cast road's width.
 *
 * Never throws: a frame `sharp` cannot read returns `null` and the caller turns
 * that into the fail-open answer.
 */
async function cropOf(
  frame: { bytes: Buffer; width: number; height: number },
  kind: "head" | "full",
): Promise<ReferenceCrop | null> {
  try {
    const sharp = (await import("sharp")).default;
    const bytes = kind === "full"
      ? await sharp(frame.bytes).resize({ width: ASK_WIDTH }).png().toBuffer()
      : await sharp(frame.bytes)
        .extract({
          left: 0,
          top: 0,
          width: frame.width,
          height: Math.round(frame.height * HEAD_FRACTION),
        })
        .resize({ width: ASK_WIDTH })
        .png()
        .toBuffer();
    /* Through the shared bound, not past it (#1413) — `faceDiscovery.ts`'s own
       reason: a later edit to the ask width must not walk past the judge's
       frame bound with nothing going red. */
    const judged = await boundForJudge({ bytes, contentType: "image/png" });
    return { kind, bytes: judged.image.bytes, contentType: judged.image.contentType };
  } catch (error) {
    log.warn(
      { kind, why: error instanceof Error ? error.message : String(error) },
      "[referenceDiscovery] the reference crop could not be cut",
    );
    return null;
  }
}

type ReadAnswer = {
  features: DiscoveredFeature[];
  cannotSee: UnseenFeature[];
  unusable: string[];
  personPresent: boolean;
};

/** One text call, parsed, or `null` when it gave nothing usable. */
async function askOnce(input: {
  crop: ReferenceCrop;
  engine: TextEngine;
}): Promise<ReadAnswer | null> {
  const result = await input.engine.complete({
    system: REFERENCE_DISCOVERY_SYSTEM_PROMPT,
    user: "Name everything in this reference picture that could be taken out and used.",
    images: [{ bytes: input.crop.bytes, contentType: input.crop.contentType }],
    jsonSchema: REFERENCE_DISCOVERY_SCHEMA,
    about: "discover",
    /* The cast road's deadline and ceiling, for its reasons rather than new
       ones: 30 s is 1.6x the measured tail of this ask shape, `retries: 0`
       keeps one hung provider off a shared queue slot, and 2,000 output tokens
       covers the heaviest measured read — a reply cut off at the ceiling parses
       to a SHORTER list, which on this road would silently drop takeable
       things. The slice-1 court measured a real reference photograph at 8.3 s
       for 14 names over 2 crops, inside all three. */
    timeoutMs: 30_000,
    retries: 0,
    maxOutputTokens: 2_000,
  });
  if (result.truncated === true) {
    log.warn(
      { crop: input.crop.kind },
      "[referenceDiscovery] the reading was cut off at the ceiling — discarded",
    );
    return null;
  }
  const parsed = parseDiscovery(result.text);
  if (parsed === null) {
    log.warn({ crop: input.crop.kind }, "[referenceDiscovery] the reading could not be parsed");
    return null;
  }
  return { ...parsed, personPresent: parsePersonPresent(result.text) };
}

/**
 * READ THE ATTACHED PICTURE — the full frame first, the head crop only if a
 * person is in it.
 *
 * Sequential on purpose, which is the one place this costs more wall time than
 * the cast road's parallel pair: the second call exists only because the first
 * one said a person is present, and buying both in parallel would spend a text
 * call on every hanger shot to save a few seconds on portraits.
 */
export async function readReferencePicture(input: {
  frame: { bytes: Buffer; width: number; height: number };
  engine: TextEngine;
}): Promise<
  | {
    ok: true;
    features: readonly DiscoveredFeature[];
    cannotSee: readonly UnseenFeature[];
    unusable: readonly string[];
    personPresent: boolean;
    crops: readonly ("head" | "full")[];
  }
  | { ok: false; why: string }
> {
  if (input.frame.width < 64 || input.frame.height < 64) {
    return { ok: false, why: "the picture is too small to read" };
  }
  const full = await cropOf(input.frame, "full");
  if (full === null) return { ok: false, why: "the picture could not be cut" };

  let first: ReadAnswer | null;
  try {
    first = await askOnce({ crop: full, engine: input.engine });
  } catch (error) {
    return { ok: false, why: error instanceof Error ? error.message : String(error) };
  }
  if (first === null) return { ok: false, why: "the full-frame reading gave nothing usable" };

  /* No person, or no room for a head crop — the full frame is the whole
     reading, and that is the hanger and product-shot case the design names. */
  const headHeight = Math.round(input.frame.height * HEAD_FRACTION);
  if (!first.personPresent || headHeight < 64) {
    return {
      ok: true,
      features: first.features,
      cannotSee: first.cannotSee,
      unusable: first.unusable,
      personPresent: first.personPresent,
      crops: ["full"],
    };
  }

  const head = await cropOf(input.frame, "head");
  let second: ReadAnswer | null = null;
  if (head !== null) {
    try {
      second = await askOnce({ crop: head, engine: input.engine });
    } catch (error) {
      /* A failed SECOND call keeps the first one's answer. The cast road
         discards a part-answer because its two crops are peers; here the full
         frame is the reading and the head crop is an enrichment, so losing it
         costs detail rather than correctness. */
      log.warn(
        { why: error instanceof Error ? error.message : String(error) },
        "[referenceDiscovery] the head-crop reading failed — keeping the full frame's answer",
      );
    }
  }
  if (second === null) {
    return {
      ok: true,
      features: first.features,
      cannotSee: first.cannotSee,
      unusable: first.unusable,
      personPresent: true,
      crops: ["full"],
    };
  }
  /* The FULL frame is passed first, so `mergeDiscoveries` keeps its spelling of
     a name both crops saw — the mirror of the cast road, where the head crop is
     asked first and therefore wins. The subject here is the whole picture. */
  const merged = mergeDiscoveries([first, second]);
  return {
    ok: true,
    features: merged.features,
    cannotSee: merged.cannotSee,
    unusable: merged.unusable,
    personPresent: true,
    crops: ["full", "head"],
  };
}

/**
 * BOX WHAT THE READING NAMED — one detect per name, capped.
 *
 * Every failure is local to one name: a detector that errors or finds nothing
 * drops THAT marker and leaves every other one exactly as it is. A reader with
 * no `pointer` capability produces no markers at all, which is today's attach.
 */
export async function markReferenceThings(input: {
  picture: Buffer;
  features: readonly DiscoveredFeature[];
  reader: RegionReader;
  signal?: AbortSignal;
}): Promise<{ markers: ReferenceMarker[]; unmarked: string[] }> {
  const unmarked: string[] = [];
  const pointer = input.reader.pointer;
  if (pointer === undefined) {
    return { markers: [], unmarked: input.features.map((feature) => feature.name) };
  }

  const askable: DiscoveredFeature[] = [];
  for (const feature of input.features) {
    if (!isBareNoun(feature.name)) {
      /* Named in words no detector can use. It stays takeable by WORDS, which
         is why it is reported rather than discarded (#2570's lesson on the cast
         road: a parse rule became a deletion). */
      unmarked.push(feature.name);
      continue;
    }
    if (askable.length >= REFERENCE_MARKER_CAP) {
      unmarked.push(feature.name);
      continue;
    }
    askable.push(feature);
  }

  /*
    EVERY NAME IS ASKED AT ONCE, AND READ BACK IN THE READING'S ORDER (#2863).

    It was one ask after another, which is the shape no reader can gather: the
    boxer's measured request carries every name of a picture in ONE call, and a
    reader only sees the names that are waiting together. So all the asks start
    in the same turn and their answers are walked in the order the reading gave
    them, which leaves `markers` and `unmarked` exactly as the loop built them.
    On today's detector it is the same requests, through the same fal gate.
  */
  type Asked =
    | { feature: DiscoveredFeature; boxes: readonly PointerBox[] }
    | { feature: DiscoveredFeature; error: unknown };
  const asked = await Promise.all(askable.map(async (feature): Promise<Asked> => {
    try {
      const boxes = await pointer.call(input.reader, {
        image: input.picture,
        name: feature.name,
        signal: input.signal,
      });
      return { feature, boxes };
    } catch (error) {
      return { feature, error };
    }
  }));
  const markers: ReferenceMarker[] = [];
  for (const one of asked) {
    const feature = one.feature;
    if ("error" in one) {
      const error = one.error;
      log.warn(
        { name: feature.name, why: error instanceof Error ? error.message : String(error) },
        "[referenceDiscovery] the detector did not answer about this one — no marker, words still open",
      );
      unmarked.push(feature.name);
      continue;
    }
    const boxes = one.boxes;
    const box = biggestOf(boxes);
    const spread = spreadOf(boxes);
    if (box === null || spread === null) {
      /* An empty list is the ABSENCE answer and the pointer road rests on it
         (#2532's three negative controls). The reading named something the
         detector cannot find; words stay open. */
      unmarked.push(feature.name);
      continue;
    }
    markers.push({
      name: feature.name,
      kind: feature.kind,
      box,
      area: box.width * box.height,
      spread: { boxes: spread, said: feature.count, saidCoverage: feature.coverage },
    });
  }

  /*
    A NOUN THAT NAMES SEVERAL PARTS, RECORDED RATHER THAN RESOLVED (#2842).

    Measured on a product shot 2026-10-30: `laces` returned NINE boxes and the
    marker that reached the surface was a 57x66 speck of one lace. The card's
    own recommendation is this line and not a repair — *record the discarded box
    count and their union beside each marker first, and let the spread say which
    nouns want a union* — because `pocket` on one of four pockets is a perfectly
    good marker to tap and `laces` on one lace is not, and which nouns are which
    is unmeasured.

    ⚠ **The reading's own two answers are in here on purpose and they are the
    cheapest half of it**: `said` and `saidCoverage` were bought on the text
    call this road already pays for and were being dropped on the floor, while
    the CAST road decides this very question on both of them. A spread where the
    reading said `scattered`, or said more than one, is a different case from one
    where it said a single thing and the detector disagreed — and until now the
    log could not tell those apart.
  */
  const several = markers.filter((marker) => marker.spread.boxes.parts > 1);
  if (several.length > 0) {
    log.info(
      {
        nouns: several.map((marker) => ({
          name: marker.name,
          parts: marker.spread.boxes.parts,
          said: marker.spread.said,
          saidCoverage: marker.spread.saidCoverage,
          kept: marker.area,
          union: marker.spread.boxes.union.width * marker.spread.boxes.union.height,
          fill: Number(marker.spread.boxes.fill.toFixed(3)),
        })),
      },
      "[referenceDiscovery] these nouns came back as several parts and the biggest one was kept — #2842, recorded not resolved",
    );
  }

  /*
    TWO NAMES, ONE RECTANGLE — counted and logged, never resolved here (#2787).

    The slice-1 court measured this on a real photograph and read it at the
    frame: `nose ring` and `earring` came back identical and the box was the
    earring. Resolving it is that card's, and it is `blocked`. What this does is
    make the fact legible to the surface slice instead of leaving it to be
    rediscovered — and no marker is dropped for it, because which of the two
    nouns is wrong is exactly what nobody here knows.
  */
  const byBox = new Map<string, string[]>();
  for (const marker of markers) {
    const key = `${marker.box.x},${marker.box.y},${marker.box.width},${marker.box.height}`;
    byBox.set(key, [...(byBox.get(key) ?? []), marker.name]);
  }
  const shared = Array.from(byBox.values()).filter((names) => names.length > 1);
  if (shared.length > 0) {
    log.info(
      { collisions: shared.length, nouns: shared },
      "[referenceDiscovery] two names came back with one rectangle — #2787, not resolved here",
    );
  }

  /* Largest-first, which is the design's ordering. The cap already bounded how
     many were ASKED, so this sorts rather than discards. */
  markers.sort((a, b) => b.area - a.area);
  return { markers, unmarked };
}

/**
 * THE WHOLE ROAD — read the picture, box what it named.
 *
 * The caller gates on `captureCastingReferenceSelectorEnabled` before reaching
 * this; nothing here reads a flag, so the gate stays in one place.
 */
export async function readAndMarkReference(input: {
  frame: { bytes: Buffer; width: number; height: number };
  engine: TextEngine;
  reader: RegionReader;
  signal?: AbortSignal;
  /** For the log alone — never part of any question asked of a provider. */
  about: { userId: number; candidatePublicId: string };
}): Promise<ReferenceReading> {
  const reading = await readReferencePicture({ frame: input.frame, engine: input.engine });
  if (!reading.ok) {
    log.info(
      { ...input.about, why: reading.why },
      "[referenceDiscovery] the picture was not read — no markers, and the words road is untouched",
    );
    return { ok: false, why: reading.why };
  }

  let marked: { markers: ReferenceMarker[]; unmarked: string[] };
  try {
    marked = await markReferenceThings({
      picture: input.frame.bytes,
      features: reading.features,
      reader: input.reader,
      signal: input.signal,
    });
  } catch (error) {
    /* Belt and braces: `markReferenceThings` handles a failure per name, so
       reaching here means something structural. It still fails open. */
    return { ok: false, why: error instanceof Error ? error.message : String(error) };
  }

  log.info(
    {
      ...input.about,
      named: reading.features.length,
      marked: marked.markers.length,
      unmarked: marked.unmarked.length,
      /* #2842: how many of the markers are one part of a several-part thing.
         On the one line a reader actually opens, so the spread is visible
         without going looking for the per-noun line above. */
      severalParts: marked.markers.filter((marker) => marker.spread.boxes.parts > 1).length,
      personPresent: reading.personPresent,
      crops: reading.crops,
    },
    "[referenceDiscovery] read a reference picture",
  );
  return {
    ok: true,
    markers: marked.markers,
    unmarked: marked.unmarked,
    personPresent: reading.personPresent,
    crops: reading.crops,
  };
}
