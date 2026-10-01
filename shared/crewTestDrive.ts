/**
 * A MILESTONE'S TEST DRIVE, READ OFF THE CARD THAT DECLARES IT (#1646).
 *
 * His word, 2026-10-01 (terminal), on N2's completion card: *"i mean this could
 * be a card on my desk if it tell me exactly what to drive and test but it
 * didnt??"* — and on the two-part proposal, *"yes."*
 *
 * THE MILESTONE GATE says every boundary ships a completion card plus a
 * test-drive list to him. #1644 did: a seven-step drive, in its BODY. **His
 * Desk draws a card as its title, one 160-character hold line and an answer
 * box — the body never renders.** So the one thing the card existed for was
 * visible only on GitHub, which is not where he looks.
 *
 * # ⚠ THE CARD BODY IS THE SOURCE OF TRUTH AND THIS IS THE ONLY READER
 *
 * Working law 4. The steps are not copied into the edition, not stored in a
 * table and not mirrored anywhere: the page reads them off the card the way
 * `holdReasonFromBody` reads the hold sentence, and an edit to the card is
 * live on his page within one queue tick. A second copy would drift, and the
 * first anybody would know is his page listing a step the card no longer has.
 *
 * ⚠ **AND THE ANSWERS LIVE IN THE SAME ONE PLACE — `crew_replies`, which the
 * Desk already has.** There is no table, no migration and no new mutation
 * here, which was the first thing measured rather than assumed:
 *
 * - `crew_replies.cardId` is `varchar(64)`, nullable, free-form, and
 *   deliberately validated against nothing (`server/routes/crew.ts`'s
 *   `replyInput`: *"the briefing rotates … refusing his words because a card
 *   moved is the one thing this surface must never do"*).
 * - `crewReplyMirrorTarget` (`shared/crewReplyMirror.ts`) resolves a bare
 *   `card-<N>` id straight to issue N with no briefing row at all.
 *
 * So a per-step answer is an ORDINARY Desk reply with `cardId: card-<N>` and
 * the step named in the first line — it rides the existing table, the existing
 * `crew.reply` mutation, the existing projection and the existing one-minute
 * mirror (`scripts/crew-mirror-replies.mts`), which is the #1539 road the card
 * asks for and gets for free. **Which steps are answered is DERIVED from those
 * replies** rather than stored beside them.
 *
 * # ⚠ WHAT THE CARD ASKED FOR THAT IS NOT HERE, NAMED RATHER THAN DISCOVERED
 *
 * The card says a *did not match* **files a `bug` card** in the same breath.
 * **Nothing in `server/` writes to GitHub** — the Desk's GitHub reads are
 * unauthenticated-capable (`liveQueueHeaders` adds a Bearer only if a token is
 * set) and every write in this feature family is a script. So the answer is
 * the reply, carrying the step, his note and the cards that step proves, and
 * the mirror puts it on the completion card within a minute; the `bug` card is
 * cut from that comment by the relay or the next shift. **That is a visible
 * change to what the card promised and it is stated out loud** — what the step
 * proves is extracted here precisely so whoever cuts it does not have to
 * re-read the card to find out.
 *
 * # ⚠ NO CARD NUMBER REACHES HIS PAGE, AND THAT IS THE POINT OF `proves`
 *
 * The disappearing-technology law: no pipeline vocabulary on a path he must
 * walk. Every step of #1644's drive ends in a parenthetical of card numbers —
 * *"…instead of being refused (#1582, #1612)"* — which is the crew's
 * bookkeeping, not his instruction. The numbers are lifted into `proves`, used
 * by the bug card nobody shows him, and **removed from the sentence he reads**.
 * Markdown emphasis and backticks go the same way, on his own ruling about his
 * Desk (*"no code, no markdown asterisks"*): the writer's bold lead was a
 * device for reading the card on GitHub, and the step is one instruction here.
 */
import { stripBlockLead } from "./crewMarkdownLead";

/**
 * The section heading that declares a drive.
 *
 * ⚠ **MATCHED AS A PREFIX, NOT AN EQUALITY, AND #1644 IS WHY** — its heading is
 * `## Your test drive (each one is a minute or two)`. A reader demanding the
 * exact string would have found no drive on the one card this feature was built
 * for, and the failure would have looked like an empty section rather than a
 * parse that missed.
 */
export const CREW_TEST_DRIVE_HEADING = "Your test drive";

/** One step of a drive: what to do, and the cards it proves. */
export type CrewTestDriveStep = {
  /**
   * Its position in the section, 1-based — **derived from the order of the
   * steps and never from the digit the writer typed.** A markdown list that
   * restarts at 1, or numbers itself `1.` all the way down (which markdown
   * renders correctly and writers do), would otherwise give two steps one
   * number — and the number is the id his answer is keyed on, so a collision
   * would file his verdict against the wrong step.
   */
  readonly n: number;
  /** The instruction as he reads it: no markdown, no backticks, no card numbers. */
  readonly text: string;
  /** The cards this step proves, for the bug card a *did not match* becomes. */
  readonly proves: readonly number[];
};

