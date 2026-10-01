/**
 * IS SOMEBODY ALREADY BUILDING THIS CARD? — THE FACT-GRADE ANSWER (#1094).
 *
 * His order, 2026-09-26 (terminal), verbatim: *"work on 1094 and 1307 next so
 * the desk shows whats built"* — said after his Background Work panel offered
 * him #1231, #1217, #1258, #1248 and #1288 as work a shift could take tonight
 * while every one of them had a pull request in the merge queue or a recorded
 * refusal on the card.
 *
 * # ⚠ WHY THIS IS NOT `findCardPullRequests`, WHICH IS THE READER THE CARD
 * NAMED — AND THE NUMBERS THAT DECIDED IT
 *
 * `shared/crewShiftState.ts`'s `findCardPullRequests` answers the same English
 * question and it is deliberately WIDE: a bare `#N` anywhere in a pull
 * request's body counts, because that reader's whole output is a WARNING to a
 * person who is about to read the pull request anyway (#1083's ruling). Its own
 * docblock says the match is "deliberately wide in one direction".
 *
 * **His page states a FACT, so the same width is a lie there.** Measured at the
 * wire on the day this landed, over the eleven open pull requests: PR #1326's
 * body names **#1248, #1193, #493, #893 and #566**, of which exactly one is the
 * card it is building — every seat's body cites the laws and the precedents it
 * worked from. A row reading *"being built"* against #493 because somebody
 * quoted it is worse than the silence it replaced, because he cannot tell the
 * two apart.
 *
 * So the rule here is NARROW, and every limb of it is the repository's own
 * written convention rather than a guess:
 *
 *  - **the title** — `#N` as a token, the same expression `findCardPullRequests`
 *    builds, imported from beside it so there is one spelling (working law 4);
 *  - **`card #N` in the body** — the seat brief's own sentence is *"Write 'for
 *    card #N (closed by hand with its receipt)' instead"*, and all eleven open
 *    pull requests carried it, including the two whose titles name no card at
 *    all (#1315 for #1182, #1316 for #1231 — the two of his five that a
 *    title-only reader would have missed);
 *  - **the branch**, when the caller has one — `team/<slug>-<card>`, judged by
 *    `findCardPullRequests`' own digit-run rule. GitHub's search API does not
 *    return a head ref, so the Desk has this limb empty and a shift's `gh pr
 *    list` has it full. **That is a stated difference in what each caller can
 *    see, not two rules.**
 *
 * # WHAT A CLAIM AND A REFUSAL ARE, AND WHY THEY COME FROM COMMENTS
 *
 * Neither has a mechanical home in this repository. A seat claims a card by
 * posting `CLAIMED — <seat>, <UTC time>` on it (the standing orders' step 1)
 * and refuses one by posting what the code actually says (`NOT BUILT — …`,
 * the builder-seat rule of 2026-09-26). Both are comments, so a comment is
 * what has to be read — and the parsers below are anchored at the START of a
 * comment body on purpose: every one of the 222 comments filed in the twelve
 * hours before this shipped was read, 28 claims and one refusal were found,
 * and a phrase search would have been useless (`in:comments "NOT BUILT"` over
 * this repository returns six cards, four of them false, because GitHub treats
 * `not` as a stopword and the query degenerates to the word *built*).
 *
 * ⚠ **A REFUSAL HAS A SECOND HOME SINCE #1337, AND IT IS THE DURABLE ONE: THE
 * `not-built` LABEL** (his word, 2026-09-29 — **A**). The paragraph above is
 * still true of how a refusal is WRITTEN — a shift posts `NOT BUILT — …` with
 * `file:line`, because the reason is prose and belongs in prose — but the comment
 * is no longer the only thing a reader can find. **The comment is the argument;
 * the label is the fact.** `CREW_NOT_BUILT_LABEL` below carries the reasoning
 * and `crewCardBuildState` carries where it sits in the order. A claim still has
 * only its comment, and that is correct: a claim is worthless after twelve hours,
 * so it never needed a permanent home.
 *
 * ⚠ **`RELEASED` IS NOT A REFUSAL, AND THE CARD THAT ORDERED THIS WORK SAID IT
 * WAS.** The re-scope's parenthesis reads *"a comment starting `Not built` /
 * `RELEASED`"*; the standing orders it descends from read *"A seat that
 * finishes or abandons a card posts `RELEASED — <seat>` or the PR"*. A release
 * puts a card BACK on offer, so filing it as a refusal would hide exactly the
 * work a shift should pick up. It cancels a live claim here and nothing else.
 *
 * Every function is pure over facts a caller has already read, so the arms in
 * `server/crewCardBuildState.test.ts` drive them on captured GitHub bodies
 * rather than on a shape imagined here.
 */
