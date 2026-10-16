/**
 * THE BRIEF A FOLLOW SENDS — #2576, his word 2026-10-16: *"build it"*
 * (option 3 on the card).
 *
 * Called by the `follow` procedure BEFORE `createRoll`, so before the claim:
 * whatever this returns is the `briefText` the roll is cast from and records,
 * and therefore what the new sheet shows as its brief. Price, claim and refunds
 * are `createRoll`'s and are untouched — this only chooses a string.
 *
 * It returns the box's own words, the very string it was handed, in every case
 * but one: the account is inside `CASTING_CURRENT_DESCRIPTION_SCOPE`, the
 * followed face's SELECTED version has edits, the box still holds that face's
 * roll brief (the customer has not typed something else — their own words
 * always win and are sent unrewritten), and the writer answered. A never-edited
 * face's Follow is therefore byte-identical to today's, and a writer that fails
 * or times out costs at most its own short timeout and then sends the box.
 *
 * It never throws.
 */
import { BRIEF_TEXT_MAX_AUTHOR_ROAD } from "../../shared/briefLength";
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { getFollowBriefSource, type FollowBriefSource } from "../db/castingV2";
import { captureCastingCurrentDescriptionEnabled } from "./castingV2Scope";
import { writeFollowBrief } from "./currentDescription";
import { interpreterEngine } from "./interpreter";

const log = createModuleLogger("castingV2/followBrief");

export type FollowBriefOutcome =
  | "off"
  | "unread"
  | "unedited"
  | "typed"
  | "rewritten"
  | "writer_failed";

export type FollowBriefDependencies = {
  enabled?: (userId: number) => boolean;
  readSource?: (userId: number, candidatePublicId: string) => Promise<FollowBriefSource | null>;
  engine?: () => TextEngine | null;
};

export async function resolveFollowBrief(
  input: { userId: number; candidatePublicId: string; boxText: string },
  dependencies: FollowBriefDependencies = {},
): Promise<{ briefText: string; outcome: FollowBriefOutcome }> {
  const box = input.boxText;
  if (!(dependencies.enabled ?? captureCastingCurrentDescriptionEnabled)(input.userId)) {
    return { briefText: box, outcome: "off" };
  }
  let source: FollowBriefSource | null;
  try {
    source = await (dependencies.readSource ?? getFollowBriefSource)(input.userId, input.candidatePublicId);
  } catch (error) {
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "[followBrief] could not read the followed version — this follow sends the box's words",
    );
    return { briefText: box, outcome: "unread" };
  }
  /* An unknown or foreign face is `createRoll`'s refusal to make, not ours. */
  if (!source) return { briefText: box, outcome: "unread" };
  if (!source.edited) return { briefText: box, outcome: "unedited" };
  /* THE CUSTOMER'S OWN TYPING WINS — the box differs from the face's brief. */
  if (box.trim() !== source.rollBrief.trim() || source.rollBrief.trim() === "") {
    return { briefText: box, outcome: "typed" };
  }
  const written = await writeFollowBrief(
    (dependencies.engine ?? interpreterEngine)(),
    { brief: source.rollBrief, description: source.description, asks: source.asks },
    BRIEF_TEXT_MAX_AUTHOR_ROAD,
  );
  if (!written.ok) {
    log.warn(
      { candidate: input.candidatePublicId, reason: written.reason, latencyMs: written.latencyMs },
      "[followBrief] the follow brief writer did not answer — this follow sends the box's words",
    );
    return { briefText: box, outcome: "writer_failed" };
  }
  /* Cost and time, never the words — the brief is the customer's. */
  log.info(
    {
      candidate: input.candidatePublicId,
      latencyMs: written.latencyMs,
      tokens: written.tokens ?? null,
      model: written.model,
      fromDescription: source.description !== null,
    },
    "[followBrief] the follow's brief carries the direction the edits took",
  );
  return { briefText: written.brief, outcome: "rewritten" };
}
