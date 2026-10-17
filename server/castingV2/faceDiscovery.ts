/**
 * THE DISCOVERY READ — asking the picture what is on this character, instead of
 * asking our list whether each of its own entries is there (#2566, slice 1 of
 * the design he approved on #2532).
 *
 * # What it is for, in his words
 *
 * *"n3 is meant to be bringing in the ability to detect all/any features right
 * rather than from a list?"* — and #30's older demand, *"automatically pick
 * features up on its own"*. Today a scan asks a FIXED catalogue of questions,
 * so a cast's own horns, scales, jaw hardware or jacket are invisible to it at
 * any price, and the empty questions about features this face has not got are
 * paid for anyway.
 *
 * This module answers one question — **what is actually on this character** —
 * and nothing else. It cuts nothing, writes nothing, and decides nothing about
 * what the panel draws. Its whole product is **names and counts**.
 *
 * # ITS BOXES ARE DISCARDED, AND THAT IS MEASURED RATHER THAN CAUTIOUS
 *
 * The obvious shape is to take the boxes this read already returns and skip the
 * segmenter. #2532 arm 3 measured them: **1 of 12 contained its feature's
 * centre.** So this type carries no geometry at all — not an unused field, not
 * an optional one. A box this reader produced must not be able to reach a
 * panel row or a cutter, and the cheapest way to guarantee that is to have none.
 *
 * # THE NAME IS A SHORT BARE NOUN, AND THAT IS THE WHOLE CONTRACT
 *
 * Downstream, the name becomes a cutter's prompt. A qualified noun makes the
 * cutter return nothing — measured 3 of 3 on #2532 — so *"mechanical jaw
 * brackets with tube-like extensions along cheeks and chin"* is not a worse
 * name than `jaw hardware`, it is an unusable one.
 *
 * Two things enforce it rather than hoping for it: the prompt says so at
 * length, and {@link isBareNoun} is applied to every name that comes back.
 * Measured on the three production fixtures the day this was written: **69 of
 * 69 names came back bare**, against a bench prompt that produced almost none.
 * Everything the model wants to add about a feature goes in `about`, which the
 * current description (#2565 §2) can use and no cutter ever sees.
 *
 * # IT ASKS TWO CROPS, AND THE SECOND ONE WAS BOUGHT BY A MEASUREMENT
 *
 * The design's §7 left this open and gave the build the job: *"whether one
 * full-frame discovery names the face as well as the head-crop bench did is
 * unmeasured — checked in the first build slice; the fallback is two crops,
 * +$0.009."* Measured here, six reads on his own three fixtures:
 *
 *   the FULL FRAME buys the outfit     29 names -> 40; garment words 10 -> 16.
 *                                      The head crop cannot see the sash, the
 *                                      straps, the robe or the coat at all, and
 *                                      #2565 slice 3's outfit rows stand on them.
 *   and it COSTS face detail           on the human fixture it stopped naming
 *                                      the NOSE — checked at the frame, plainly
 *                                      visible, a real miss — and dropped the
 *                                      eyeliner and the freckles with it.
 *
 * So the fallback is the answer: the head crop reads the face, the full frame
 * reads what they are wearing, and **neither does the other's job**. Both
 * answers are merged by {@link mergeDiscoveries}, which keeps the larger count
 * when the two crops see the same thing.
 *
 * # ABSENCE IS AN ANSWER, AND IT IS ASKED FOR
 *
 * §5c's third gate: the reading must DECLARE what it cannot see rather than
 * silently missing it. `cannotSee` carries those, with the reason, and the
 * hooded fixture used it for five things rather than guessing. A named-but-
 * uncut feature gets no panel row (his ruling on #2532: *"no features should
 * ride in the image analyzer on the right panel unless it has an image to go
 * with it"*) — that rule lives at the panel, and this module only has to make
 * the fact available.
 *
 * # WHAT IT IS NOT ALLOWED TO DO, AND WHY A FAILURE IS SILENT
 *
 * A discovery that fails must leave the scan exactly as it is today — the full
 * catalogue, asked in full. It is a saving and a widening, never a gate that
 * can take features away when a provider has a bad minute: `{ ok: false }` is
 * a real answer and the caller reads it as *"ask everything"*. That is the one
 * property this module has to get right, and `faceDiscovery.test.ts` drives it
 * directly rather than through a scan.
 *
 * # ⚠ A SUCCESSFUL READING COULD TAKE FEATURES AWAY TOO, AND THAT WAS THE BUG
 *
 * The paragraph above guarded the failure road and left the success road open.
 * The relay drove the flag on, on dev, against today's rows, and read every
 * frame (the finding on PR #2570, law 9): **cast 812 lost its Teeth in 3 of 3
 * readings with the teeth plainly visible, cast 772 lost both Ears, and the
 * same frame gave a different panel on different readings.** Nothing had
 * failed. The reading simply did not mention a feature, and
 * {@link gateScanPlan} read silence as absence.
 *
 * Four repairs, each a road out of that one mistake:
 *
 *   **only optional features**   {@link DISCOVERY_PHRASEBOOK} now holds horns,
 *                                earrings and glasses alone. Anatomy every
 *                                character has — and the two features the panel
 *                                is allowed to state an ABSENCE for — cannot be
 *                                cancelled at all
 *   **silence is not absence**   a `cannotSee` name and a name whose words were
 *                                rejected both keep their question
 *   **both crops or neither**    a part-answer gates nothing
 *   **nothing thin is kept**     a narrowed reading is served and not persisted
 *                                (`faceScanService`'s keep branch), so one bad
 *                                minute cannot become a permanent panel
 *
 * **What the narrowing is worth after that: at most three questions of twelve.**
 * That is the honest number and this module is not built on it — slice 1's
 * product is the NAMES, which the pointer road cuts the features no catalogue
 * question covers. The relay measured the flag 6–8 s SLOWER per reading for
 * $0.00–0.01 saved, so **it stays dark until slice 2 lands beside it**; that is
 * declared on `productionFlagPositions.mts`'s own row and on #2566.
 */
