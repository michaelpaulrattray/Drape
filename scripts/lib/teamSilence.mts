/**
 * WHETHER THE TEAM HAS STOPPED — the one reader that does not need a shift to
 * be running (#2719, Retro recurrence R23).
 *
 * # The outage this answers
 *
 * **The team stopped for six days and nothing anywhere said so.** No pass ran
 * between 2026-10-21 20:18 and 2026-10-27 13:36 local. Four independent
 * readers agree on the boundary — mailbox entry names, runner log names, file
 * mtimes, and merged pull requests (29 in the window, **all 29 merged on 27
 * October**) — and the one artifact he actually reads stood still for ten days:
 * edition 740 landed 17 October, edition 742 landed 27 October.
 *
 * **No rule was broken and no alarm could have fired.** There was no park: the
 * newest `runner-parked-*` notice predates the window, there is no
 * `runner-close-*` inside it, and no `.agents/STOP` was written. The 21 October
 * shift closed its own row and wrote its own entry. That is the finding —
 * **every alarm the team owns keys on work IN FLIGHT**: `CREW_SHIFT_STALL_MS`
 * fires only on an OPEN row, the close-stamp verifies an entry that EXISTS, the
 * park notice describes a park that HAPPENED. Of the twenty readers of
 * `crew_shift_runs`, none asks how old the newest row is.
 *
 * # Why this lives in a scheduled workflow and not in a shift
 *
 * That is the paradox R22 and R23 share and it is the whole reason this file is
 * shaped the way it is: **every reading the team owns is performed BY a shift,
 * and during an outage no shift runs.** So the detector has to sit somewhere
 * the team's own machinery is not — a scheduled GitHub Actions job, which is
 * also the only one of the card's three proposed repairs a seat may build at
 * all. The other two live in `.agents/foreman/foreman-runner.ps1` and
 * `check-wake.ps1`, both UNTRACKED (R18's class, verified with
 * `git ls-files --error-unmatch`), so no seat may ship them and no suite may
 * guard them.
 *
 * # THE HARD PART IS NOT THE SILENCE, IT IS TELLING A PARK FROM A STALL
 *
 * The card names this exactly: the relative age on the newest *Recent shifts*
 * row would have read *"6d ago"* during the outage, **and that reads
 * identically to a quiet weekend.** A detector that raised on silence alone
 * would cry wolf every time the team correctly parked, and an alarm that fires
 * routinely is an alarm nobody reads — which is the state this card is about,
 * arriving by the opposite road.
 *
 * So silence is only half the question. The other half is **whether there was
 * anything to take**, and that is answerable from outside the machine because
 * `founder-ordered` is a LABEL: his ordered band is a queue query, and a card
 * in it is authorised work that is *"not gated on a confirmed focus and NOT
 * gated on the background-work switches"* (`PROGRAM.md`). Silence with an empty
 * band is a park working as designed; silence with takeable work on the board
 * is a team that has stopped.
 *
 * ⚠ **AND "TAKEABLE" IS ASKED OF THE CUT'S OWN OWNER, NEVER RE-DERIVED HERE.**
 * `orderedBandHoldFor` folds all five walls — parked, the hold labels,
 * `research`, the rung gate and the build board — and a narrower rule here
 * would be the mirror working law 4 names, in the direction that matters most:
 * a weaker rule counts held cards as work and raises during a legitimate park.
 * The measured precedent is #1881, where exactly one of the five walls was
 * asked and a heading printed `8 ON OFFER` over a band the cutter held
 * entirely.
 */
import { buildBoard, factsFromRows, type CardBuildBoard } from "./cardBuildState.mts";
import { focusRungFromLadder, orderedBandHoldFor } from "./seatBatches.mts";

/**
 * HOW LONG `main` MAY STAND STILL WITH WORK ON THE BOARD BEFORE IT IS A
 * FINDING.
 *
 * ⚠ **A starting value chosen from measurements, and stated as one** — it is
 * not derived and it is meant to move on evidence rather than on taste. What it
 * was reasoned from:
 *
 *   · a shift's median life is **75 minutes** and its longest measured is
 *     **138** (83 runs), so a single night's cycle is nowhere near this;
 *   · `check-wake.ps1` carries a **six-hour** heartbeat that launches a shift
 *     whatever the signals say, so a healthy runner cannot be quiet for long
 *     with work waiting;
 *   · a shift may legitimately work a card and merge nothing — the relay
 *     merges — so this is deliberately well above the six hours rather than
 *     equal to it;
 *   · the outage it exists to catch was **six days**, so anything under a day
 *     catches it on the first morning.
 *
 * Settable from the environment so tuning it costs no code change, which
 * matters for a number nobody can be sure of until it has been wrong once.
 */
