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
import { testDriveCardId } from "../../shared/crewTestDrive.js";
import type { BriefingFacts, BriefingHostRow } from "./liveBriefing.mts";

/** What a reply is addressed to, and what the page currently says about it. */
export type ReplyHost = {
  id: string;
  title: string;
  /** How it is drawn on his page — the word a shift needs to say it back. */
  kind: "card" | "eye item";
  /** One of `CREW_CARD_STATES`, or null in a briefing that omits it. */
  state: string | null;
  /**
   * The GitHub card behind it, or null — the schema makes it nullable and 10
   * of edition 580's 143 `needsYou` rows have none (#1539, the reply mirror).
   *
   * It is carried HERE rather than indexed a second time beside this one: the
   * mirror needs *which issue* for the same reply this index already answers
   * *which item* for, and a second walk of the same two arrays is working law 4
   * waiting to happen.
   */
  issueNumber: number | null;
  /**
   * HOW the reply's id reached this item (#2466).
   *
   * `id` — the reply names the item's own slug, the road every reply took
   * before #1646. `card number` — the reply names `card-<issueNumber>`, the
   * spelling `testDriveCardId` writes for a test-drive answer, and it was
   * matched to the item carrying that issue number. The reader prints both the
   * same way; `staleOpenHosts` treats them differently, and says why.
   */
  via: "id" | "card number";
};

/** A minimal reply row — the two columns this judgement needs. */
export type ReplyRow = { id: number; cardId: string | null };

/**
 * Every id a reply may name, from ALL THREE spellings of the namespace.
 *
 * `needsYou` is walked first only so a briefing that has somehow duplicated an
 * id across the two arrays resolves to the card rather than silently to
 * whichever array sorted last — the schema refuses that shape at write time,
 * and this is what the reader does if one ever reaches it anyway.
 *
 * ⚠ **THE THIRD SPELLING IS `card-<issueNumber>`, AND THIS INDEX WAS ONE
 * NAMESPACE SHORT FOR IT FROM #1646 TO #2466.** A test-drive answer is
 * addressed by `testDriveCardId(issueNumber)` — never by the slug of the
 * completion card that carries the drive — so every milestone test drive he
 * ever answered printed *"(not in the current briefing)"* over a card the
 * briefing was holding: measured 2026-10-13, **31 of his 292 replies**, across
 * six cards (N2, P2, N2c, N2d, the bug hunt, and a top-up card). The same
 * defect this file's header records, one namespace deeper.
 *
 * So every row carrying an `issueNumber` is ALSO keyed under the id
 * `testDriveCardId` derives from it — the real function, imported, never a
 * retyped literal, because a retyped spelling is the drift. Two orders keep
 * everything that already resolved exactly where it was:
 *
 * 1. **Every explicit slug is placed before any derived key**, so a slug that
 *    happens to read `card-<n>` keeps its own row.
 * 2. **`needsYou` before `eyeItems` within the derived keys too**, and the
 *    first row naming an issue keeps the key — a card and its eye item often
 *    share one issue, and the card is the thing his page asks him about.
 *
 * An id no row derives — a card that left the briefing, a retired eye item —
 * is still absent, and the reader still says so.
 */
export function hostIndex(facts: BriefingFacts | null): Map<string, ReplyHost> {
  const index = new Map<string, ReplyHost>();
  const hostOf = (row: BriefingHostRow, kind: ReplyHost["kind"], via: ReplyHost["via"]): ReplyHost => ({
    id: row.id,
    title: typeof row.title === "string" ? row.title : row.id,
    kind,
    state: typeof row.state === "string" ? row.state : null,
    /* `typeof` rather than a truthiness test: issue 0 does not exist, but a
       reader that treats 0 and null the same is one that would treat a
       future 0-ish sentinel the same too. Anything that is not a number is
       no issue number. */
    issueNumber: typeof row.issueNumber === "number" ? row.issueNumber : null,
    via,
  });
  const usable = (rows: BriefingHostRow[] | undefined) =>
    (rows ?? []).filter((row): row is BriefingHostRow => !!row && typeof row.id === "string");
  const lists: [BriefingHostRow[], ReplyHost["kind"]][] = [
    [usable(facts?.needsYou), "card"],
    [usable(facts?.eyeItems), "eye item"],
  ];
  for (const [rows, kind] of lists) {
    for (const row of rows) {
      if (!index.has(row.id)) index.set(row.id, hostOf(row, kind, "id"));
    }
  }
  for (const [rows, kind] of lists) {
    for (const row of rows) {
      if (typeof row.issueNumber !== "number") continue;
      const key = testDriveCardId(row.issueNumber);
      if (!index.has(key)) index.set(key, hostOf(row, kind, "card number"));
    }
  }
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
    /*
      ⚠ THE LITERAL IS DELIBERATE AND THE GAP IT LEAVES IS ACCEPTED — #649
      finding 1, and it is written here because this is where the next reader
      will ask.

      `crewCardNeedsHim` is the WRONG predicate here even though `waiting` is a
      state that still needs him. This asks *has he answered something the page
      still calls open*; a `waiting` card is one a shift already moved, and the
      reply that moved it is the very reply that would then flag it. The
      instrument would report its own successes on every run.

      What is genuinely unwatched: a reply landing on an ALREADY-`waiting` card
      (*"I've run the command, close it"*), acknowledged and then not acted on.
      It self-heals when the issue closes, which is downstream of the act that
      went missing. Telling that reply from the one that moved the card needs a
      record of WHEN the state moved, and a `needsYou` row carries `filedAt`
      and nothing else — see `crewBriefing.ts`. Closing it means storing
      `stateChangedAt`, which is a change to his page's record, so it is a card
      and not a line.

      The exemption is enforced rather than promised: the desk-surface scanner
      in `waitingCardState.test.ts` reads `scripts/lib/` and holds this exact
      expression in its `ACCEPTED` register — and reddens if the line ever
      stops existing, so the hole cannot outlive the reason for it.
    */
    if (!host || host.state !== "open") continue;
    /*
      ⚠ A REPLY MATCHED BY CARD NUMBER IS NOT AN ANSWER TO THE ITEM'S QUESTION
      — #2466's second decision, made here on purpose rather than discovered.

      A `card-<n>` reply is a test-drive verdict on ONE STEP of a drive (or a
      note on a held queue row), not his word on what the completion card
      carrying the drive asks. The specimen is the day this landed: the bug
      hunt's completion card `bughunt-complete-2462` held all six of his
      matched verdicts and stayed `open` deliberately, because it waits on his
      word on the next rung. Sweeping it would tell a shift that card is stale —
      and `crew-read-replies.mts --write` plans from this list, so it would SET
      it `answered` on his page. Until #2466 no such reply resolved at all, so
      leaving them out here changes nothing this sweep has ever reported.
    */
    if (host.via !== "id") continue;
    const existing = byHost.get(host.id);
    if (existing) existing.replyIds.push(reply.id);
    else byHost.set(host.id, { host, replyIds: [reply.id] });
  }
  return [...byHost.values()];
}
