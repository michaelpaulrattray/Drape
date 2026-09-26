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

/** Twelve hours — the standing orders' own window for a live claim. */
export const CREW_CLAIM_LIVE_MS = 12 * 60 * 60 * 1000;

/** What the page draws on a row, and what a queue reader stops offering. */
export type CrewCardBuildState =
  | {
    readonly kind: "pull-request";
    readonly pullRequest: number;
    /** `gate` — in the gate; `review` — held for the relay's hand verdict; `draft` — not finished. */
    readonly stage: "gate" | "review" | "draft";
  }
  | { readonly kind: "claimed"; readonly seat: string | null; readonly at: string }
  | { readonly kind: "refused"; readonly at: string };

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

function prStage(pr: CrewBuildPullRequest): "gate" | "review" | "draft" {
  if (pr.draft === true) return "draft";
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
}

export type CrewCardCommentFact =
  | { readonly kind: "claim"; readonly card: number; readonly seat: string | null; readonly at: string }
  | { readonly kind: "release"; readonly card: number; readonly at: string }
  | { readonly kind: "refusal"; readonly card: number; readonly at: string };

/*
  Anchored at the start of the body, through at most a little markdown
  emphasis — a seat writes `CLAIMED — seat-desk-2, <time>` bare and the relay
  sometimes bolds a heading. A mention of the word anywhere else in a
  paragraph is NOT a claim: every one of this card's own five comments
  discusses claiming at length and none of them is one.
*/
const LEAD = String.raw`^[\s>*_#⚠]*`;
const DASH = String.raw`[—–-]`;
const CLAIM_RE = new RegExp(`${LEAD}CLAIMED\\s*${DASH}\\s*([^,\\n*]*)`, "i");
const RELEASE_RE = new RegExp(`${LEAD}RELEASED\\b`, "i");
const REFUSAL_RE = new RegExp(`${LEAD}(?:NOT BUILT|NOT TAKEN)\\b`, "i");

/** One comment → one fact, or `null` when it is ordinary prose. */
export function crewCardCommentFact(comment: CrewCardComment): CrewCardCommentFact | null {
  const { card, body, createdAt } = comment;
  if (!Number.isSafeInteger(card) || card <= 0 || typeof body !== "string" || createdAt === "") return null;
  const refused = REFUSAL_RE.test(body);
  if (refused) return { kind: "refusal", card, at: createdAt };
  if (RELEASE_RE.test(body)) return { kind: "release", card, at: createdAt };
  const claim = body.match(CLAIM_RE);
  if (claim) {
    const seat = (claim[1] ?? "").trim();
    return { kind: "claim", card, seat: seat === "" ? null : seat.slice(0, 60), at: createdAt };
  }
  return null;
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
 */
export function crewCardBuildState(input: {
  readonly card: number;
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly nowMs: number;
}): CrewCardBuildState | null {
  const { card, openPullRequests, facts, nowMs } = input;
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
    .filter((fact) => fact.card === card)
    .sort((a, b) => b.at.localeCompare(a.at));
  const latest = mine[0];
  if (latest === undefined) return null;
  if (latest.kind === "release") return null;
  if (latest.kind === "refusal") return { kind: "refused", at: latest.at };
  const atMs = Date.parse(latest.at);
  if (!Number.isFinite(atMs) || nowMs - atMs > CREW_CLAIM_LIVE_MS) return null;
  return { kind: "claimed", seat: latest.seat, at: latest.at };
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
      return state.stage === "draft"
        ? `being written — PR #${state.pullRequest}`
        : state.stage === "review"
          ? `waiting on review — PR #${state.pullRequest}`
          : `being built — PR #${state.pullRequest}`;
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