export const TEAM_SILENCE_HOURS = 18;

export type TeamSilenceVerdict =
  /** `main` moved recently enough. Nothing to say. */
  | { kind: "moving"; hoursSilent: number; takeable: number }
  /**
   * Silent past the threshold **and nothing on the board to take** — a park
   * working as designed, which is a correct state and never a finding.
   */
  | { kind: "parked"; hoursSilent: number; takeable: 0 }
  /** Silent past the threshold **with takeable work on the board**. The raise. */
  | { kind: "stopped"; hoursSilent: number; takeable: number }
  /**
   * One of the two facts could not be read, so a park and a stall cannot be
   * told apart.
   *
   * ⚠ **This is NOT folded into `stopped`, and the split is the design.** A
   * detector that raised on its own malfunction would file cards nobody can act
   * on; one that went quiet would reproduce the exact defect it exists to
   * catch. So it does neither: it files nothing and FAILS, which puts a red in
   * the Actions tab without putting a wrong card on the board.
   */
  | { kind: "unreadable"; why: string };

/**
 * The verdict, from two facts and a threshold. Pure, so every arm is drivable
 * without a network, a clock or a repository.
 */
export function judgeTeamSilence(input: {
  nowMs: number;
  /** When `main` last moved, or null if that could not be read. */
  lastCommitMs: number | null;
  /** How many of his ordered cards a seat could start, or null if unknown. */
  takeable: number | null;
  thresholdHours?: number;
}): TeamSilenceVerdict {
  if (input.lastCommitMs === null) {
    return { kind: "unreadable", why: "the newest commit on `main` could not be read" };
  }
  if (input.takeable === null) {
    return {
      kind: "unreadable",
      why: "the ordered band could not be read, so a correct park cannot be told from a stopped team",
    };
  }
  /*
    A COMMIT DATED IN THE FUTURE IS NOT NEGATIVE SILENCE. A committer date is
    whatever the committing clock said, and a skewed one would otherwise make
    `hoursSilent` negative and read as the healthiest possible answer — the
    silent direction, on the one input an outside clock controls.
  */
  const hoursSilent = Math.max(0, (input.nowMs - input.lastCommitMs) / 3_600_000);
  const threshold = input.thresholdHours ?? TEAM_SILENCE_HOURS;
  const rounded = Math.round(hoursSilent * 10) / 10;
  if (hoursSilent < threshold) {
    return { kind: "moving", hoursSilent: rounded, takeable: input.takeable };
  }
  if (input.takeable === 0) return { kind: "parked", hoursSilent: rounded, takeable: 0 };
  return { kind: "stopped", hoursSilent: rounded, takeable: input.takeable };
}

/**
 * The sentence a human reads, and the one the raised card is titled with.
 *
 * Written here rather than in the workflow so the hand run and the scheduled
 * run cannot describe the same state differently — the knip nightly's own rule,
 * one directory over.
 */
export function teamSilenceSentence(verdict: TeamSilenceVerdict): string {
  switch (verdict.kind) {
    case "unreadable":
      return `the team's silence could not be judged — ${verdict.why}`;
    case "moving":
      return `main moved ${verdict.hoursSilent}h ago · ${verdict.takeable} card(s) on offer — the team is running`;
    case "parked":
      return `main has not moved for ${verdict.hoursSilent}h and there is nothing on the board to take — a correct park`;
    case "stopped":
      return `main has not moved for ${verdict.hoursSilent}h while ${verdict.takeable} card(s) are on offer — the team has stopped`;
  }
}

/** The exit code a command should end on. 2 is the finding, as the house uses it. */
export function teamSilenceExitCode(verdict: TeamSilenceVerdict): 0 | 1 | 2 {
  if (verdict.kind === "unreadable") return 1;
  return verdict.kind === "stopped" ? 2 : 0;
}

/** One of his ordered cards, as the band reader needs it. */
export type OrderedCard = { readonly number: number; readonly labels: readonly string[] };

/**
 * HOW MANY OF HIS ORDERED CARDS A SEAT COULD ACTUALLY START.
 *
 * ⚠ **It REFUSES on a partially-read board rather than counting what it has**,
 * which is `cut-seat-batches.mts`'s own behaviour in the same condition and is
 * the direction that matters: an unread build board makes a card somebody is
 * already on look free, so a half-read board would inflate this count and raise
 * on a team that is working perfectly well.
 */