import sharp from "sharp";

import { boundForJudge } from "./judgeFrame";
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/faceDiscovery");

/**
 * THE TWO PICTURES, and their numbers are the measured ones rather than tidy
 * ones.
 *
 * `HEAD_FRACTION` is the top half, and `ASK_WIDTH` is 768px — arm 2's own
 * geometry, kept so the measurement that chose this shape stays comparable to
 * the one that benched it. The full frame is asked at the SAME width, so the
 * only thing that differs between the two reads is what is in the picture and
 * not how many pixels the model was handed.
 */
const HEAD_FRACTION = 0.5;
const ASK_WIDTH = 768;

/**
 * One thing the reader can see on this character.
 *
 * No box, on purpose — see the module header. `about` is prose for the
 * description road and is never sent to a cutter.
 */
export type DiscoveredFeature = {
  /** A short bare noun, the words a person would use pointing at it. */
  name: string;
  /** How many of it are visible. At least 1. */
  count: number;
  /** Anything else worth saying about it, in words. May be empty. */
  about: string;
};

/** Something the reader could name but could not see well enough to name it. */
export type UnseenFeature = { name: string; why: string };

export type FaceDiscovery =
  | {
    ok: true;
    features: readonly DiscoveredFeature[];
    cannotSee: readonly UnseenFeature[];
    /**
     * THE NAMES `cleanName` REJECTED, kept as the reader wrote them.
     *
     * Not a diagnostic field. A caption such as *"long black hair"* is an
     * unusable NAME and a perfectly good FACT, and until the relay's finding on
     * PR #2570 the rejection cancelled the question — so a parse rule became a
     * deletion. These never reach a cutter; {@link gateScanPlan} reads them as
     * a reason to ask, and nothing else in the product reads them at all.
     */
    unusable: readonly string[];
    /** Which crops answered, so a half-answer is legible rather than mysterious. */
    crops: readonly ("head" | "full")[];
  }
  | {
    ok: false;
    /** Why, for the log. The caller's behaviour is the same whatever it says:
     *  ask the whole catalogue, exactly as before this module existed. */
    why: string;
  };