import { cardNumberToken, type CardPullRequestWhere } from "./crewShiftState";
import { blockOpeningLines } from "./crewMarkdownLead";
import {
  handVerdictFreshness,
  isHandFinding,
  isHandVerdict,
  type HandVerdictFreshness,
} from "./handVerdict";

/** Twelve hours — the standing orders' own window for a live claim. */
export const CREW_CLAIM_LIVE_MS = 12 * 60 * 60 * 1000;

/** What the page draws on a row, and what a queue reader stops offering. */
export type CrewCardBuildState =
  | {
    readonly kind: "pull-request";
    readonly pullRequest: number;
    /**
     * `gate` — in the gate; `review` — held for the relay's hand verdict;
     * `passed` — the verdict is on the current head and it is queued to merge;
     * `draft` — not finished.
     */
    readonly stage: "gate" | "review" | "passed" | "finding" | "draft";
  }
  | { readonly kind: "claimed"; readonly seat: string | null; readonly at: string }
  /**
   * ⚠ **`at` IS NULLABLE BECAUSE A LABEL HAS NO TIMESTAMP ANY READER HERE CAN
   * SEE (#1337).** GitHub's search API and `gh issue list` both hand back a
   * card's labels and neither says when one was applied; the timeline call that
   * would is one request per card. So a refusal read off the label answers
   * `null` and a refusal read off a comment keeps its time. Nothing draws the
   * time — `crewCardBuildPhrase` says *"the reason is on the card"* either way —
   * and the ORDER the judgement applies is stated at `crewCardBuildState`
   * rather than left to a date that does not exist.
   */
  | { readonly kind: "refused"; readonly at: string | null };

/**
 * THE LABEL A REFUSAL LIVES ON — his word, 2026-09-29 (Crew reply #237), on the
 * question *"when a shift reads a card and decides it should not be built,
 * should that card stay open with a mark on it, or close?"*, verbatim and
 * entire: **A**.
 *
 * So a refused card STAYS OPEN, keeps its work label, and carries this one. It
 * is the permanent, indexable home a refusal never had: before #1337 a refusal
 * was a COMMENT, and the reader that finds it (`server/crew/cardActivity.ts`)
 * pages a window — so **a refusal older than that window and never re-commented
 * was invisible, and the card read as ordinary untouched work.** A label costs
 * nothing to read and never ages out, which is the whole of the repair.
 *
 * ⚠ **APPLYING IT NEITHER CLOSES THE CARD NOR STRIPS ITS WORK LABEL.** That was
 * option B, which he did not choose: a refusal is a shift's READING and readings
 * are overturned here (two of #1337's own siblings were re-opened on his word).
 * `buildStateHoldsOffOffer` therefore still returns `false` for a refusal — the
 * card is ANNOTATED and still offered, exactly as it was when the refusal was a
 * comment. What changed is only whether the annotation can be SEEN.
 */
export const CREW_NOT_BUILT_LABEL = "not-built";

/** Does this card's label list carry the refusal mark? One spelling, one owner. */
export function isNotBuiltLabelled(labels: readonly string[] | null | undefined): boolean {
  return Array.isArray(labels) && labels.includes(CREW_NOT_BUILT_LABEL);
}

/**
 * THE REFUSED CARDS IN A LIST OF ROWS — for the caller that already holds the
 * labels (his page reads them off the same search that gives it the cards).
 *
 * Written to take the raw shape both `gh issue list --json number,labels` and
 * the Desk's live reading carry, so no caller shapes it and two callers cannot
 * shape it differently.
 */
