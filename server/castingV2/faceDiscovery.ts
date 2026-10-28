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
 * failed. The reading simply did not mention a feature, and the gate (since
 * deleted) read silence as absence.
 *
 * Four repairs, each a road out of that one mistake:
 *
 *   **nothing is cancelled**     superseded by the second finding: the
 *                                phrasebook and the gate are deleted, and a
 *                                discovery may only add (see the note where the
 *                                phrasebook stood)
 *   **silence is not absence**   a `cannotSee` name and a name whose words were
 *                                rejected both keep their question
 *   **both crops or neither**    a part-answer gates nothing
 *   **nothing thin is kept**     superseded with the gate: no reading is
 *                                narrowed any more, so the keep branch's
 *                                narrowed-reading refusal went too
 *
 * **What the narrowing is worth now: nothing, by design.** The discovery
 * cancels no question. Slice 1's product is the NAMES, which slice 2's pointer
 * road uses to cut the features no catalogue question covers. Until then the
 * read runs BESIDE the scan rather than in front of it (`faceScanService`), so
 * it costs the panel no time. It stays dark until slice 2 lands beside it, as
 * declared on `productionFlagPositions.mts`'s own row and on #2566.
 */
import sharp from "sharp";

import { boundForJudge } from "./judgeFrame";
import { normalisedName } from "./pointerCut";
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
 * WHAT SORT OF THING A FEATURE IS — the panel's own grammar, never a menu.
 *
 * Five words, and they are not a feature list: they are the distinctions the
 * panel has to make to organise itself the way a stylist would (law 8). The
 * one that carries his ⚠ is `anatomy`, which INCLUDES anything fixed to or
 * embedded in the body — an implant, body hardware, a prosthetic — because the
 * implants on his cyberpunk cast were labelled "Collar", so any rule keyed on
 * the WORD would have swept body hardware into the outfit.
 */
export type FeatureKind = "anatomy" | "clothing" | "accessory" | "marking" | "makeup";

/** One thing, or many small ones spread over an area. What decides cut vs words. */
export type FeatureCoverage = "single" | "scattered";

/**
 * One thing the reader can see on this character.
 *
 * No box, on purpose — see the module header. `about` is prose for the
 * description road and is never sent to a cutter.
 *
 * # THE THREE GROUPING FACTS, AND WHY THE READING DECLARES THEM (#2566)
 *
 * Until this slice the panel knew WHAT the reading named and nothing about what
 * each named thing IS. The only grouping instrument on the road was
 * `coveredByCatalogue` — a spelling test — so every name that was not literally
 * a catalogue word became a top-level sibling row: "freckles" was cut like an
 * object when it is scattered across skin, "lip ring" became a sibling of Lips,
 * "eye makeup" became a row at all, and six garment nouns became six rows.
 *
 * His binding sentence is why these are ASKED and not looked up: *"nothing
 * should be confined to a set list thats the old way of doing things the new way
 * is the image is analyzed and features are determined that way."* So the facts
 * are judged from the picture, per cast. There is no synonym table, no part-of
 * table and no word list anywhere in this repair.
 *
 * ⚠ **THEY ARE CARRIED HERE AND USED BY NOBODY YET.** Slice 2 is the grouping
 * (`pointerCut` + `faceScanService` + `facePanel`) and slice 3 is the loader; a
 * panel that grouped on half a design would be worse than today's. This slice's
 * product is the three facts arriving correct and attributable.
 */