/**
 * ⚠ **THIS READER DOES NOT ANCHOR ON `stripBlockLead`, AND THAT IS NOT A SECOND
 * COPY OF THE RULE — IT IS THE OPPOSITE QUESTION.** `shared/crewMarkdownLead.ts`
 * exists to REMOVE block decoration so a reader can anchor on the text that is
 * left, and its `BLOCK_LEAD` removes an ordered-list marker among the rest. This
 * reader has to SEE that marker: it is the only thing that tells a step from a
 * line of prose. Deriving the population from a set that answers a different
 * question is a silent behaviour change, so the blockquote lead — the one piece
 * of decoration that can sit in FRONT of the marker — is taken off here, and
 * `stripBlockLead` is still what reads a continuation line's own text.
 */
const QUOTE_LEAD = /^[ \t]*(?:>[ \t]*)*/;

/** A numbered markdown list item, with any blockquote lead already off. */
const ORDERED_ITEM = /^(\d{1,3})[.)]\s+(\S.*)$/;

/** An ATX heading, at any level, with any blockquote lead already off. */
const ANY_HEADING = /^#{1,6}\s+(.*)$/;

/**
 * A parenthetical that is NOTHING BUT card references — `(#1582, #1612)`.
 *
 * ⚠ **The "nothing but" is the whole control.** #1644's own steps carry
 * parentheticals of real prose — *"(Jingu, or a new creature)"*, *"(one bare
 * shoulder)"* — and those are his instruction. A looser rule that ate any
 * parenthetical containing a `#` would delete half of what he is being told to
 * do, and the step would still read as a sentence, so nothing would look wrong.
 */