export function notBuiltCards(
  rows: readonly { readonly number?: unknown; readonly labels?: readonly string[] | null }[],
): Set<number> {
  const cards = new Set<number>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.number) || (row.number as number) <= 0) continue;
    if (isNotBuiltLabelled(row.labels)) cards.add(row.number as number);
  }
  return cards;
}

/** One card's phrase, as it travels to his page. */
export type CrewCardBuildView = {
  readonly issueNumber: number;
  readonly phrase: string;
};

/** A pull request as any caller of this module can describe one. */
export interface CrewBuildPullRequest {
  readonly number: number;
  readonly title?: string | null;
  readonly body?: string | null;
  /** Absent from GitHub's search API; present in `gh pr list`. */
  readonly headRefName?: string | null;
  readonly draft?: boolean;
  readonly labels?: readonly string[];
  /**
   * WHETHER THE RELAY'S VERDICT IS ON THIS PULL REQUEST'S CURRENT HEAD.
   *
   * ⚠ **IT IS DATA HERE, NOT A READING — AND THE READER IS `shared/handVerdict.ts`.**
   * His desk asked for it on 2026-09-26: a pull request that has already been
   * reviewed and is merely queued to merge was reading *"waiting on review"*, so
   * the two states a person actually cares about looked identical. A verdict is a
   * COMMENT (`**Fable review — by hand`, by the founder's account) rather than a
   * label, so it is the caller — the one holding the comment listing — that
   * establishes this, through `handVerdictFreshness`.
   *
   * Absent means *nobody looked*, and it reads exactly as it did before this
   * field existed: the review label decides, and `gate` otherwise. A missing
   * field cannot invent a pass.
   */
  readonly handVerdict?: HandVerdictFreshness;
}

/** A PR carrying either waits for the relay's hand verdict before it can merge. */
export const CREW_REVIEW_PR_LABELS: readonly string[] = ["needs-fable", "founder-review"];

/**
 * WHERE A PULL REQUEST SAYS WHICH CARD IT BUILDS — the narrow read, per the
 * header. An empty list means this pull request does not claim this card, and
 * a body that merely cites it is an empty list.
 */
export function pullRequestBuildsCard(
  pr: CrewBuildPullRequest,
  card: number,
): CardPullRequestWhere[] {
  if (!Number.isSafeInteger(card) || card <= 0) return [];
  const token = cardNumberToken(card);
  const where: CardPullRequestWhere[] = [];
  if (typeof pr.title === "string" && token.test(pr.title)) where.push("title");
  /* `card #N` / `cards #N` — the brief's own sentence, not a bare `#N`. */
  if (typeof pr.body === "string"
    && new RegExp(`\\bcards?\\s+#0*${card}([^0-9]|$)`, "i").test(pr.body)) {
    where.push("body");
  }
  /* The branch's digit RUNS, `findCardPullRequests`' rule — a run that IS the
     number, never a number a longer run merely contains. */
  if (typeof pr.headRefName === "string"
    && (pr.headRefName.match(/\d+/g) ?? []).some((run) => Number(run) === card)) {
    where.push("branch");
  }
  return where;
}

/**
 * ⚠ **THE ORDER IS THE DESIGN.** A draft is first because an unfinished pull
 * request is unfinished whatever else is true of it. A FRESH VERDICT then
 * outranks the review label, and that is the whole of the 2026-09-26 desk
 * correction: the label says *somebody owes this a look*, the verdict says
 * *somebody looked*, and a label nobody removed after a verdict was making a
 * reviewed pull request read as still waiting. A STALE verdict is not a verdict
 * for this purpose — the head moved under it — so it falls through to the label.
 */
function prStage(pr: CrewBuildPullRequest): "gate" | "review" | "passed" | "finding" | "draft" {
  if (pr.draft === true) return "draft";
  /* ⚠ **A FINDING OUTRANKS EVERYTHING BELOW IT (#1673).** It is the one state
     on this row that means somebody must go and do something, and for six hours
     on 2026-10-01 it was drawn as *passed and merging*. */
  if (pr.handVerdict === "finding") return "finding";
  if (pr.handVerdict === "fresh") return "passed";
  if ((pr.labels ?? []).some((label) => CREW_REVIEW_PR_LABELS.includes(label))) return "review";
  return "gate";
}