export type DiscoveredFeature = {
  /** A short bare noun, the words a person would use pointing at it. */
  name: string;
  /** How many of it are visible. At least 1. */
  count: number;
  /** Anything else worth saying about it, in words. May be empty. */
  about: string;
  /** What sort of thing it is. Decides what may enter the Outfit row (slice 2). */
  kind: FeatureKind;
  /**
   * The bare noun of the feature this sits on or is part of, `""` when it stands
   * alone. A lip ring is `on` "lips". Decides folding (slice 2).
   */
  on: string;
  /** One outlineable thing, or many scattered bits. Decides cut vs words (slice 2). */
  coverage: FeatureCoverage;
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
     * deletion. These never reach a cutter; the deleted gate read them as
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
 *
 * # THE GROUPING PARAGRAPH IS A MEASURED ARTIFACT — DO NOT RE-WORD IT (#2566)
 *
 * It is byte-identical to the one the grouping bench ran
 * (`scripts/_2566-grouping-discovery-disposable.mts`, receipts
 * `output/2566/grouping-discovery.{json,txt}`, twelve reads on the three
 * production fixtures, ~$0.11 house), and the bench is why each clause reads
 * as it does:
 *
 *   the hardware clause     The jaw and neck hardware read `anatomy` in every
 *                           arm of both runs; in **0 of 4** calls did body
 *                           hardware read as `clothing`. That is the one call
 *                           his ⚠ turns on, because his cast's implants were
 *                           labelled "Collar".
 *   "one connected piece"   Run 1 said "spread across an area" and the model
 *                           called a connected chest tattoo spread — which
 *                           would have demoted the tattoo row he liked to
 *                           words. Run 2's wording answers `single` on both
 *                           arms. **A paraphrase of this clause invalidates
 *                           the bench**, which is the whole reason it is
 *                           quoted rather than rewritten.
 *   nothing was lost        Bareness survived the bigger ask: **66 of 66**
 *                           names came back bare (69/69 on the small ask), so
 *                           the cutter's contract is untouched.
 *
 * What the addition costs, stated beside what it buys: ~600 extra prompt tokens
 * and 15–40% more output per read; a read moved ~11 s → ~13 s. The two crops
 * run in parallel, so the reading's wall time barely moves.
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
  "For each feature, also say what SORT of thing it is and where it belongs:",
  "- kind: 'anatomy' for a part of the body — INCLUDING anything fixed to or embedded in the",
  "  body, such as an implant, body hardware or a prosthetic, whatever word names it;",
  "  'clothing' for a garment they are wearing; 'accessory' for a small worn item such as",
  "  jewellery, a piercing ring or glasses; 'marking' for something on the skin such as a",
  "  tattoo, scar, mole or freckles; 'makeup' for cosmetics.",
  "- on: if this feature sits on or is part of another feature you named, give that feature's",
  "  bare noun (a lip ring is on 'lips', an ear piercing is on 'ear'). Otherwise ''.",
  "- coverage: 'single' if it is one thing or one connected piece you could draw one tight",
  "  outline around (a tattoo piece or a jacket is single); 'scattered' if it is many separate",
  "  small bits spread over an area, like freckles, scales or stubble.",
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
          required: ["name", "count", "about", "kind", "on", "coverage"],
          properties: {
            name: { type: "string", description: "a short bare noun, one or two plain words" },
            count: { type: "integer", description: "how many of this feature are visible" },
            about: { type: "string", description: "anything worth saying about it, in words" },
            /* The two closed facts are ENUMS so the provider refuses an invented
               word rather than the parse having to: `kind` is the one his ⚠ is
               about, and a sixth value here would be a vocabulary, which is the
               thing the N3 principle forbids. `on` is deliberately open — it is
               a NOUN the reading chose, and a closed list of hosts would be the
               fixed list wearing a different hat. */
            kind: { type: "string", enum: ["anatomy", "clothing", "accessory", "marking", "makeup"] },
            on: { type: "string", description: "bare noun of the feature this sits on, or ''" },
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
 *                    The words are kept so the deleted gate could still read
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

const FEATURE_KINDS: readonly FeatureKind[] = [
  "anatomy", "clothing", "accessory", "marking", "makeup",
];

/**
 * ONE RULE GOVERNS ALL THREE FALLBACKS, AND IT IS THE MODULE'S OWN LAW: **an
 * unreadable grouping fact leaves the feature exactly where today's panel puts
 * it — its own top-level row, cut on its own.**
 *
 * The schema's enums mean a bad value should be rare, so this is the shape of a
 * rare event rather than a routine path; what matters is that the rare event
 * cannot be the one that hurts. Each default is the choice that CANNOT remove a
 * row:
 *
 *   kind -> anatomy      `clothing` would fold it into the Outfit row and
 *                        `makeup` would give it no row at all, so those are the
 *                        two values an unreadable answer must never become.
 *                        Of the remaining three, `anatomy` is the one his ⚠ is
 *                        about and the one the bench measured hardware into
 *                        (4 of 4). An unreadable kind therefore behaves like a
 *                        found feature does today.
 *   coverage -> single   `scattered` means never cut, which removes a row.
 *   on -> ""             Stands alone, which is today's placement. A host is
 *                        also held to {@link isBareNoun}, because `on` becomes
 *                        a LOOKUP KEY against row nouns in slice 2 — a caption
 *                        could never match a row, so accepting one would only
 *                        make a wrong fold look like a considered one.
 *
 * ⚠ It does NOT drop the feature. A parse rule that deletes a feature is the
 * exact mistake the relay's finding on PR #2570 was about, one field over.
 */
export function cleanKind(raw: unknown): FeatureKind {
  if (typeof raw !== "string") return "anatomy";
  const kind = raw.trim().toLowerCase();
  return FEATURE_KINDS.find((known) => known === kind) ?? "anatomy";
}

function cleanCoverage(raw: unknown): FeatureCoverage {
  return typeof raw === "string" && raw.trim().toLowerCase() === "scattered"
    ? "scattered"
    : "single";
}

function cleanHost(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const host = raw.trim().toLowerCase();
  if (host.length === 0 || host.length > 40) return "";
  return isBareNoun(host) ? host : "";
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
      const row = entry as {
        name?: unknown; count?: unknown; about?: unknown;
        kind?: unknown; on?: unknown; coverage?: unknown;
      };
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
        kind: cleanKind(row.kind),
        on: cleanHost(row.on),
        coverage: cleanCoverage(row.coverage),
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
  /* A thing cannot sit on itself. One reading did not do this; it is refused
     here because slice 2 follows `on` chains to a top host, and a self-host is
     a one-link cycle that a chain walker meets before any visited set it
     carries. Cheaper to make it unrepresentable than to handle. */
  return {
    features: features.map((feature) => (
      feature.on === feature.name ? { ...feature, on: "" } : feature
    )),
    cannotSee,
    unusable,
  };
}

/** The two kinds that take a row away; everything else keeps its own. */
const ROW_TAKING_KINDS: readonly FeatureKind[] = ["clothing", "makeup"];

function mergedKind(held: FeatureKind, seen: FeatureKind): FeatureKind {
  if (held === seen) return held;
  const heldTakes = ROW_TAKING_KINDS.includes(held);
  const seenTakes = ROW_TAKING_KINDS.includes(seen);
  if (heldTakes && !seenTakes) return seen;
  if (seenTakes && !heldTakes) return held;
  return held;
}

function mergedHost(held: string, seen: string): string {
  if (held === seen) return held;
  if (held.length === 0) return seen;
  if (seen.length === 0) return held;
  return "";
}

/**
 * Merge the two crops' answers.
 *
 * The same feature is named by both — both crops see the eyes — and the merged
 * row keeps the LARGER count, because a crop that can see only one of a pair is
 * the one that is wrong about how many there are. `about` is kept from whichever
 * crop said more about it, which on the measured runs is the crop that could see
 * it better.
 *
 * # IT MATCHES ON `normalisedName` NOW, NOT ON THE RAW NOUN (#2566)
 *
 * The two crops are two readings, so one says `earring` and the other `earrings`
 * — and on the raw noun those were TWO merged rows, each with half the facts,
 * which the fold in slice 2 would then have treated as two different features.
 * {@link normalisedName} is the comparison spelling the pointer road already
 * uses for exactly this; it is IMPORTED rather than re-implemented, because a
 * second spelling-folder is working law 4's own failure shape and these two
 * would decide the same question differently within a week.
 *
 * ⚠ The import makes this module name `pointerCut`, which imports `DiscoveredFeature`
 * back — a cycle on paper and not at runtime, because that direction is
 * `import type` and is erased. Do not "fix" it by copying the function.
 *
 * The noun the panel and the cutter get is still the reading's own, untouched:
 * the normalised form is a KEY and is never stored.
 *
 * # THE THREE FACTS, AND ONE RULE DECIDES EVERY DISAGREEMENT
 *
 * The crops see different things, so they can disagree — the bench measured one:
 * the alien's neck hardware read `anatomy` on the full frame and `accessory` on
 * the head crop. **On any disagreement the merged value is the one that leaves
 * the feature its own row and its own cut**, which is today's behaviour and the
 * same rule the parse fallbacks follow:
 *
 *   kind       equal, or the value that is NEITHER `clothing` NOR `makeup`,
 *              since those are the only two that take a row away (one folds it
 *              into the Outfit row, the other draws nothing). Two "own row"
 *              kinds disagreeing is cosmetic in slice 2's sectioning, so the
 *              HELD one wins — deterministically the head crop, which is asked
 *              first (`discoveryCropsOf` pushes head then full) and is the crop
 *              measured to read the face better.
 *   coverage   `single` unless BOTH say `scattered`, because `scattered` is the
 *              value that means never cut.
 *   on         a named host beats `""` — a crop that cannot see the host says
 *              `""`, which is an absence and not a claim. Two DIFFERENT hosts
 *              is a real disagreement and resolves to `""`: no fold is honest,
 *              and a guessed fold puts a lip ring under a nose.
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
      const key = normalisedName(feature.name);
      const held = features.get(key);
      if (held === undefined) {
        features.set(key, { ...feature });
        continue;
      }
      features.set(key, {
        /* The HELD noun, not the later one: the head crop is asked first, so a
           singular/plural pair keeps the face reading's spelling. */
        name: held.name,
        count: Math.max(held.count, feature.count),
        about: feature.about.length > held.about.length ? feature.about : held.about,
        kind: mergedKind(held.kind, feature.kind),
        on: mergedHost(held.on, feature.on),
        coverage: held.coverage === "scattered" && feature.coverage === "scattered"
          ? "scattered"
          : "single",
      });
    }
  }
  /* A thing one crop could not see and the other NAMED is seen, so the unseen
     list is only what nothing could see. ⚠ Compared on the same normalised key
     as the features above — on the raw noun, a `cannotSee` row saying `earrings`
     sat beside a named `earring` and the panel was told both at once. */
  const unseen = new Map<string, UnseenFeature>();
  for (const answer of answers) {
    for (const row of answer.cannotSee) {
      const key = normalisedName(row.name);
      if (features.has(key)) continue;
      if (!unseen.has(key)) unseen.set(key, row);
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

/*
 * ⚠ THE PHRASEBOOK AND `gateScanPlan` ARE DELETED — the relay's second HELD
 * finding on PR #2570 (head `60e871e1d`). The repair above narrowed the cancel
 * licence to three optional features (horns, earrings, glasses), and the
 * re-drive still lost a visible Earrings row: on cast 812's selected version,
 * reading 2 of 3 named no earring and the question was cancelled, with the
 * piercings plainly on the ear. A reader that is wrong some of the time cannot
 * hold a licence to delete a row, however narrow the licence. And the
 * cancellation bought no speed: flag on measured 29 s against 20 s on 812.
 *
 * So the rule is now the one the relay set: **the discovery may only ADD.** It
 * never cancels a catalogue question, so every reading asks the whole
 * catalogue exactly as it does with the flag off. Nothing else read the
 * phrasebook, so it went with the licence rather than being left behind as a
 * second list. What a discovery adds (the features no catalogue question
 * covers) is slice 2's pointer road. Until that lands, a discovery's names are
 * logged and change nothing on the panel.
 */

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
          PR #2570. The deadline EXISTS because of what a hung provider holds;
          its NUMBER comes from the measured tail, and those are two facts.

          WHAT IT HOLDS, read at this head rather than carried: one of the FOUR
          slots on the `openrouter-text` queue (`interpreterTextQueue`,
          concurrency 4, depth 32), which a paid roll's interpreter draws from
          too. On the transport's defaults that is 45 s per attempt times three
          retries — over two minutes of one slot on one hung provider — which is
          why the deadline and `retries: 0` are both here.

          ⚠ **IT NO LONGER HOLDS THE PANEL, AND THIS COMMENT SAID IT DID UNTIL
          #2566 SLICE 1'S REPAIR.** It read *"it stands AHEAD of every segmenter
          call in the scan (`faceScanService` awaits it before the first
          question goes out)"*, and that stopped being true at #2570's SECOND
          finding: `faceScanService` starts this beside `scanFace` and awaits it
          only at settle, so no question waits on it and the panel's first paint
          reads the partial either way. The sentence outlived its road, and the
          number bolted to it is what bit.

          THE NUMBER, from `output/2566/grouping-discovery.txt` — six reads on
          the final wording: 8,912 · 10,180 · 10,186 · 13,684 · 14,500 ·
          **18,821 ms**, mean 12,714. **30 s is 1.6× that measured tail.**

          ⚠ **15 s was already marginal BEFORE this slice, and the receipt in
          the tree said so** — the pre-grouping run
          (`output/2566/fullframe-discovery.txt`, the same six crops) ran
          10,107–**13,091 ms**, so the old deadline carried 1.9 s of headroom
          against a measured max, never the 8–9 s this comment used to claim.
          The bigger ask then pushed the tail over the line: at 15 s the
          cyberpunk cast's head crop times out at 18.8 s, that crop returns
          null, and `discoverFeatures` refuses to gate on a part-answer — so the
          customer loses the WHOLE discovery on the densest cast, silently,
          because it fails open. A deadline set from a number no receipt
          supported is the defect; 1 of 6 reads over the line is the measurement.

          ⚠ **A deadline that fires here still costs nothing** in money or
          correctness: the reading comes back `{ ok: false }` and the scan asks
          the full catalogue, which is the panel the customer gets today. What
          it costs is the saving this road exists for, and that is the trade the
          number is chosen on.
        */
        timeoutMs: 30_000,
        retries: 0,
        /*
          A CEILING OF ITS OWN, BECAUSE THE DEFAULT ONE ALREADY BITES THIS ROAD
          (#2566, found by the grouping bench rather than reasoned about).

          This call passed no `maxOutputTokens`, so it took the transport's
          default of 900 (`openrouterText.ts`'s `request.maxOutputTokens ?? 900`).
          The bench's dense-cast full-frame answer was **cut off at 900 mid-JSON
          and parsed to nothing** — and on this road that is not a bad arm in a
          script: `parseDiscovery` returns null, the crop is discarded, and
          `discoverFeatures` refuses to gate on a part-answer, so **a
          feature-dense cast loses its whole discovery**. It fails open, so
          nobody would ever see it as a fault — they would see the full
          catalogue and a missing saving.

          ⚠ **That was true before this slice, not caused by it.** The three
          facts make it likelier by adding 15–40% to each answer, which is why
          the ceiling moves in the same commit rather than in a card of its own.

          2,000 is the measured number, and the measurement is the WHOLE
          receipt rather than one line of it: the heaviest of the six reads in
          `output/2566/grouping-discovery.txt` is the cyberpunk cast's head crop
          at **1,293 output tokens** (⚠ this comment said 1,133 until #2566
          slice 1's repair — the relay's second finding; 1,133 is the elder
          alien's full frame, the second heaviest, so the ceiling always
          covered the real worst case and only the sentence was wrong). It is a
          CEILING and not a spend — an ordinary answer still costs what it
          costs.
        */
        maxOutputTokens: 2_000,
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
      /*
        AND WHICH NAMES, because a count could not answer his fifth finding
        (#2752): his neck tattoo got no row, and one of the four roads that
        loses a thing is the READING never naming it usably — a caption the
        bare-noun rule refused, or a thing it said it could not see. Those two
        lists are kept nowhere else (the kept scan holds only what was named and
        cut, or named and not cut), so without the nouns here that road is
        unreadable after the fact. Nouns only; `about` and `why` stay out.
      */
      unusableNames: merged.unusable,
      cannotSeeNames: merged.cannotSee.map((one) => one.name),
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
