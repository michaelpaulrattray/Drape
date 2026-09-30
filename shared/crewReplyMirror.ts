/**
 * HIS DESK REPLY, ON ITS GITHUB CARD — the rules, with no I/O in them (#1539).
 *
 * # THE ORDER
 *
 * Founder, 2026-09-30 (terminal), asked *"it seems my grokbot team cannot see
 * my replies to cards instantly whys this?"*, told the chain — a Desk reply is
 * a `crew_replies` row in the production database, quoted onto the GitHub card
 * only when a shift next acts on it — and offered (1) mirror each reply onto
 * its card the moment it is sent, or (2) leave the delay. His word, verbatim:
 * **"go with 1"**.
 *
 * The measured delay it replaces, from the specimen filed on his card: four
 * replies at 23:23–23:27Z on 2026-09-29 reached their cards at ~23:50Z.
 * **Twenty-five minutes, and it was luck rather than design** — a shift
 * happened to re-read his replies before shipping an edition. Had it closed
 * twenty minutes earlier the four answers would have sat unquoted overnight.
 *
 * # WHAT IS HERE AND WHAT IS NOT
 *
 * Everything in this file is TOTAL and takes its inputs as arguments: which
 * card a reply is addressed to, what the comment says, and whether it is
 * already there. The database, GitHub and the state file all live in
 * `scripts/crew-mirror-replies.mts`, which is the only thing that can fail.
 * `server/crewReplyMirror.test.ts` drives both halves.
 *
 * # ⚠ WHY IT IS A POLLER OUTSIDE THE PRODUCT AND NOT A HOOK INSIDE IT
 *
 * The card offered the seat two shapes and asked it to say why. The in-server
 * shape needs a GitHub **write** credential living on the customer-facing
 * Railway service, and that decision is already on the record twice, both
 * times as HIS to make:
 *
 * - **#285**, verbatim: *"do not add a server call, a token or an outbound
 *   dependency … that is the same credential decision `crew-count-queue.mts`'s
 *   docblock deliberately refused, and it is his to make, not a shift's."*
 * - **`server/routes/crew.ts`**, on the card-intent mutation that deliberately
 *   does NOT close a card: *"Closing it here needs a repository WRITE token
 *   living in production — a bigger exposure than the READ token already
 *   declined on #285, and one that can change things rather than only read
 *   them. That is a credential decision and it is his."*
 *
 * A shift that granted itself that credential would be answering his question
 * for him, so the poller is the shape that was available to build. It keeps
 * GitHub off the product process entirely — no new Railway variable, no new
 * egress from the process customers talk to — and it costs a minute instead of
 * a second. **If he wants the sub-second version, the only thing in the way is
 * his word on the credential**, and that is written on the card rather than
 * assumed either way.
 *
 * # THE COMMENT IS A HEADER AND HIS WORDS, AND NOTHING ELSE
 *
 * His body is carried RAW — not re-wrapped, not blockquoted, not fenced. A
 * blockquote reads nicely and it edits every line of what he wrote, which is
 * the one thing a verbatim record may not do; the arm asserts his body is an
 * exact substring of the comment, which a `> ` prefix would break. What is
 * added is one header line above it and one HTML marker below it, and the
 * marker is what makes a retry safe.
 */

/**
 * The hidden marker that says *this reply is already on this card*.
 *
 * ⚠ **IT IS THE REAL IDEMPOTENCY GUARD, AND THE STATE FILE IS ONLY AN INDEX.**
 * The poller keeps a high-water mark on disk so it does not re-read the whole
 * thread every minute, but that file lives on one machine and can be lost. The
 * marker lives where the comment does, so the question *did this already post*
 * is answered by the artifact rather than by a record of the artifact — working
 * law 1 at the smallest scale it has.
 *
 * An HTML comment because GitHub renders it to nothing: the card shows his
 * words and no bookkeeping.
 */
export function crewReplyMirrorMarker(replyId: number): string {
  return `<!-- crew-reply-mirror:${replyId} -->`;
}

/**
 * Is this reply already on this card?
 *
 * Exact substring of the marker for THIS id — never a prefix test. `:23` is a
 * prefix of `:236`, and a reader matching on prefixes would call reply 236
 * already mirrored the moment reply 23 was.
 */
export function crewReplyIsMirrored(commentBodies: readonly string[], replyId: number): boolean {
  const marker = crewReplyMirrorMarker(replyId);
  return commentBodies.some((body) => body.includes(marker));
}

/**
 * The author's display name, resolved the one way.
 *
 * ⚠ **THIS IS THE SAME RULE `server/db/crewReplies.ts` APPLIES TO THE PAGE, AND
 * IT LIVES HERE SO THERE IS ONE OF IT** (working law 4). The page and the
 * mirrored comment name the same person; two copies of a three-branch fallback
 * drift, and the symptom would be his own name rendering differently in two
 * places on the same reply.
 *
 * A deleted or unnamed author still has a thread entry — his words outlive the
 * row that names him, and "a member of the crew" is honest where a blank would
 * read as a rendering fault.
 */
