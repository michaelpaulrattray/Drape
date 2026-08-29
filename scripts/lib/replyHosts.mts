/**
 * WHICH BRIEFING ITEM A REPLY IS ADDRESSED TO — and which of those he has
 * already answered while the page still says `open` (shift 96, 2026-08-29).
 *
 * # THE INCIDENT
 *
 * His own words on the relay, 16:20: *"the desk still shows items he has
 * already answered (concept-cast-it-196, concept-review-modal, both answered
 * by replies #23/#24/#25 on 08-28, still 'open' on edition 98)."* Three
 * editions were written after those replies landed and none of them moved the
 * state. It was not inattention. `crew-read-replies.mts` — the ONE tool a
 * shift reads him with, run at shift start and again at shift close — built
 * its card index from `needsYou` alone and printed *"(not in the current
 * briefing)"* for everything else, which reads as *the card is gone, there is
 * nothing to update*.
 *
 * Measured at the artifact before anything was written (working law 1, and
 * law 7b — the reading is quoted rather than the mechanism reasoned about):
 * **20 of his 28 replies carried that sentence; the 17 distinct ids under it
 * were ALL present in the briefing, in `eyeItems`, and 0 were genuinely
 * absent.** A false sentence, on almost every line, in the tool the whole
 * steering loop runs through.
 *
 * # WHY THE UNION IS NOT A JUDGEMENT CALL
 *
 * `server/crew/crewBriefing.ts` already states it as law and enforces it:
 * *"needsYou[].id and eyeItems[].id share one reply namespace and must be
 * unique across both"*. So the namespace was written down, in the schema the
 * page itself parses through, and the reader mirrored one arm of it — working
 * law 4 exactly, and the drift ran the whole length of the Crew tab's life.
 * `hostIndex` derives from the union; there is no second list to keep.
 *
 * # THE SWEEP IS THE CLASS FIX
 *
 * Fixing the label alone would leave the next shift to notice, by eye, that a
 * card it is reading a reply for is still `open`. `staleOpenHosts` asks that
 * question mechanically, on every run, over ACKNOWLEDGED replies — the ones
 * the default read no longer prints at all, which is precisely why these two
 * could go three editions unseen. It answers the founder's standing order
 * (*"Mark every answered item's state in the SAME edition that acknowledges
 * its reply"*) with a reading instead of a memory.
 *
 * It is the same shape as the schema's #133 refinement (*"an eye item cannot
 * outlive its card"*) pointed at the half a repo-local parse cannot see: the
 * reply→card link lives in `crew_replies`, in the database, so the judgement
 * belongs to the tool that already holds both halves.
 *
 * # PURE, AND NEVER A WRITE
 *
 * Both functions are total and take their inputs as arguments — the reader's
 * read-only posture is untouched, and `server/replyHosts.test.ts` drives them
 * on the incident's exact shape plus its negative controls.
 */
import type { BriefingFacts, BriefingHostRow } from "./liveBriefing.mts";

/** What a reply is addressed to, and what the page currently says about it. */
export type ReplyHost = {
  id: string;
  title: string;
  /** How it is drawn on his page — the word a shift needs to say it back. */
  kind: "card" | "eye item";
  /** `open` | `answered` | `done`, or null in a briefing that omits it. */
  state: string | null;
};

/** A minimal reply row — the two columns this judgement needs. */
export type ReplyRow = { id: number; cardId: string | null };

/**
 * Every id a reply may name, from BOTH halves of the namespace.
 *
 * `needsYou` is walked first only so a briefing that has somehow duplicated an
 * id across the two arrays resolves to the card rather than silently to
 * whichever array sorted last — the schema refuses that shape at write time,
 * and this is what the reader does if one ever reaches it anyway.
 */
export function hostIndex(facts: BriefingFacts | null): Map<string, ReplyHost> {
  const index = new Map<string, ReplyHost>();
  const add = (rows: BriefingHostRow[] | undefined, kind: ReplyHost["kind"]) => {
    for (const row of rows ?? []) {
      if (!row || typeof row.id !== "string" || index.has(row.id)) continue;
      index.set(row.id, {
        id: row.id,
        title: typeof row.title === "string" ? row.title : row.id,
        kind,
        state: typeof row.state === "string" ? row.state : null,
      });
    }
  };
  add(facts?.needsYou, "card");
  add(facts?.eyeItems, "eye item");
  return index;
}

/** One item his page still calls `open` after he answered it. */
export type StaleOpenHost = { host: ReplyHost; replyIds: number[] };

/**
 * Items whose state is `open` while an ACKNOWLEDGED reply points at them.
 *
 * Acknowledged is the right population and the narrow one: an unacknowledged
 * reply is printed in full by the reader's own default read, so the shift is
 * already looking at it. What went wrong on 08-28 is the other side — a reply
 * read, acknowledged, acted on in code, and its card left where it was.
 *
 * Anything the briefing does not hold is NOT reported here. A reply naming an
 * id no edition carries is a different finding (a retired card, a typo) and it
 * has its own line in the reader; folding it in would make this list mean two
 * things and silently grow.
 */
export function staleOpenHosts(facts: BriefingFacts | null, replies: readonly ReplyRow[]): StaleOpenHost[] {
  if (!facts) return [];
  const acknowledged = new Set(facts.acknowledgedReplyIds ?? []);
  const index = hostIndex(facts);
  const byHost = new Map<string, StaleOpenHost>();
  for (const reply of replies) {
    if (reply.cardId == null || !acknowledged.has(reply.id)) continue;
    const host = index.get(reply.cardId);
    if (!host || host.state !== "open") continue;
    const existing = byHost.get(host.id);
    if (existing) existing.replyIds.push(reply.id);
    else byHost.set(host.id, { host, replyIds: [reply.id] });
  }
  return [...byHost.values()];
}