/**
 * A comment on a card, as either caller has it: GitHub's REST listing
 * (`issues/comments`) and `gh api` hand back the same three fields.
 */
export interface CrewCardComment {
  readonly card: number;
  readonly body: string;
  readonly createdAt: string;
  /**
   * The commenter's GitHub login, when the caller has it, and the OWNER's — the
   * one account whose comments can be a verdict. Both absent means this reader
   * simply never reports a verdict, which is how it behaved before the field
   * existed.
   */
  readonly authorLogin?: string | null;
  readonly ownerLogin?: string | null;
}

/**
 * ⚠ **THREE OF THESE ARE ABOUT A CARD AND THE FOURTH IS ABOUT A PULL REQUEST.**
 * GitHub gives issues and pull requests ONE number sequence, and its comment
 * listing gives both through the same `issue_url`, so `card` is whatever number
 * the comment hangs on. A `verdict` therefore names a PULL REQUEST, never a
 * card, and `crewCardBuildState` below is explicit about ignoring it — a
 * judgement that swept it in with the rest would read *"a verdict is the newest
 * thing on this card"* and answer nothing at all.
 */
export type CrewCardCommentFact =
  | { readonly kind: "claim"; readonly card: number; readonly seat: string | null; readonly at: string }
  | { readonly kind: "release"; readonly card: number; readonly at: string }
  | { readonly kind: "refusal"; readonly card: number; readonly at: string }
  | { readonly kind: "verdict"; readonly card: number; readonly at: string }
  /**
   * ⚠ **THE RELAY READ IT AND SOMETHING IS WRONG (#1673)** — like `verdict`,
   * this names a PULL REQUEST rather than a card, and `crewCardBuildState`
   * ignores it for the same reason.
   */
  | { readonly kind: "finding"; readonly card: number; readonly at: string };

/*
  Anchored at the start of a LINE, through at most a little markdown emphasis —
  a seat writes `CLAIMED — seat-desk-2, <time>` bare and the relay sometimes
  bolds it. A mention of the word mid-paragraph is NOT a claim: every one of
  this card's own comments discusses claiming at length and none of them is one.

  ⚠ **IT WAS ANCHORED AT THE START OF THE WHOLE BODY UNTIL #1559, AND THAT
  FAILED TOWARD SILENCE.** None of these carried the `m` flag, so `^` meant the
  first character of the comment — a release written on its own line under a
  heading was invisible, and **#180 read as `claimed` for twelve hours after it
  had been handed back**, with every seat pass stepping over it. The shift had
  done exactly what the standing orders ask.

  ⚠ **PER-LINE WAS MEASURED BEFORE IT WAS CHOSEN, because the two ways to be
  wrong here are not symmetric**: a missed release idles a seat, a FALSE release
  cancels a live claim and two seats build the same card. Driven over 84 real
  comments on twelve cards that discuss claiming and releasing at length, the
  per-line reading found **three releases the body anchor missed** (#180 twice,
  #1492 once — a third instance the card that ordered this did not know about)
  and **not one extra claim**. That is a floor and not a proof, which is why the
  negative control stays: prose about releasing is still not a release.

  The block decoration a line may wear — `>`, `#`, a bullet — is stripped once
  by `shared/crewMarkdownLead.ts`, so this `LEAD` only has to allow the INLINE
  emphasis it always allowed. It must not allow more: the hold marker in
  `crewNextUpHold.ts` begins with `**` literally, and a shared stripper that ate
  leading asterisks would turn that silence into a different one.
*/
const LEAD = String.raw`^[\s*_⚠]*`;
const DASH = String.raw`[—–-]`;
const CLAIM_RE = new RegExp(`${LEAD}CLAIMED\\s*${DASH}\\s*([^,\\n*]*)`, "i");
const RELEASE_RE = new RegExp(`${LEAD}RELEASED\\b`, "i");
const REFUSAL_RE = new RegExp(`${LEAD}(?:NOT BUILT|NOT TAKEN)\\b`, "i");