/** The two pictures a first reading asks about. */
export type DiscoveryCrop = { kind: "head" | "full"; bytes: Buffer; contentType: string };

/**
 * Cut the two pictures a discovery asks about.
 *
 * ⚠ **BOTH OR NEITHER, and that changed with the relay's finding on PR #2570.**
 * It used to ask a frame too small to head-crop WHOLE, once, on the reasoning
 * that a 1-pixel head crop is a wasted call. The reasoning held and the
 * conclusion did not: the full frame alone is the crop measured missing the
 * nose, and {@link discoverFeatures} now refuses to gate anything on a
 * part-answer — so that single call would have been bought and then discarded.
 * A frame too small for both is not asked about at all, which is one call saved
 * and the hole closed in the same line.
 *
 * It never throws: a frame `sharp` cannot read returns no crops, and
 * {@link discoverFeatures} turns that into the fail-open answer.
 */
export async function discoveryCropsOf(frame: {
  bytes: Buffer;
  width: number;
  height: number;
}): Promise<DiscoveryCrop[]> {
  /*
    THROUGH THE SHARED BOUND, not past it (#1413).

    `ASK_WIDTH` already puts both crops far under `JUDGE_FRAME_LONG_EDGE`, so
    on today's numbers `boundForJudge` reduces nothing — it keeps whichever of
    the two encodings is smaller and hands the bytes straight back. It is here
    anyway, because the alternative is a second module that decides how big a
    posted frame may be, and a later edit to `ASK_WIDTH` would then walk past
    the bound with nothing going red.
  */
  const bound = async (bytes: Buffer, kind: "head" | "full"): Promise<DiscoveryCrop> => {
    const judged = await boundForJudge({ bytes, contentType: "image/png" });
    return { kind, bytes: judged.image.bytes, contentType: judged.image.contentType };
  };

  const crops: DiscoveryCrop[] = [];
  try {
    const headHeight = Math.round(frame.height * HEAD_FRACTION);
    if (frame.width < 64 || headHeight < 64) {
      log.warn(
        { width: frame.width, height: frame.height },
        "the frame is too small to cut a head crop — no discovery is asked",
      );
      return [];
    }
    crops.push(await bound(
      await sharp(frame.bytes)
        .extract({ left: 0, top: 0, width: frame.width, height: headHeight })
        .resize({ width: ASK_WIDTH })
        .png()
        .toBuffer(),
      "head",
    ));
    crops.push(await bound(
      await sharp(frame.bytes).resize({ width: ASK_WIDTH }).png().toBuffer(),
      "full",
    ));
  } catch (error) {
    log.warn(
      { why: error instanceof Error ? error.message : String(error) },
      "the discovery crops could not be cut",
    );
    return [];
  }
  return crops;
}

/**
 * THE PROMPT, and every paragraph in it is load-bearing.
 *
 * The bare-noun paragraph is the longest because it is the one that failed in
 * the bench: asked plainly for "a name", the model writes a caption. It is
 * given the three worked examples from the measured failures rather than a rule
 * in the abstract.
 */
