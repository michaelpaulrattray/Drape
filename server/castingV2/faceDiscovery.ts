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
 * A frame too small to crop sensibly is asked whole, once — a 1-pixel head
 * crop is not a cheaper reading, it is a wasted call and an invented answer.
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
    if (frame.width >= 64 && headHeight >= 64) {
      crops.push(await bound(
        await sharp(frame.bytes)
          .extract({ left: 0, top: 0, width: frame.width, height: headHeight })
          .resize({ width: ASK_WIDTH })
          .png()
          .toBuffer(),
        "head",
      ));
    }
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

/** A name a cutter could be handed: trimmed, lowercased, and bare. */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  if (name.length === 0 || name.length > 40) return null;
  return isBareNoun(name) ? name : null;
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
export function parseDiscovery(text: string): { features: DiscoveredFeature[]; cannotSee: UnseenFeature[] } | null {
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
  const seen = new Set<string>();
  if (Array.isArray(body.features)) {
    for (const entry of body.features) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as { name?: unknown; count?: unknown; about?: unknown };
      const name = cleanName(row.name);
      if (name === null || seen.has(name)) continue;
      seen.add(name);
      features.push({
        name,
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

  /* An answer that parsed but named nothing at all is not a discovery — it is
     a reader that said nothing, and treating it as "this face has no features"
     would gate the whole scan to silence. */
  if (features.length === 0) return null;
  return { features, cannotSee };
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
  answers: ReadonlyArray<{ features: readonly DiscoveredFeature[]; cannotSee: readonly UnseenFeature[] }>,
): { features: DiscoveredFeature[]; cannotSee: UnseenFeature[] } {
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
  return { features: Array.from(features.values()), cannotSee: Array.from(unseen.values()) };
}

/**
 * THE PHRASEBOOK — what the catalogue's fixed list becomes once it stops being
 * the gate on what exists.
 *
 * The design's own sentence: *"the fixed list stops being the gate on what
 * exists and survives only as a phrasebook — proven plural nouns for the text
 * road."* This is that phrasebook read the other way round: for each question
 * the catalogue asks, the plain nouns a person (or the discovery read) would
 * use for the same thing.
 *
 * ⚠ **IT IS NOT A LOOSE SUBSTRING MATCH, AND THE DIFFERENCE IS THE WHOLE
 * SAVING.** `"hair".includes` would match `facial hair`, so every clean-shaven
 * face would keep paying for a beard question — which is precisely the read
 * this step exists to stop buying. So `hair` is deliberately ABSENT from
 * `facial-hair`'s nouns, and matching is on whole words.
 *
 * A catalogue feature with no entry here is ALWAYS ASKED. That is the fail-open
 * direction and it is the one that costs money rather than features;
 * `faceDiscovery.test.ts` holds this map to the real `scanPlan()` so a new
 * catalogue question cannot quietly arrive without one.
 */
export const DISCOVERY_PHRASEBOOK: Readonly<Record<string, readonly string[]>> = {
  hair: ["hair", "hairstyle", "bun", "braid", "braids", "ponytail", "locks", "dreadlocks", "fringe"],
  "facial-hair": ["beard", "moustache", "mustache", "stubble", "goatee", "sideburns", "facial hair", "whiskers"],
  eye: ["eye", "eyes"],
  brow: ["brow", "brows", "eyebrow", "eyebrows"],
  nose: ["nose", "snout", "muzzle"],
  lips: ["lip", "lips", "mouth"],
  teeth: ["teeth", "tooth", "fangs", "tusks"],
  ear: ["ear", "ears"],
  skin: ["skin", "complexion", "hide", "scales"],
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
 * reading that did not happen, could not be parsed, or covers a question this
 * phrasebook does not know leaves the plan exactly as it is today. The cost of
 * failing the other way is a feature vanishing from a customer's panel because
 * a provider had a bad minute, which is not a cost this is allowed to pay to
 * save half a cent.
 *
 * ⚠ **The honest risk, stated rather than discovered later: a feature the
 * discovery OVERLOOKS is dropped too.** That is what the second crop is for and
 * is why the design buys two — measured on the human fixture, the full frame
 * did not name the nose and the head crop did, so the merged reading keeps it.
 * A single-crop discovery would have dropped a real question there.
 */
export function gateScanPlan<T extends { feature: string }>(
  plan: readonly T[],
  discovery: FaceDiscovery | null | undefined,
): { plan: T[]; dropped: string[] } {
  if (!discovery || !discovery.ok) return { plan: [...plan], dropped: [] };

  const kept: T[] = [];
  const dropped: string[] = [];
  for (const region of plan) {
    const nouns = DISCOVERY_PHRASEBOOK[region.feature];
    if (nouns === undefined) {
      /* A question this phrasebook has never heard of is always asked. */
      kept.push(region);
      continue;
    }
    const named = discovery.features.some((feature) =>
      nouns.some((noun) => namesThe(feature.name, noun)));
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

  const merged = mergeDiscoveries(got);
  log.info(
    {
      crops: got.map((answer) => answer.crop),
      named: merged.features.length,
      unseen: merged.cannotSee.length,
      tokensIn: got.reduce((sum, answer) => sum + (answer.tokens?.in ?? 0), 0),
      tokensOut: got.reduce((sum, answer) => sum + (answer.tokens?.out ?? 0), 0),
    },
    "discovery read",
  );
  return {
    ok: true,
    features: merged.features,
    cannotSee: merged.cannotSee,
    crops: got.map((answer) => answer.crop),
  };
}