const CARD_REF_GROUP = /\s*\(\s*#\d{1,6}(?:\s*,\s*#\d{1,6})*\s*\)/g;

/** A card reference anywhere in a step — the population `proves` is read from. */
const CARD_REF = /#(\d{1,6})\b/g;

/**
 * His reading of a step: markdown emphasis and code ticks removed, card
 * references removed, whitespace closed up.
 *
 * ⚠ **IT NEVER TOUCHES THE PUNCTUATION AROUND WHAT IT REMOVES**, which is why
 * the card-ref strip takes the space before the bracket with it: *"…refused
 * (#1582, #1612)."* has to become *"…refused."* and not *"…refused ."*
 */
function readableStep(raw: string): string {
  return raw
    .replace(CARD_REF_GROUP, "")
    /* ⚠ **EVERY ASTERISK, AND THE ARM ON #1644 IS WHY.** The first shape removed
       `**` alone, and step 3's single-asterisk italics — *"says *Unchecked*"* —
       came through onto his page as asterisks. A `**`-only rule also leaves a
       stray asterisk behind wherever bold and italics nest. Asterisk has no
       other job in this corpus, so it goes. */
    .replace(/\*/g, "")
    .replace(/__/g, "")
    /* ⚠ **UNDERSCORE IS NOT SYMMETRIC WITH ASTERISK, AND MARKDOWN AGREES.** A
       single `_` is far more often the middle of an identifier here
       (`CASTING_V2_SCOPE`) than italics, and markdown's own rule is that an
       intraword underscore is not emphasis — so only a run paired at word
       boundaries is taken, and a constant survives intact. */
    .replace(/\b_([^_\n]+)_\b/g, "$1")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every card a step names, in the order it names them, without repeats.
 *
 * ⚠ **AN `exec` LOOP RATHER THAN `matchAll`, FOR `cardsNamedIn`'S REASON ONE
 * FILE OVER**: one tsconfig that compiles this module targets es5 and cannot
 * iterate a match iterator. A `for…of` here typechecks in the editor and
 * reddens `pnpm check`.
 */
function provesFrom(raw: string): number[] {
  const seen: Record<string, true> = {};
  const out: number[] = [];
  const token = new RegExp(CARD_REF.source, "g");
  let match: RegExpExecArray | null;
  while ((match = token.exec(raw)) !== null) {
    const n = Number(match[1]);
    if (!Number.isSafeInteger(n) || n <= 0 || seen[String(n)] === true) continue;
    seen[String(n)] = true;
    out.push(n);
  }
  return out;
}

/**
 * The drive a card body declares, or an empty list when it declares none.
 *
 * ⚠ **IT STOPS AT THE NEXT HEADING OF ANY LEVEL.** #1644's drive is followed by
 * `## Carried forward, not lost`, whose own bullets are not steps — and a
 * reader that ran to the end of the body would have put the carried-forward
 * remainder on his page as things to go and test.
 *
 * ⚠ **A CONTINUATION LINE JOINS THE STEP ABOVE IT.** A hard-wrapped step is one
 * instruction, and markdown says so; treating line two as its own step would
 * split a sentence across two sets of buttons.
 */
export function testDriveFromBody(body: string): readonly CrewTestDriveStep[] {
  let inside = false;
  let previousBlank = true;
  const raw: string[] = [];

  for (const line of body.split(/\r?\n/)) {
    const unquoted = line.replace(QUOTE_LEAD, "");
    const text = stripBlockLead(unquoted).trim();
    const blank = text === "";
    const heading = ANY_HEADING.exec(unquoted);
    if (heading) {
      const title = heading[1].replace(/\*\*/g, "").trim();
      inside = title.toLowerCase().startsWith(CREW_TEST_DRIVE_HEADING.toLowerCase());
      previousBlank = true;
      continue;
    }
    if (!inside) {
      previousBlank = blank;
      continue;
    }
    const item = ORDERED_ITEM.exec(unquoted);
    if (item) {
      raw.push(item[2]);
      previousBlank = false;
      continue;
    }
    if (blank) {
      /* A blank line inside a list is markdown's loose-list spacing, not an
         end — the next `1.` item is still a step. */
      previousBlank = true;
      continue;
    }
    if (raw.length === 0) {
      /* Prose between the heading and the first step is the writer introducing
         the drive. It is not a step and it is not an end. */
      previousBlank = false;
      continue;
    }
    if (previousBlank) {
      /* ⚠ **A PARAGRAPH AFTER A BLANK LINE ENDS THE LIST, AND MARKDOWN IS WHAT
         SAYS SO — #1644 WOULD HAVE BEEN BITTEN BY THE LOOSER RULE.** Its drive
         is followed by `## Carried forward, not lost`, so the heading saves it
         today; move that section above the drive, or drop the heading, and the
         closing sentence *"If anything on the drive does not match, say so on
         this card"* would have been glued onto step 7 as part of the
         instruction. A hard-wrapped step has no blank line before its own
         continuation, which is precisely the difference. */
      inside = false;
      previousBlank = false;
      continue;
    }
    /* A continuation of the step above: one instruction, hard-wrapped, with its
       own decoration taken off by the reader that exists for that. */
    raw[raw.length - 1] = `${raw[raw.length - 1]} ${text}`;
    previousBlank = false;
  }

  const steps: CrewTestDriveStep[] = [];
  for (const entry of raw) {
    const text = readableStep(entry);
    /* A step that reads as nothing once the bookkeeping is off it is a line of
       bookkeeping, and putting an empty instruction in front of two buttons is
       worse than dropping it. */
    if (text === "") continue;
    steps.push({ n: steps.length + 1, text, proves: provesFrom(entry) });
  }
  return steps;
}

/** What he pressed. Two words, because two is the whole decision (#1646). */
export type CrewTestDriveVerdict = "matched" | "did-not-match";

/** What each verdict says on his page and in the reply the card receives. */
export const CREW_TEST_DRIVE_WORD: Record<CrewTestDriveVerdict, string> = {
  matched: "matched",
  "did-not-match": "did not match",
};

/** One answer of his, as the reply body carries it. */
export type CrewTestDriveAnswer = {
  readonly step: number;
  readonly verdict: CrewTestDriveVerdict;
  /** What he typed under a *did not match*, or `null`. */
  readonly note: string | null;
};

/**
 * The first line of an answering reply — the one thing both halves agree on.
 *
 * ⚠ **IT IS PROSE HE AND HIS GITHUB-READING AGENTS CAN READ, NOT A TOKEN.**
 * This reply is mirrored VERBATIM onto the completion card within a minute
 * (#1539), where his Grok team and the relay read it; a machine marker would
 * put `{"step":3}` on his own queue in his name. So the wire format is the
 * sentence, and the reader below is anchored on it.
 */
export function testDriveAnswerBody(answer: CrewTestDriveAnswer): string {
  const head = `Test drive step ${answer.step} — ${CREW_TEST_DRIVE_WORD[answer.verdict]}`;
  const note = answer.note?.trim() ?? "";
  return note === "" ? head : `${head}\n\n${note}`;
}

/**
 * ⚠ **THREE DASHES ARE ACCEPTED AND ONLY ONE IS WRITTEN.** The writer above
 * always emits an em dash; a reply typed by hand, round-tripped through a
 * terminal, or pasted out of a GitHub comment may carry an en dash or a plain
 * hyphen instead. A reader that insisted on the character it writes would read
 * his own answer as prose and leave the step unanswered on his page — the
 * silence direction, bought for nothing.
 */
const ANSWER_HEAD = /^test drive step (\d{1,3})\s*[—–-]\s*(matched|did not match)\s*$/i;

/**
 * One reply read as an answer, or `null` when it is ordinary prose.
 *
 * ⚠ **ANCHORED ON THE FIRST LINE AND NOWHERE ELSE.** He writes freely on these
 * cards, and a reply that DISCUSSES a step — *"step 3 matched but the wording
 * is odd"* — is prose, not a verdict; a reader scanning the whole body would
 * take it as one and mark the step done on a sentence that was asking a
 * question. The note is everything after the first blank line, so his own words
 * can say anything at all without being parsed.
 */
export function testDriveAnswerFromReply(body: string): CrewTestDriveAnswer | null {
  const lines = body.split(/\r?\n/);
  const head = ANSWER_HEAD.exec((lines[0] ?? "").trim());
  if (!head) return null;
  const step = Number(head[1]);
  if (!Number.isSafeInteger(step) || step <= 0) return null;
  const note = lines.slice(1).join("\n").trim();
  return {
    step,
    verdict: head[2].toLowerCase() === "matched" ? "matched" : "did-not-match",
    note: note === "" ? null : note,
  };
}

/**
 * A reply as the Desk already holds it — the three fields this reader needs.
 *
 * ⚠ **`createdAt` IS `string | Date` BECAUSE THE TWO CALLERS GENUINELY HOLD
 * DIFFERENT THINGS, AND NARROWING IT WOULD PUSH A CONVERSION ONTO EACH.** The
 * database projection carries a MySQL datetime; the page receives the same row
 * through superjson, which revives it as a `Date`. A reader that demanded one
 * would make the other call site coerce, and a coercion written twice is the
 * drift working law 4 is about.
 */
export type CrewTestDriveReply = {
  readonly cardId: string | null;
  readonly body: string;
  readonly createdAt: string | Date;
};

/** One instant, comparable, whichever of the two shapes carried it. */
function sentAt(at: string | Date): number {
  const ms = at instanceof Date ? at.getTime() : Date.parse(at);
  /* An unparseable stamp sorts OLDEST rather than newest: a row we cannot date
     must never silently outrank one we can and overwrite his latest word. */
  return Number.isFinite(ms) ? ms : 0;
}

/** The `crew_replies.cardId` a drive's answers are addressed to. */
export function testDriveCardId(issueNumber: number): string {
  return `card-${issueNumber}`;
}

/**
 * His answers to one drive, by step — **the NEWEST reply per step wins.**
 *
 * ⚠ **THAT IS A DECISION AND IT RUNS HIS WAY.** He drives a milestone over days
 * and a step he marked *matched* may turn out not to; a reader keeping the
 * first answer would freeze the earlier verdict and leave him nothing to do
 * about it but write prose nobody parses. Changing his mind is a thing he is
 * allowed to do, so the last word is the word.
 */
export function testDriveAnswers(
  issueNumber: number,
  replies: readonly CrewTestDriveReply[],
): ReadonlyMap<number, CrewTestDriveAnswer> {
  const cardId = testDriveCardId(issueNumber);
  const latest = new Map<number, { at: number; answer: CrewTestDriveAnswer }>();
  for (const reply of replies) {
    if (reply.cardId !== cardId) continue;
    const answer = testDriveAnswerFromReply(reply.body);
    if (answer === null) continue;
    const held = latest.get(answer.step);
    const at = sentAt(reply.createdAt);
    /* `>=` so two replies sharing a timestamp resolve to the later ROW, which
       is the order `listCrewReplies` hands them over in. */
    if (held === undefined || at >= held.at) {
      latest.set(answer.step, { at, answer });
    }
  }
  /* `forEach` rather than spreading the map — es5 again (see `provesFrom`). */
  const answers = new Map<number, CrewTestDriveAnswer>();
  latest.forEach((held, step) => { answers.set(step, held.answer); });
  return answers;
}

/**
 * How many steps across every drive he has not answered — the one number the
 * section menu carries.
 *
 * ⚠ **IT LIVES HERE AND NOT IN THE COMPONENT, SO A NODE SUITE CAN DRIVE IT.**
 * It is arithmetic over the same two readers the page uses, and a count that is
 * only reachable through a React tree is a count nothing can hold to the
 * answers it claims to be summarising.
 */
export function testDriveOpenSteps(
  drives: ReadonlyArray<{ readonly issueNumber: number; readonly steps: readonly CrewTestDriveStep[] }>,
  replies: readonly CrewTestDriveReply[],
): number {
  let open = 0;
  for (const drive of drives) {
    const answers = testDriveAnswers(drive.issueNumber, replies);
    for (const step of drive.steps) {
      if (!answers.has(step.n)) open += 1;
    }
  }
  return open;
}