export const DISCOVERY_SYSTEM_PROMPT = [
  "You are looking at one frame of a character and naming what is physically on them.",
  "",
  "Name EVERY distinct feature you can actually see, whatever it is — anatomy, hair,",
  "ornaments, and every separate piece of what they are wearing. Do not work from a fixed",
  "list: if this character has horns, a third eye, scales, gills, jaw hardware, a prosthetic,",
  "a jacket, a collar or anything else, name it.",
  "",
  "THE NAME MUST BE A SHORT BARE NOUN — one or two plain words, the words a person would",
  "use pointing at it. No description, no colour, no material, no position, no brackets, no",
  "commas, no 'with' or 'on' clauses. Write 'hair', not 'dark hair in a high bun'. Write",
  "'earring', not 'dangling dark earrings'. Write 'jaw hardware', not 'mechanical jaw",
  "brackets with tube-like extensions'. Everything you want to add about it goes in `about`.",
  "",
  "Give a count. If a feature comes as a matched pair or set, say how many you can see.",
  "",
  "Two rules matter more than completeness:",
  "1. Name ONLY what you can actually see in this frame. Never infer a feature from what the",
  "   character seems to be, and never name something because a character like this usually",
  "   has one.",
  "2. If something is hidden, cut off by the frame, or too small or blurred to be sure of, put",
  "   it in `cannotSee` with the reason instead of naming it. Saying you cannot see something",
  "   is a correct answer, not a failure.",
].join("\n");

/**
 * The shape, enforced by the provider rather than hoped for.
 *
 * `json: true` is a hint and this is not — measured on #2196, the same ask under
 * a hint came back fenced, with an invented top-level key and strings where
 * objects were asked for.
 */
export const DISCOVERY_SCHEMA = {
  name: "discovery",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["features", "cannotSee"],
    properties: {
      features: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "count", "about"],
          properties: {
            name: { type: "string", description: "a short bare noun, one or two plain words" },
            count: { type: "integer", description: "how many of this feature are visible" },
            about: { type: "string", description: "anything worth saying about it, in words" },
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

/**
 * Whether a name is usable as a cutter's prompt.
 *
 * The three rejections are the three measured shapes: a parenthetical or a
 * comma-separated list, a positional clause, and a caption. Exported because a
 * contract nobody can check is a hope, and the suite holds the real prompt's
 * output to it.
 */
export function isBareNoun(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  if (/[(),/]/.test(trimmed)) return false;
  if (/\b(with|in|on|under|over|near|around|styled|wearing)\b/i.test(trimmed)) return false;
  return trimmed.split(/\s+/).length <= 2;
}

/**
 * A name a cutter could be handed: trimmed, lowercased, and bare.
 *
 * Three answers rather than two, because the difference between them is a
 * customer's panel row (the relay's finding on PR #2570):
 *
 *   `{ ok: true }`   usable — it becomes a feature and may become a cut
 *   `{ ok: false }`  the reader named SOMETHING in words no cutter can use.
 *                    The words are kept so {@link gateScanPlan} can still read
 *                    them as a reason to ask
 *   `null`           there is no name here at all — not a string, empty, or so
 *                    long it is prose rather than an answer
 */
function cleanName(raw: unknown): { ok: boolean; name: string } | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  if (name.length === 0 || name.length > 40) return null;
  return { ok: isBareNoun(name), name };
}

function cleanCount(raw: unknown): number {
  const count = typeof raw === "number" ? Math.round(raw) : Number.NaN;
  if (!Number.isFinite(count) || count < 1) return 1;
  return Math.min(count, 20);
}

/**
 * Parse one answer.
 *
 * Every byte from a provider is hostile until validated — a name that is not a
 * bare noun is DROPPED rather than repaired, because a repaired caption is a
 * guess wearing a noun's clothes and it would reach a cutter.
 */
export function parseDiscovery(
  text: string,
): { features: DiscoveredFeature[]; cannotSee: UnseenFeature[]; unusable: string[] } | null {
  let parsed: unknown;
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const brace = stripped.indexOf("{");
    const close = stripped.lastIndexOf("}");
    if (brace < 0 || close <= brace) return null;
    try { parsed = JSON.parse(stripped.slice(brace, close + 1)); } catch { return null; }
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const body = parsed as { features?: unknown; cannotSee?: unknown };

  const features: DiscoveredFeature[] = [];
  const unusable: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(body.features)) {
    for (const entry of body.features) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as { name?: unknown; count?: unknown; about?: unknown };
      const cleaned = cleanName(row.name);
      if (cleaned === null || seen.has(cleaned.name)) continue;
      seen.add(cleaned.name);
      if (!cleaned.ok) {
        /* THE WORDS ARE UNUSABLE AND THE FACT IS NOT — the relay's finding on
           PR #2570. It never becomes a feature and never reaches a cutter; it
           is kept only so that rejecting a caption cannot cancel a question
           the panel would otherwise have asked. */
        unusable.push(cleaned.name);
        continue;
      }
      features.push({
        name: cleaned.name,
        count: cleanCount(row.count),
        about: typeof row.about === "string" ? row.about.trim().slice(0, 400) : "",
      });
    }
  }

  const cannotSee: UnseenFeature[] = [];
  if (Array.isArray(body.cannotSee)) {
    for (const entry of body.cannotSee) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as { name?: unknown; why?: unknown };
      if (typeof row.name !== "string" || row.name.trim().length === 0) continue;
      cannotSee.push({
        name: row.name.trim().toLowerCase().slice(0, 60),
        why: typeof row.why === "string" ? row.why.trim().slice(0, 200) : "",
      });
    }
  }

  /* An answer that parsed but named nothing USABLE at all is not a discovery —
     it is a reader that said nothing, and treating it as "this face has no
     features" would gate the whole scan to silence. A reply whose every name
     was a caption lands here too, which is the fail-open direction. */
  if (features.length === 0) return null;
  return { features, cannotSee, unusable };
}

