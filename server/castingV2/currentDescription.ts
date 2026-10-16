/**
 * ONE CURRENT DESCRIPTION OF THE CAST — #2565 slice 1, with #2545 folded in.
 *
 * His word closing the #801 court, 2026-10-16: *"okay cool im happy with the
 * build"*, after round 2's verdict *"looks like A4 · master + one current
 * description was the best"* and *"A1+A4 · master + previous + description.
 * degraded massive by edit 6"*. And the rule for the words themselves, on
 * #2545: *"it must read naturally into the description not as an edit list"*.
 *
 * So every paid refine renders from the cast's untouched original (that was
 * already true — `claimVariant` takes the base from the CANDIDATE row), and
 * what carries the edits already made is ONE paragraph saying who they are now.
 * This module owns both halves of that paragraph's life:
 *
 *   - `writeCurrentDescription` asks the house text model to rewrite it from
 *     the previous description plus the one edit being made. It NEVER throws: a
 *     failure is a value (`{ ok: false }`) the caller answers by riding today's
 *     prompt, because a paid render must not fail, or charge differently, over
 *     a decoration. Money is untouched by construction — this runs after the
 *     claim and before the render, and nothing it returns reaches the ledger.
 *   - `describedNowSentence` is the one sentence the refine prompt carries in
 *     place of today's "Change only …" clause — A4's own wording.
 *
 * ⚠ THE PREVIOUS DESCRIPTION IS THE ONLY MEMORY, so where it is missing the
 * writer is given what it would have been built from: the roll's brief (the
 * customer's own words, which on the author road reached the engine verbatim —
 * never the per-slice `resolved` record, which is unsent dice fiction, #176)
 * and the asks already applied to this version, in order. That is how a
 * version made before the flag, or one whose writer failed, is folded in on the
 * next edit rather than lost.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import type { CastPronouns } from "./castPronouns";

const log = createModuleLogger("castingV2/currentDescription");

/** A description longer than this is not a description, it is a runaway. */
export const CURRENT_DESCRIPTION_MAX_LENGTH = 2400;

/**
 * THE WRITER'S OWN DEADLINE AND RETRY BUDGET — a paid render waits on both, so
 * both are sized from what the work actually takes (the relay's finding on
 * PR #2571, which read the docblock's *"short"* against the code).
 *
 * MEASURED on the slice-1 court, 31 calls: median **1.6 s**, range
 * **1.46–3.16 s**, against renders of 70–166 s. So the engine's 45 s default
 * was fourteen times the worst reading — and `timeoutMs` is per ATTEMPT inside
 * the retry loop, so passing no `retries` (the transport's default of 2) held
 * the customer for up to **135 s** before the render even started, over a
 * decoration whose failure is free.
 *
 * 20 s is six times the measured worst case, which is headroom for a slow day
 * rather than for a hung provider; one retry absorbs a single transport blip,
 * which is worth having because a lost description is not merely a slower
 * render — the next edit re-seeds and this version stores nothing. Worst case
 * is therefore 2 × 20 s, down from 3 × 45 s.
 *
 * ⚠ THE QUEUE WAIT SITS OUTSIDE BOTH NUMBERS and is not bounded by them: this
 * call shares `openrouter-text` (concurrency 4) with 120 s interpreter calls,
 * so a busy queue can still hold it. What these two bound is this call's own
 * share of the wait, and that is all they claim.
 */
export const CURRENT_DESCRIPTION_TIMEOUT_MS = 20_000;
export const CURRENT_DESCRIPTION_RETRIES = 1;