/** One comment → one fact, or `null` when it is ordinary prose. */
export function crewCardCommentFact(comment: CrewCardComment): CrewCardCommentFact | null {
  const { card, body, createdAt } = comment;
  if (!Number.isSafeInteger(card) || card <= 0 || typeof body !== "string" || createdAt === "") return null;
  /* ⚠ THE VERDICT IS READ FIRST AND IT IS AUTHOR-GATED. `isHandVerdict` is the
     merge tool's own test (`shared/handVerdict.ts`, re-exported by
     `scripts/lib/reviewRounds.mts`), and the author check is the same floor
     `classifyComment` applies: a comment by any other account is not a verdict
     whatever it says. A caller that cannot supply the two logins reports no
     verdict at all rather than believing a body. */
  /* ⚠ THE FINDING IS ASKED FIRST (#1673). `isHandVerdict` already refuses a
     finding wearing the verdict's marker, so the order cannot change the
     answer — it is here so that a reader of this function sees the two kinds
     side by side rather than discovering the second inside a predicate. */
  if (isHandFinding(body) || isHandVerdict(body)) {
    const author = comment.authorLogin;
    const owner = comment.ownerLogin;
    if (typeof author === "string" && typeof owner === "string" && owner !== "" && author === owner) {
      return { kind: isHandFinding(body) ? "finding" : "verdict", card, at: createdAt };
    }
    return null;
  }
  /* One pass over the body's BLOCK-OPENING lines, decoration stripped — the
     single population all three matchers read, so none of them can quietly
     disagree about what a line is. Precedence is unchanged: refusal, then
     release, then claim.

     ⚠ Block-opening rather than every line, and a negative control is why: a
     hard-wrapped paragraph can put RELEASED at the start of its second line,
     and a false release cancels a live claim. See `blockOpeningLines`. */
  const lines = blockOpeningLines(body);
  if (lines.some((line) => REFUSAL_RE.test(line))) return { kind: "refusal", card, at: createdAt };
  if (lines.some((line) => RELEASE_RE.test(line))) return { kind: "release", card, at: createdAt };
  const claim = lines.reduce<RegExpMatchArray | null>((found, line) => found ?? line.match(CLAIM_RE), null);
  if (claim) {
    const seat = (claim[1] ?? "").trim();
    return { kind: "claim", card, seat: seat === "" ? null : seat.slice(0, 60), at: createdAt };
  }
  return null;
}

/**
 * HAS THIS PULL REQUEST BEEN REVIEWED? — the one place the two facts are put
 * together, so the Desk and the queue readers cannot answer it differently.
 *
 * The verdict comes from the comment listing (a `verdict` fact, author-gated);
 * the clock comes from the pull request's own `updatedAt`. `shared/handVerdict.ts`
 * owns what the two mean together, including why that clock is the bound a
 * caller which cannot afford a per-pull-request commit read must use.
 */
export function handVerdictForPullRequest(input: {
  readonly pullRequest: number;
  readonly updatedAt: string | null | undefined;
  readonly facts: readonly CrewCardCommentFact[];
}): HandVerdictFreshness {
  /* ⚠ **THE NEWEST HAND COMMENT OF EITHER KIND, NOT THE NEWEST VERDICT
     (#1673).** Filtering to verdicts alone is what let PR #1649's finding be
     invisible here: a later finding would have been stepped over and an earlier
     verdict would still have read *passed and merging*. The merge tool's
     `reviewPresence` resolves the same order against the head commit; this one
     resolves it against the pull request's own clock, for the reason
     `handVerdictFreshness` states. */
  const newest = input.facts
    .filter((fact) => (fact.kind === "verdict" || fact.kind === "finding") && fact.card === input.pullRequest)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const freshness = handVerdictFreshness({ verdictAt: newest?.at ?? null, activityAt: input.updatedAt });
  /* A STALE finding is the repair already pushed — it holds nothing, and the row
     goes back to waiting on review, which is what `stale` already means here. */
  if (newest?.kind === "finding" && freshness === "fresh") return "finding";
  return freshness;
}