/**
 * Merge the two crops' answers.
 *
 * The same feature is named by both — both crops see the eyes — and the merged
 * row keeps the LARGER count, because a crop that can see only one of a pair is
 * the one that is wrong about how many there are. `about` is kept from whichever
 * crop said more about it, which on the measured runs is the crop that could see
 * it better.
 */
export function mergeDiscoveries(
  answers: ReadonlyArray<{
    features: readonly DiscoveredFeature[];
    cannotSee: readonly UnseenFeature[];
    unusable?: readonly string[];
  }>,
): { features: DiscoveredFeature[]; cannotSee: UnseenFeature[]; unusable: string[] } {
  const features = new Map<string, DiscoveredFeature>();
  for (const answer of answers) {
    for (const feature of answer.features) {
      const held = features.get(feature.name);
      if (held === undefined) {
        features.set(feature.name, { ...feature });
        continue;
      }
      features.set(feature.name, {
        name: feature.name,
        count: Math.max(held.count, feature.count),
        about: feature.about.length > held.about.length ? feature.about : held.about,
      });
    }
  }
  /* A thing one crop could not see and the other NAMED is seen, so the unseen
     list is only what nothing could see. */
  const unseen = new Map<string, UnseenFeature>();
  for (const answer of answers) {
    for (const row of answer.cannotSee) {
      if (features.has(row.name)) continue;
      if (!unseen.has(row.name)) unseen.set(row.name, row);
    }
  }
  /* The rejected names are the UNION and are not de-duplicated against
     `features`: they only ever make the gate ask, so a name that is also a
     clean feature costs nothing, and dropping one could only ever make the
     gate cancel more. */
  const unusable = new Set<string>();
  for (const answer of answers) for (const name of answer.unusable ?? []) unusable.add(name);
  return {
    features: Array.from(features.values()),
    cannotSee: Array.from(unseen.values()),
    unusable: Array.from(unusable),
  };
}