export function takeableOrderedCards(input: {
  cards: readonly OrderedCard[];
  focusRung: string | null;
  board: CardBuildBoard;
}): number | null {
  if (input.board.partial) return null;
  return input.cards.filter(
    (card) => orderedBandHoldFor({ card, focusRung: input.focusRung, board: input.board }) === null,
  ).length;
}

/**
 * Both facts and the verdict, assembled from an injected `gh` runner and the
 * briefing on disk — so the suite drives every road without a network.
 *
 * `gh` is handed in rather than called here for the reason the three readers in
 * `cardBuildState.mts` take it the same way: a reader that opens its own
 * transport cannot be driven against a refusing one, and the refusing arms are
 * the half of this file that matters.
 */
export function readTeamSilence(input: {
  nowMs: number;
  /** Runs `gh` with the given args and returns stdout, or throws. */
  gh: (args: readonly string[]) => string;
  /** The deployed briefing's `program.ladder`, for the rung gate. */
  ladder: readonly { readonly key?: unknown; readonly state?: unknown }[] | null;
  thresholdHours?: number;
}): { verdict: TeamSilenceVerdict; sentence: string } {
  const read = (args: readonly string[]): unknown => {
    try {
      return JSON.parse(input.gh(args));
    } catch {
      return null;
    }
  };

  /*
    WHEN `main` LAST MOVED. The committer date on the tip is the right proxy: a
    squash merge carries the merge time, which is when main actually moved.

    ⚠ **NO `--jq` HERE, AND THAT IS A DRIVEN CORRECTION RATHER THAN A STYLE
    CHOICE.** The first cut asked `--jq .commit.committer.date`, and `gh api`
    prints a jq string result UNQUOTED — so `JSON.parse` threw on a perfectly
    good answer, every road read `unreadable`, and the job would have failed
    every three hours forever while reporting that it could not see the repo.
    Found by running the command against the live repository before the workflow
    existed. One parse path, and the field is read in TypeScript.
  */
  const tip = read(["api", "repos/{owner}/{repo}/commits/main"]);
  const committed = (tip as { commit?: { committer?: { date?: unknown } } } | null)
    ?.commit?.committer?.date;
  const lastCommitMs = typeof committed === "string" && !Number.isNaN(Date.parse(committed))
    ? Date.parse(committed)
    : null;

  const cardRows = read([
    "issue", "list", "--label", "founder-ordered", "--state", "open",
    "--limit", "200", "--json", "number,labels",
  ]);
  const cards: OrderedCard[] | null = Array.isArray(cardRows)
    ? cardRows.map((row) => ({
      number: Number((row as { number?: unknown }).number),
      labels: Array.isArray((row as { labels?: unknown }).labels)
        ? ((row as { labels: unknown[] }).labels)
          .map((label) => String((label as { name?: unknown })?.name ?? ""))
          .filter((name) => name !== "")
        : [],
    }))
    : null;

  const prRows = read(["pr", "list", "--state", "open", "--limit", "100", "--json", "number,title,headRefName,isDraft"]);
  const commentRows = read([
    "issue", "list", "--state", "open", "--limit", "200", "--json", "number,comments",
  ]);
  const notBuiltRows = read(["issue", "list", "--label", "not-built", "--state", "open", "--limit", "200", "--json", "number,labels"]);

  const board = buildBoard({
    openPullRequests: Array.isArray(prRows)
      ? (prRows as Parameters<typeof buildBoard>[0]["openPullRequests"])
      : { unreadable: "`gh pr list` could not be read" },
    /* THROUGH THE OWNER'S OWN FOLD — `factsFromRows`, not a second reading of
       the same rows. A claim's age, its first word and the refusal-outranks-a-
       release rule all live in there (#1701, #2272), and a copy here is the one
       that would miss the next spelling. */
    comments: Array.isArray(commentRows)
      ? factsFromRows(commentRows)
      : { unreadable: "the card comments could not be read, so a live claim cannot be ruled out" },
    notBuilt: Array.isArray(notBuiltRows)
      ? new Set(notBuiltRows.map((row) => Number((row as { number?: unknown }).number)))
      : { unreadable: "the refused cards could not be read" },
    nowMs: input.nowMs,
  });

  const takeable = cards === null
    ? null
    : takeableOrderedCards({ cards, focusRung: focusRungFromLadder(input.ladder), board });

  const verdict = judgeTeamSilence({
    nowMs: input.nowMs,
    lastCommitMs,
    takeable,
    ...(input.thresholdHours === undefined ? {} : { thresholdHours: input.thresholdHours }),
  });
  return { verdict, sentence: teamSilenceSentence(verdict) };
}