/**
 * THE ONE JUDGEMENT — what is happening to this card right now, or `null` when
 * nothing is.
 *
 * ⚠ **THE ORDER IS THE WHOLE DESIGN AND IT IS NOT A PREFERENCE.** A pull
 * request outranks every comment because it is the only artifact that cannot be
 * stale: it is open right now. Under it, the NEWEST of the card's own comments
 * wins, so a seat that claimed a card at 00:18 and refused it at 00:21 (#1217,
 * measured) reads as refused rather than as being built, and a card released
 * back reads as free.
 *
 * A claim older than `CREW_CLAIM_LIVE_MS` is not live and returns nothing —
 * the same twelve hours a seat applies before it takes a claimed card.
 *
 * # ⚠ WHERE THE `not-built` LABEL SITS IN THAT ORDER, AND WHY IT IS LAST (#1337)
 *
 * The label is TIMELESS — no reader here can date it (see `CREW_NOT_BUILT_LABEL`)
 * — so it cannot take part in the newest-wins sort above, and smuggling it in as
 * a dated fact would mean inventing a time and then ranking on the invention.
 * Instead it is the answer the judgement falls back to when no comment of the
 * card's own is currently saying something louder. Read in order:
 *
 *  1. an open pull request — the artifact that cannot be stale;
 *  2. the newest comment fact, when it is a REFUSAL or a LIVE CLAIM. **A live
 *     claim outranks the label deliberately**: the label says *a shift once
 *     judged this not worth building*, and a claim says *somebody's hands are on
 *     it right now*, which is the fact that stops a second seat rebuilding it;
 *  3. the label;
 *  4. nothing.
 *
 * So a RELEASE or a STALE claim falls through to the label rather than erasing
 * it — and that is the whole point of a mark that does not age out. Before this
 * card those two cases answered `null`, i.e. *ordinary untouched work*, over a
 * card a shift had read and refused.
 */
export function crewCardBuildState(input: {
  readonly card: number;
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly nowMs: number;
  /**
   * The cards carrying `CREW_NOT_BUILT_LABEL`. ⚠ **ABSENT MEANS THE LABELS WERE
   * NOT READ, NOT THAT NOTHING IS REFUSED** — a caller that cannot see them
   * behaves exactly as every caller did before #1337, which is the direction
   * this whole family fails in: a card may read as free, never as taken.
   */
  readonly notBuilt?: ReadonlySet<number>;
}): CrewCardBuildState | null {
  const { card, openPullRequests, facts, nowMs } = input;
  const labelled = input.notBuilt?.has(card) === true;
  const building = openPullRequests
    .filter((pr) => pullRequestBuildsCard(pr, card).length > 0)
    /* The lowest number, so a card with a replacement PR and its predecessor
       still open names one of them deterministically. */
    .sort((a, b) => a.number - b.number);
  const pr = building[0];
  if (pr !== undefined) {
    return { kind: "pull-request", pullRequest: pr.number, stage: prStage(pr) };
  }
  const mine = facts
    /* ⚠ A `verdict` NAMES A PULL REQUEST, NOT A CARD, so it is filtered out
       here rather than sorted with the rest — see the vocabulary's own note.
       Its consumer is `prStage` above, through the caller that dates it. */
    .filter((fact): fact is Exclude<CrewCardCommentFact, { kind: "verdict" }> =>
      fact.card === card && fact.kind !== "verdict")
    .sort((a, b) => b.at.localeCompare(a.at));
  const latest = mine[0];
  if (latest !== undefined) {
    if (latest.kind === "refusal") return { kind: "refused", at: latest.at };
    if (latest.kind === "claim") {
      const atMs = Date.parse(latest.at);
      if (Number.isFinite(atMs) && nowMs - atMs <= CREW_CLAIM_LIVE_MS) {
        return { kind: "claimed", seat: latest.seat, at: latest.at };
      }
    }
    /* A release, or a claim that has aged out — both fall through to the label,
       per the order in the docblock. Neither erases a refusal nobody withdrew. */
  }
  if (labelled) return { kind: "refused", at: null };
  return null;
}