/**
 * THE PHRASEBOOK — and **membership in it is the whole licence to cancel a
 * question.** A catalogue feature absent from this map is ALWAYS ASKED.
 *
 * The design's own sentence: *"the fixed list stops being the gate on what
 * exists and survives only as a phrasebook — proven plural nouns for the text
 * road."* This is that phrasebook read the other way round: for each question
 * a discovery may cancel, the plain nouns a person (or the reader) would use
 * for the same thing.
 *
 * ⚠ **IT HELD ALL TWELVE CATALOGUE QUESTIONS UNTIL THE RELAY DROVE IT, AND
 * THAT WAS THE DEFECT — a successful discovery took rows off the panel that
 * have pictures today** (the finding on PR #2570, read on dev as verify-bot
 * 823 with every frame opened by eye — law 9):
 *
 *   cast 812 lost TEETH in 3 of 3 readings, with its teeth plainly visible
 *            between parted lips, and Skin in 1 of 3
 *   cast 772 lost BOTH EARS, visible behind the strands — the reading listed
 *            "ears" under `cannotSee` and today's segmenter finds them
 *   and      the same frame gave a different panel on different readings
 *
 * So the rule now: **a question is cancellable only when the feature is
 * OPTIONAL — a thing a character either has or has not got.** Horns, earrings
 * and glasses are optional. Eyes, brows, a nose, lips, teeth, ears, hair and
 * skin are not: every character this product casts has them, so a reading that
 * did not mention one has MISSED it, never found it absent. They are absent
 * from this map and are therefore asked on every scan, exactly as they are
 * today.
 *
 * ⚠ **`facial-hair` IS NOT CANCELLABLE EITHER, AND IT IS THE ONE ENTRY WHOSE
 * REASON IS NOT ANATOMY.** It is optional, and the saving the first shape of
 * this map was built to buy was precisely the beard question on a clean-shaven
 * face. But `hair` and `facial-hair` are the only two slots the catalogue lets
 * state an absence (`whenAbsent` — "bald" and "clean-shaven", authored beside
 * their controls on `referenceSlotCatalogue.ts`), and an absence is built from
 * a question that was ASKED and came back empty. Cancelling the question
 * therefore deletes the "clean-shaven" row a customer sees today — **the
 * saving's whole product is the row it would delete.** `faceDiscovery.test.ts`
 * derives the `whenAbsent` features from the catalogue and refuses either of
 * them a place in this map, so a later widening cannot take that row away by
 * accident.
 *
 * ⚠ **IT IS NOT A LOOSE SUBSTRING MATCH, AND THAT IS STILL LOAD-BEARING** —
 * one entry over from where it started. `"earring".includes` is not the test,
 * because `ears` must not keep the earring question alive: a loose match would
 * have every character on the platform paying for an earring read. Matching is
 * on whole words ({@link namesThe}).
 *
 * **What the narrowing is worth now, stated rather than implied: three
 * questions of twelve, at most.** That is the honest size of it, and this
 * module's value was never the saving — it is the NAMES, which are what the
 * pointer road (slice 2) cuts features from that no catalogue question covers.
 */
export const DISCOVERY_PHRASEBOOK: Readonly<Record<string, readonly string[]>> = {
  horns: ["horn", "horns", "antlers"],
  earring: ["earring", "earrings", "ear stud", "ear studs"],
  glasses: ["glasses", "spectacles", "eyewear", "goggles", "monocle", "visor"],
};

/** Whole words, lowercased — so `third eye` matches `eye` and `hair` does not
 *  match `facial hair`. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 0);
}

/** Does this discovered name mean this phrasebook noun? */
function namesThe(name: string, noun: string): boolean {
  const nameWords = wordsOf(name);
  const nounWords = wordsOf(noun);
  if (nounWords.length === 0) return false;
  for (let at = 0; at + nounWords.length <= nameWords.length; at += 1) {
    if (nounWords.every((word, offset) => nameWords[at + offset] === word)) return true;
  }
  return false;
}