export function crewReplyAuthorLabel(row: {
  displayName?: string | null;
  name?: string | null;
}): string {
  return row.displayName?.trim() || row.name?.trim() || "a member of the crew";
}

/** Where a reply is to be mirrored, or why it is not. */
export type CrewReplyMirrorTarget =
  | {
    readonly kind: "issue";
    readonly issueNumber: number;
    /** `bare` — the id carried the number. `briefing` — the edition card did. */
    readonly via: "bare" | "briefing";
  }
  | { readonly kind: "skip"; readonly reason: string };

/**
 * A bare live-desk row's id: `card-<N>`, and N is the issue number itself.
 *
 * `client/src/features/admin/components/crew/crewTypes.ts` coins it
 * (`needsYouCardFromHold`) and says why the number rather than a slug: *"there
 * is no shift to coin one … `#N` is the one identity this row and his answer
 * can both be sure of."* Anchored at both ends and digits only, so a slug that
 * merely begins `card-` is not mistaken for one.
 */
const BARE_CARD_ID = /^card-(\d+)$/;

/**
 * Which GitHub card a reply is addressed to.
 *
 * TWO shapes reach this, and the first is the one his answers actually arrive
 * on now — measured on the specimen filed on #1539, where **all four** of his
 * replies that night were bare rows and none was in the briefing at all:
 *
 * 1. **`card-<N>`** — a held-card row the live desk draws from the queue. The
 *    number is in the id; nothing else is consulted, so it resolves even when
 *    the briefing has never heard of the card.
 * 2. **An edition card's slug** (`sign-version-1478`) — resolved through the
 *    briefing's own `issueNumber`, from the UNION of `needsYou` and `eyeItems`
 *    because the schema states outright that the two share one reply namespace.
 *
 * ⚠ **AND EVERYTHING ELSE IS A SKIP RATHER THAN A GUESS.** `null` is a General
 * note and has no card by definition. A slug the briefing no longer holds, or
 * one whose `issueNumber` is null (10 of the 143 `needsYou` rows in edition 580
 * are), resolves to nothing — and the briefing ROTATES, which is exactly why
 * `crew_replies.cardId` is *"bounded at 64 and validated for NOTHING ELSE"*.
 * A skip is not a failure: the reply is kept, `crew-read-replies.mts` still
 * prints it in full, and a shift quotes it by hand as it always did. Inventing
 * a card number from a slug we cannot resolve would put his words on somebody
 * else's card, which is worse than the delay this feature removes.
 */
export function crewReplyMirrorTarget(
  cardId: string | null,
  issueNumberByCardId: ReadonlyMap<string, number | null>,
): CrewReplyMirrorTarget {
  if (cardId === null) return { kind: "skip", reason: "a General note — it names no card" };

  const bare = BARE_CARD_ID.exec(cardId);
  if (bare) {
    const issueNumber = Number(bare[1]);
    /* `card-0` and an id long enough to overflow are both shapes the regex
       admits and GitHub does not. Refuse them here rather than at the wire. */
    if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
      return { kind: "skip", reason: `'${cardId}' is not a card number` };
    }
    return { kind: "issue", issueNumber, via: "bare" };
  }

  if (!issueNumberByCardId.has(cardId)) {
    return { kind: "skip", reason: `'${cardId}' is not in the deployed briefing` };
  }
  const fromBriefing = issueNumberByCardId.get(cardId) ?? null;
  if (fromBriefing === null) {
    return { kind: "skip", reason: `'${cardId}' is in the briefing and carries no issue number` };
  }
  return { kind: "issue", issueNumber: fromBriefing, via: "briefing" };
}

/** The columns the comment is composed from. */
export type CrewReplyForMirror = {
  readonly id: number;
  readonly body: string;
  /** Already formatted `YYYY-MM-DD HH:MM:SSZ` by the caller's `utc()`. */
  readonly sentAtUtc: string;
  readonly author: string;
};

/**
 * The comment, whole.
 *
 * Three parts and no fourth: a header naming him, the time and the reply id;
 * **his body exactly as he typed it**; and the marker. The blank lines are
 * markdown's paragraph break and are the only characters between them.
 *
 * ⚠ **HIS BODY SITS LAST BUT ONE ON PURPOSE.** Put the marker between the
 * header and the body and a reply beginning with a list or a fence renders
 * against it; fold the header into the body's own first paragraph and his
 * first line stops being his first line.
 */
export function crewReplyMirrorComment(reply: CrewReplyForMirror): string {
  return `**${reply.author} — Desk reply #${reply.id} (${reply.sentAtUtc}):**\n\n`
    + `${reply.body}\n\n`
    + crewReplyMirrorMarker(reply.id);
}