export const CURRENT_DESCRIPTION_SYSTEM = [
  "You keep one description of a character for a casting studio: who they are and how they look right now.",
  "You are given what they looked like before one change, and the change itself. Write the description as it is after the change.",
  "",
  "Rules:",
  "- One natural paragraph of plain prose in the present tense, written in the third person with they/their. It must read as a description of a person, never as a list of edits.",
  "- Never use the words now, changed, added, removed, new, no longer, instead or anymore, and never describe the change itself. Describe the result.",
  "- Keep every fact from the previous description that the change does not touch, in its own words where you can.",
  "- When the change takes something away (glasses, a scar, horns), leave it out of the description and add one plain clause stating its absence, such as \"They wear no glasses.\"",
  "- When the change contradicts an earlier fact (a new eye colour, a shorter beard), keep only the new fact.",
  "- The description is read beside their ORIGINAL photograph. A change worded as a comparison (deeper, darker, shorter, heavier, neater) stays a comparison against how they first looked, such as \"scales a deeper emerald than their original colouring\" — never a plain \"deep emerald\", which the original photograph already satisfies.",
  "- Hair on the head and facial hair are separate features: a change to their hair never changes their beard, and a change to their beard never changes their hair.",
  "- Describe only the person: face, features, hair, skin, markings, accessories and clothing. Never the setting, background, lighting, camera, pose or picture style.",
  "- Do not invent anything the previous description and the change do not say.",
  "- Reply with the description paragraph and nothing else.",
].join("\n");

export type CurrentDescriptionInput = {
  /** The previous version's own description, when it has one. */
  previous: string | null;
  /**
   * What the previous description would have been built from, used only when
   * `previous` is null: the roll's brief and the asks already applied.
   */
  seed: { brief: string; earlierAsks: readonly string[] };
  /** The one edit being made, in the customer's own words. */
  change: string;
};

export type CurrentDescriptionResult =
  | { ok: true; description: string; latencyMs: number; tokens?: { in: number; out: number }; model: string | null }
  | { ok: false; reason: "no_engine" | "failed" | "blank" | "too_long" | "edit_list"; latencyMs: number };

/** The user turn, built in one place so a test can read exactly what was asked. */
export function currentDescriptionUserTurn(input: CurrentDescriptionInput): string {
  const before = input.previous !== null && input.previous.trim() !== ""
    ? `How they looked before this change:\n${input.previous.trim()}`
    : [
      `How they were first described:\n${input.seed.brief.trim()}`,
      ...(input.seed.earlierAsks.length > 0
        ? [`Changes already made since, in order (fold them into the description):\n${input.seed.earlierAsks.map((ask) => `- ${ask.trim()}`).join("\n")}`]
        : []),
    ].join("\n\n");
  return `${before}\n\nThe change:\n${input.change.trim()}`;
}

/**
 * A REPLY THAT IS AN EDIT LIST IS REFUSED, NOT REPAIRED — the one shape his
 * ruling names. Bullets, numbered lines or several lines of prose are the list
 * shape; a description is one paragraph.
 */
export function looksLikeAnEditList(text: string): boolean {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
  if (lines.length > 1) return true;
  return /^\s*(?:[-*•]|\d+[.)])\s/.test(text);
}

export async function writeCurrentDescription(
  engine: TextEngine | null,
  input: CurrentDescriptionInput,
): Promise<CurrentDescriptionResult> {
  const started = Date.now();
  if (!engine) return { ok: false, reason: "no_engine", latencyMs: 0 };
  try {
    const result = await engine.complete({
      system: CURRENT_DESCRIPTION_SYSTEM,
      user: currentDescriptionUserTurn(input),
      about: "refine.describe",
      maxOutputTokens: 2000,
      timeoutMs: CURRENT_DESCRIPTION_TIMEOUT_MS,
      retries: CURRENT_DESCRIPTION_RETRIES,
    });
    const text = result.text.trim().replace(/^"([\s\S]*)"$/, "$1").trim();
    const latencyMs = result.latencyMs ?? Date.now() - started;
    if (text === "" || result.truncated) return { ok: false, reason: "blank", latencyMs };
    if (text.length > CURRENT_DESCRIPTION_MAX_LENGTH) return { ok: false, reason: "too_long", latencyMs };
    if (looksLikeAnEditList(text)) return { ok: false, reason: "edit_list", latencyMs };
    return {
      ok: true,
      description: text,
      latencyMs,
      ...(result.tokens ? { tokens: result.tokens } : {}),
      model: result.provenance?.model ?? null,
    };
  } catch (error) {
    /* The error's class only — a provider error can echo the request body, and
       the request body is the customer's brief. */
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "[currentDescription] the writer did not answer — this render rides today's prompt",
    );
    return { ok: false, reason: "failed", latencyMs: Date.now() - started };
  }
}