/**
 * Narrow a scan plan to the features this character actually has.
 *
 * This is the step that makes a first reading cheaper AND wider at once: the
 * questions about features nobody has stop being asked, and what the budget
 * they free buys is the pointer road's cuts for the things no question covers
 * (slice 2). On the measured hooded fixture, five catalogue questions have no
 * answer to find.
 *
 * ⚠ **IT FAILS OPEN, EVERYWHERE, AND THAT IS THE PROPERTY TO PROTECT.** A
 * reading that did not happen, came back in part, could not be parsed, or
 * covers a question this phrasebook does not know leaves the plan exactly as
 * it is today. The cost of failing the other way is a feature vanishing from a
 * customer's panel because a provider had a bad minute, which is not a cost
 * this is allowed to pay to save half a cent.
 *
 * ⚠ **THREE KINDS OF NAME KEEP A QUESTION ALIVE, NOT ONE, AND THE SECOND TWO
 * WERE THE RELAY'S FINDING ON PR #2570.** A question survives when the reading
 * named the feature, **and equally when the reading said it could not see it,
 * and when it named it in words a cutter could not use**:
 *
 *   `features`   it is there — ask, and cut it
 *   `cannotSee`  the reader declared it hidden, cut off or too small to be sure
 *                of. That is a reason to ASK, never a finding of absence —
 *                cast 772 lost both ears to exactly this, with the ears visible
 *                behind the strands and today's segmenter finding them
 *   `unusable`   the reader named it and `cleanName` rejected the words
 *                (*"long black hair"*, *"dangling gold earrings"*). The NAME is
 *                unusable and is never handed to a cutter; the FACT that
 *                something is there is perfectly good, and letting a rejected
 *                caption cancel a question turns a parse rule into a deletion
 *
 * ⚠ **The honest risk that remains, stated rather than discovered later: a
 * feature the discovery OVERLOOKS is dropped too.** It is now bounded to the
 * three optional features this phrasebook holds, and three things stand between
 * it and a customer: both crops must have answered ({@link discoverFeatures}
 * fails open on a part-answer), the reading must have said nothing about the
 * feature in any of the three senses above, and nothing it could cancel is a
 * row the panel can state an absence for.
 */
export function gateScanPlan<T extends { feature: string }>(
  plan: readonly T[],
  discovery: FaceDiscovery | null | undefined,
): { plan: T[]; dropped: string[] } {
  if (!discovery || !discovery.ok) return { plan: [...plan], dropped: [] };

  /* Every name this reading produced that is a reason to ask — see the three
     kinds above. Built once rather than per region. */
  const reasonsToAsk = [
    ...discovery.features.map((feature) => feature.name),
    ...discovery.cannotSee.map((row) => row.name),
    ...discovery.unusable,
  ];

  const kept: T[] = [];
  const dropped: string[] = [];
  for (const region of plan) {
    const nouns = DISCOVERY_PHRASEBOOK[region.feature];
    if (nouns === undefined) {
      /* Not cancellable: always-present anatomy, the two features the panel can
         state an absence for, and any question this phrasebook has never heard
         of. All three take the same road, which is to be asked. */
      kept.push(region);
      continue;
    }
    const named = reasonsToAsk.some((name) => nouns.some((noun) => namesThe(name, noun)));
    if (named) kept.push(region);
    else dropped.push(region.feature);
  }
  return { plan: kept, dropped };
}

/**
 * Read one character's crops and say what is on them.
 *
 * Both crops are asked in PARALLEL — they are independent questions about one
 * picture, and serially this is 23 seconds in front of somebody watching a
 * panel fill instead of 12.
 *
 * It never throws. A provider failure, a timeout, an unparseable answer and a
 * missing transport are all `{ ok: false }`, and the caller's behaviour is
 * identical in every one of those cases: ask the whole catalogue.
 *
 * ⚠ **A PART-ANSWER IS A FAILURE, NOT A READING — the relay's second finding on
 * PR #2570.** This used to succeed whenever ANY crop answered, so a head crop
 * that timed out left the gate running on the full frame alone — and the full
 * frame is the crop this module's own measurement caught missing the NOSE on
 * the human fixture. The two crops do not do each other's job (the head crop
 * reads the face, the full frame reads what they are wearing), so one of them
 * is not a cheaper version of both: it is a different question with the other
 * one's authority. Both answered or the catalogue is asked whole.
 */