/**
 * IS THIS CARD STILL ON OFFER? — the ONE owner of that verdict (#1094 piece 2).
 *
 * His order, 2026-09-26 (terminal), verbatim: *"work on 1094 and 1307 next so
 * the desk shows whats built"*, and the re-scope it settled: **a card that has
 * an open PR, a recorded refusal, or a live claim is not on offer.** The Desk
 * only had to SAY the state; the five queue readers have to ACT on it, and the
 * predicate they act on lives here beside the judgement rather than being
 * re-decided in each of them (working law 4 — five copies of "which states mean
 * hands off" is exactly the second list that drifts).
 *
 * ⚠ **TWO OF THE THREE STATES WITHHOLD, AND THE THIRD ONE DELIBERATELY DOES
 * NOT.** An open pull request and a live claim are somebody's hands on the work
 * *right now* — offering the card spends a session rebuilding it, which is the
 * whole cost #1083 and this card measured. A REFUSAL is not that: it is a
 * shift's JUDGEMENT that the card's premise is wrong against the code (the
 * builder-seat rule of 2026-09-26 — *"a card whose premise is wrong against the
 * code is refused with file:line on the card, not built"*), and a judgement is
 * a thing the next reader may legitimately overturn. Withholding on it would
 * let one shift's refusal retire a card of his silently, with no label, no
 * ruling and nothing on his desk — and #1337 is open precisely because a
 * refusal has no permanent home yet. So a refused card is ANNOTATED with its
 * phrase and still offered: the next shift reads *"not built — the reason is on
 * the card"*, opens the card, and decides.
 *
 * That is also the direction #1083 ruled: never silently withhold work a shift
 * could do. What changed under his order is that an open PR and a live claim
 * stopped being warnings and became facts — *built is built* — and those two
 * are the only ones.
 */
export function buildStateHoldsOffOffer(state: CrewCardBuildState | null): boolean {
  if (state === null) return false;
  return state.kind === "pull-request" || state.kind === "claimed";
}

/** "3 h ago" — whole hours, and the first one says so in words. */
function sinceWord(at: string, nowMs: number): string {
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs)) return "";
  const hours = Math.floor(Math.max(0, nowMs - atMs) / 3_600_000);
  return hours < 1 ? "under an hour ago" : `${hours} h ago`;
}

/**
 * THE PHRASE HIS PAGE DRAWS — one short line in his own words, never a badge
 * and never a term of art from the pipeline. "PR" is the page's existing
 * vocabulary (his *In flight* card names pull requests by number already), so
 * it is the one abbreviation here.
 */
export function crewCardBuildPhrase(state: CrewCardBuildState, nowMs: number): string {
  switch (state.kind) {
    case "pull-request":
      switch (state.stage) {
        case "draft":
          return `being written — PR #${state.pullRequest}`;
        /* His words for this row are "passed" and "merging" (the #1094 re-scope's
           own `PR #n passed — merging`); the shape stays the family's, with the
           pull request last, so eight rows read down the page as one thing. */
        case "passed":
          return `passed and merging — PR #${state.pullRequest}`;
        /* ⚠ The one phrase on this list that names WORK OWED rather than a
           state to wait out, and #1673 is why it exists: the board said *passed
           and merging* over a held pull request from 23:46Z to 05:48Z while
           every P1 card behind it waited. */
        case "finding":
          return `held on the relay's finding — repair owed — PR #${state.pullRequest}`;
        case "review":
          return `waiting on review — PR #${state.pullRequest}`;
        case "gate":
          return `being built — PR #${state.pullRequest}`;
      }
    case "refused":
      return "not built — the reason is on the card";
    case "claimed": {
      const since = sinceWord(state.at, nowMs);
      return state.seat === null
        ? `claimed ${since}`
        : `claimed by ${state.seat}, ${since}`;
    }
  }
}

/** The phrase for each card that has one — the shape that travels to the page. */
export function crewCardBuildViews(input: {
  readonly cards: readonly number[];
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly nowMs: number;
  /** Spread straight into the judgement — see `crewCardBuildState`. */
  readonly notBuilt?: ReadonlySet<number>;
}): CrewCardBuildView[] {
  const views: CrewCardBuildView[] = [];
  for (const card of input.cards) {
    const state = crewCardBuildState({ ...input, card });
    if (state === null) continue;
    views.push({ issueNumber: card, phrase: crewCardBuildPhrase(state, input.nowMs) });
  }
  return views.sort((a, b) => a.issueNumber - b.issueNumber);
}

/** The page looks a row's phrase up by card number. */
export function indexCardBuilds(
  views: readonly CrewCardBuildView[],
): ReadonlyMap<number, string> {
  return new Map(views.map((view) => [view.issueNumber, view.phrase]));
}