/**
 * THE SENTENCE THE REFINE PROMPT CARRIES, in place of "Change only …".
 *
 * Round 2's A4 arm, word for word apart from the pronoun, which tracks the cast
 * the way the identity clause beside it does: *"This is how they look now:
 * <description> Everything else about them stays exactly as in Reference 1."*
 */
export function describedNowSentence(description: string, pronouns: CastPronouns): string {
  const subject = pronouns.subject;
  const verb = pronouns.plural ? "look" : "looks";
  const body = description.trim().replace(/\s+/g, " ");
  const ended = /[.!?]$/.test(body) ? body : `${body}.`;
  return `This is how ${subject} ${verb} now: ${ended} Everything else about ${pronouns.object} stays exactly as in Reference 1.`;
}

/* ======================================================================== */
/*  THE FOLLOW BRIEF — #2576, his word 2026-10-16: "build it" (option 3).    */
/* ======================================================================== */

/**
 * WHEN A FOLLOW IS PRESSED ON A VERSION THAT HAS EDITS, the brief the cousins
 * are cast from is the roll's brief rewritten to carry the DIRECTION those edits
 * took — server-side, in the same click, before the claim. The rewritten words
 * become the new roll's recorded brief, so the new sheet shows exactly what the
 * cousins were made from and the customer can change it for the next roll.
 *
 * His ruling it is bound by, verbatim: *"following a cast is meant to show
 * cousins of that direction of cast not exact replicas of the same person you
 * followed"*. So the split the prompt pins is the whole job: what a stylist
 * would call the LOOK (hair, colour, style, augments, outfit direction, build)
 * goes in; what belongs to ONE person (an exact scar, a single mole, a
 * particular tattoo, eye colour the brief never asked for) stays out.
 *
 * Same engine, transport and failure contract as the description writer above:
 * it NEVER throws, and every failure is a value the caller answers by sending
 * the box's own words — a Follow must never fail, wait long, or cost
 * differently over a rewrite.
 */

/**
 * THE FOLLOW WAITS ON THIS ONE, SO IT IS SHORTER THAN THE REFINE'S 20 s. The
 * description writer measured median 1.6 s, worst 3.16 s over 31 calls on the
 * same engine; 8 s is two and a half times that worst case, and one retry
 * absorbs a single transport blip. Worst case before the roll starts: 2 × 8 s.
 * The queue wait sits outside both numbers, exactly as above.
 */
export const FOLLOW_BRIEF_TIMEOUT_MS = 8_000;
export const FOLLOW_BRIEF_RETRIES = 1;

export const FOLLOW_BRIEF_SYSTEM = [
  "You rewrite a casting brief for a casting studio. The customer cast someone from this brief, edited that cast, and now wants more people like the edited version: new people in the same direction, cousins and never copies of one person.",
  "You are given the brief and who the edited cast is now. Rewrite the brief so it naturally carries the direction their edits took.",
  "",
  "Rules:",
  "- Keep the brief's own voice, register, person and roughly its length. It must read as if the customer had always written it this way, never as a list of edits.",
  "- Never use the words now, changed, edited, updated, added, removed, new, no longer, instead or anymore, and never describe the edits themselves.",
  "- Fold in DIRECTION-LEVEL changes, the kind a whole casting call could share: hair colour, hair cut and hairstyle, overall style and look, augments, prosthetics and cybernetics, outfit direction, build, overall palette.",
  "- Leave out ONE-PERSON SPECIFICS, the kind that belong to a single face: an exact scar, a single mole or freckle, one particular tattoo or its exact placement, a precise facial feature, and eye colour unless the brief itself already states an eye colour.",
  "- Where an edit contradicts the brief (dark hair in the brief, platinum blonde after the edit), keep only the edited direction.",
  "- The edits only ever change the PERSON. Everything in the brief that is not the person (the setting, the light, the camera and framing, the picture style and the mood) is the look of the whole casting: keep every one of those phrases word for word.",
  "- Keep everything else the brief says that the edits do not touch, in its own words where you can.",
  "- Do not invent anything the brief and the edited cast do not say.",
  "- Reply with the rewritten brief and nothing else.",
].join("\n");

