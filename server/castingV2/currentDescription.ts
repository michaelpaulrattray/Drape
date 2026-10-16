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

/** The writer's own deadline — a paid render waits on it, so it is short. */
export const CURRENT_DESCRIPTION_TIMEOUT_MS = 45_000;

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