export async function discoverFeatures(input: {
  crops: readonly DiscoveryCrop[];
  engine: TextEngine;
}): Promise<FaceDiscovery> {
  if (input.crops.length === 0) return { ok: false, why: "no crops to read" };

  const answers = await Promise.all(input.crops.map(async (crop) => {
    try {
      const result = await input.engine.complete({
        system: DISCOVERY_SYSTEM_PROMPT,
        user: "Name every feature you can see on this character.",
        images: [{ bytes: crop.bytes, contentType: crop.contentType }],
        jsonSchema: DISCOVERY_SCHEMA,
        about: "discover",
        /*
          A DEADLINE OF ITS OWN, AND NO RETRIES — the relay's fourth finding on
          PR #2570, and the reason is where this call SITS rather than how long
          it takes.

          It stands AHEAD of every segmenter call in the scan (`faceScanService`
          awaits it before the first question goes out) and it shares the
          interpreter's text queue, whose concurrency is 4. On the transport's
          defaults that is 45 s per attempt times three retries: a hung provider
          would hold a customer's whole panel for over two minutes, and hold a
          paid roll's interpreter behind it on the way.

          15 s is above the 8–9 s the relay measured for a real read and far
          below the damage. ⚠ **A deadline that fires here costs nothing**: the
          reading comes back `{ ok: false }` and the scan asks the full
          catalogue, which is the panel the customer gets today — so trading a
          rare timeout for a bounded wait is the cheap side of this call.
        */
        timeoutMs: 15_000,
        retries: 0,
      });
      /*
        A REPLY CUT OFF AT THE CEILING IS DISCARDED, NOT READ (#1272's class,
        and this road is the worst place in the product for it).

        Truncated JSON that still parses is the dangerous case: `{"features":
        [{"name":"hair"...}]` cut after its third entry is VALID, and it reads
        as "this character has three features" — which this reader then uses to
        CANCEL every other question. A truncated discovery would therefore take
        real features off a customer's panel and leave nothing behind saying
        why. Everywhere else in the product a lost field is a silence; here it
        is a deletion.
      */
      if (result.truncated === true) {
        log.warn({ crop: crop.kind }, "the discovery read was cut off at the ceiling — discarded");
        return null;
      }
      const parsed = parseDiscovery(result.text);
      if (parsed === null) {
        log.warn({ crop: crop.kind }, "the discovery read could not be parsed");
        return null;
      }
      return { crop: crop.kind, ...parsed, tokens: result.tokens ?? null };
    } catch (error) {
      log.warn(
        { crop: crop.kind, why: error instanceof Error ? error.message : String(error) },
        "the discovery read failed",
      );
      return null;
    }
  }));

  const got = answers.filter((answer) => answer !== null);
  if (got.length === 0) return { ok: false, why: "no crop produced a usable reading" };
  if (got.length < input.crops.length) {
    /* See the header: one crop is not a cheaper version of both. */
    log.warn(
      { answered: got.map((answer) => answer.crop), asked: input.crops.length },
      "only part of the discovery read came back — the catalogue is asked whole",
    );
    return { ok: false, why: "only part of the reading came back" };
  }

  const merged = mergeDiscoveries(got);
  log.info(
    {
      crops: got.map((answer) => answer.crop),
      named: merged.features.length,
      unseen: merged.cannotSee.length,
      /* Counted, because a climbing number means the prompt's bare-noun
         paragraph has stopped working and the saving is quietly going with
         it — measured 0 of 69 on the fixtures the day this was written. */
      unusable: merged.unusable.length,
      tokensIn: got.reduce((sum, answer) => sum + (answer.tokens?.in ?? 0), 0),
      tokensOut: got.reduce((sum, answer) => sum + (answer.tokens?.out ?? 0), 0),
    },
    "discovery read",
  );
  return {
    ok: true,
    features: merged.features,
    cannotSee: merged.cannotSee,
    unusable: merged.unusable,
    crops: got.map((answer) => answer.crop),
  };
}