export type FollowBriefInput = {
  /** The followed face's own roll brief — the customer's words. */
  brief: string;
  /** That version's current description (#2565 slice 1), when it has one. */
  description: string | null;
  /** The version's asks in order — used only when there is no description. */
  asks: readonly string[];
};

export type FollowBriefResult =
  | { ok: true; brief: string; latencyMs: number; tokens?: { in: number; out: number }; model: string | null }
  | { ok: false; reason: "no_engine" | "no_edits" | "failed" | "blank" | "too_long" | "edit_list" | "shrunk"; latencyMs: number };

/**
 * A REWRITE THAT LOST MOST OF THE BRIEF IS REFUSED (the reviewer's risk the
 * relay verified on #2576): the failure that matters is a brief carrying scene
 * and style — "a rain-soaked neon alley, low angle, cinematic" — coming back
 * as a person-only paragraph, which loses the look of the whole family. The
 * prompt forbids it; this is the backstop a model cannot rescue (law 3). Edits
 * swap a phrase for a phrase, so a reply much shorter than the brief dropped
 * something, and the box's own words are sent instead.
 */
export const FOLLOW_BRIEF_MIN_LENGTH_RATIO = 0.7;

/** The user turn, built in one place so a test reads exactly what was asked. */
export function followBriefUserTurn(input: FollowBriefInput): string {
  const description = input.description?.trim() ?? "";
  const after = description !== ""
    ? `Who the edited cast is:\n${description}`
    : `The edits they made to that cast, in order:\n${input.asks.map((ask) => `- ${ask.trim()}`).join("\n")}`;
  return `The brief:\n${input.brief.trim()}\n\n${after}`;
}

export async function writeFollowBrief(
  engine: TextEngine | null,
  input: FollowBriefInput,
  maxLength: number,
): Promise<FollowBriefResult> {
  const started = Date.now();
  if (!engine) return { ok: false, reason: "no_engine", latencyMs: 0 };
  const hasDescription = (input.description?.trim() ?? "") !== "";
  if (!hasDescription && input.asks.filter((ask) => ask.trim() !== "").length === 0) {
    return { ok: false, reason: "no_edits", latencyMs: 0 };
  }
  try {
    const result = await engine.complete({
      system: FOLLOW_BRIEF_SYSTEM,
      user: followBriefUserTurn(input),
      about: "follow.brief",
      maxOutputTokens: 2000,
      timeoutMs: FOLLOW_BRIEF_TIMEOUT_MS,
      retries: FOLLOW_BRIEF_RETRIES,
    });
    const text = result.text.trim().replace(/^"([\s\S]*)"$/, "$1").trim();
    const latencyMs = result.latencyMs ?? Date.now() - started;
    if (text === "" || result.truncated) return { ok: false, reason: "blank", latencyMs };
    if (text.length > maxLength) return { ok: false, reason: "too_long", latencyMs };
    /* A one-paragraph brief that comes back as lines or bullets came back as an
       edit list. A brief the customer wrote on several lines may keep them. */
    if (!/\n/.test(input.brief.trim()) && looksLikeAnEditList(text)) {
      return { ok: false, reason: "edit_list", latencyMs };
    }
    if (text.length < input.brief.trim().length * FOLLOW_BRIEF_MIN_LENGTH_RATIO) {
      return { ok: false, reason: "shrunk", latencyMs };
    }
    return {
      ok: true,
      brief: text,
      latencyMs,
      ...(result.tokens ? { tokens: result.tokens } : {}),
      model: result.provenance?.model ?? null,
    };
  } catch (error) {
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "[currentDescription] the follow brief writer did not answer — this follow sends the box's words",
    );
    return { ok: false, reason: "failed", latencyMs: Date.now() - started };
  }
}
