/**
 * WHICH BRIEFING IS ON HIS PAGE? — and it is not the one in your working tree
 * (#221 §4, found the night a deploy failed).
 *
 * `crew-read-replies.mts` is the ONE tool a shift reads the founder with, and
 * it took two facts out of `server/crew/crew-briefing.json` **as the working
 * tree holds it**: the edition it prints, and the acknowledgement set that
 * decides which replies are NEW. Both were read as facts about production, by
 * two shifts and by issue #221's own repair list (*"crew-read-replies.mts
 * prints the live edition"*). On 2026-08-29 the tree said edition 93 while
 * production served 92 — deployment `465bb66c` built its image and never
 * started a container — so the tool printed a number that was true of nobody.
 *
 * The label was the visible half. The dangerous half is the acknowledgement
 * set, because this file's own contract is that **a reply is seen when the
 * team's own next deploy proves it was read** — so the authority is the
 * DEPLOYED briefing, by that sentence, and the tree is simply the wrong
 * source. The hole it opens is the design's forbidden vanishing: shift A
 * acknowledges reply #26 in edition N, the deploy fails, shift B reads the
 * tree, sees #26 acknowledged, prints "No new replies" — while his page, still
 * on N-1, says "Not read yet". It has never fired; a failed deploy is exactly
 * the condition that opens it, and one had just happened.
 *
 * So the deployed commit is read from Railway's own listing and the briefing
 * is taken AT THAT COMMIT (`git show <sha>:<path>`) — the same
 * bytes-at-a-commit discipline `briefingConformance.mts` uses for the push.
 *
 * # IT NEVER REFUSES, AND IT NEVER SILENTLY SUBSTITUTES
 *
 * Every road that cannot establish the deployed briefing falls back to the
 * tree and SAYS which road it took (`why`). A shift-start tool that dies
 * because a CLI was slow would cost more than the defect it fixes; a shift-
 * start tool that quietly reports the wrong world is what this repairs. The
 * caller prints `describeSource()` verbatim, so the provenance is on the
 * screen whichever road ran.
 *
 * This is a MODULE — pure, no I/O of its own, no exits. Its readers are
 * injected, so its arms can drive the incident's exact shape.
 */
import type { DeploymentRow } from "./deployWatch.mts";

/** One thing a reply can be addressed to — a needs-you card or an eye item. */
export type BriefingHostRow = { id: string; title: string; state?: string };

/**
 * The two fields a reply read needs, plus the cards it decorates with.
 *
 * ⚠ **`needsYou` ALONE WAS HALF THE NAMESPACE, AND THE HALF HIS VERDICTS
 * MOSTLY LAND ON WAS THE MISSING ONE** (measured 2026-08-29, shift 96).
 * `crewBriefingSchema` states outright that *"needsYou[].id and eyeItems[].id
 * share one reply namespace"* and refuses a collision across both — so the
 * source of truth has always said the namespace is the union, and this type
 * mirrored one arm of it (working law 4). The cost was not cosmetic: of the 17
 * distinct card ids the reply reader labelled *"(not in the current
 * briefing)"*, **17 were in the current briefing** and 0 were genuinely gone,
 * so 20 of his 28 replies printed a sentence telling the shift the card it
 * answered no longer existed. Two eye items he answered on 2026-08-28 (#23,
 * #24, #25) therefore sat `open` on his page for three editions until he said
 * so himself. `eyeItems` is carried here for that reason, and `state` with it
 * — `replyHosts.mts` is what reads them.
 */
export type BriefingFacts = {
  edition: number;
  acknowledgedReplyIds: number[];
  needsYou: BriefingHostRow[];
  eyeItems: BriefingHostRow[];
};

export type BriefingChoice = {
  /** `deployed` — read at the live commit. `tree` — the fallback. */
  kind: "deployed" | "tree";
  /** The briefing whose acknowledgement set and titles the caller must use. */
  facts: BriefingFacts | null;
  /** The commit the deployed briefing was read at, when there is one. */
  sha: string | null;
  /** The working tree's edition, whether or not it is the one being used. */
  treeEdition: number | null;
  /** True when the tree holds an edition the founder cannot see yet. */
  treeAhead: boolean;
  /** Why this road was taken — printed verbatim, never swallowed. */
  why: string;
};

const parseFacts = (json: string): BriefingFacts | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const record = parsed as Partial<BriefingFacts> | null;
  if (!record || typeof record.edition !== "number") return null;
  return {
    edition: record.edition,
    acknowledgedReplyIds: Array.isArray(record.acknowledgedReplyIds) ? record.acknowledgedReplyIds : [],
    needsYou: Array.isArray(record.needsYou) ? record.needsYou : [],
    eyeItems: Array.isArray(record.eyeItems) ? record.eyeItems : [],
  };
};

/**
 * The newest deployment that actually SERVED — not the newest row.
 *
 * Tonight's incident is precisely the difference: `465bb66c` was the newest
 * row and it never ran a container, while `f6653937` (one older, SUCCESS) was
 * the process answering `/api/health`. A FAILED row's commit is not on his
 * page, so it is never adopted here.
 */
export const liveCommit = (rows: DeploymentRow[]): string | null =>
  rows.find((row) => row.status === "SUCCESS" && row.commitHash)?.commitHash ?? null;

/**
 * Choose the briefing to read the founder with.
 *
 * @param rows        Railway's listing for the app service, newest first.
 * @param treeJson    `server/crew/crew-briefing.json` as the tree holds it, or
 *                    null when it could not be read at all.
 * @param showAtCommit  Reads the same path at a commit; null when git cannot
 *                    (a sha this clone does not have, a deleted path).
 */
export function chooseBriefing(
  rows: DeploymentRow[],
  treeJson: string | null,
  showAtCommit: (sha: string) => string | null,
): BriefingChoice {
  const treeFacts = treeJson === null ? null : parseFacts(treeJson);
  const treeEdition = treeFacts?.edition ?? null;
  const fallback = (why: string): BriefingChoice =>
    ({ kind: "tree", facts: treeFacts, sha: null, treeEdition, treeAhead: false, why });

  const sha = liveCommit(rows);
  if (!sha) return fallback("no SUCCESS deployment row carries a commit — Railway could not be read, or nothing has deployed");

  const deployedJson = showAtCommit(sha);
  if (deployedJson === null) return fallback(`the briefing could not be read at ${sha.slice(0, 8)} — this clone may not hold that commit`);

  const deployedFacts = parseFacts(deployedJson);
  if (!deployedFacts) return fallback(`the briefing at ${sha.slice(0, 8)} does not parse`);

  return {
    kind: "deployed",
    facts: deployedFacts,
    sha,
    treeEdition,
    /* AHEAD, never merely DIFFERENT: the tree being behind the live edition is
       an un-pulled clone, which is a different sentence and not this one. */
    treeAhead: treeEdition !== null && treeEdition > deployedFacts.edition,
    why: "read at the newest SUCCESS deployment's commit",
  };
}

/** The one line the caller prints, so the provenance is never inferred. */
export function describeSource(choice: BriefingChoice): string {
  if (choice.kind === "tree") {
    return `⚠ briefing read from the WORKING TREE, not production — ${choice.why}.`
      + " The edition below is what this clone holds; his page may be on an older one.";
  }
  const live = `live briefing: edition ${choice.facts!.edition}, read at ${choice.sha!.slice(0, 8)} (the newest SUCCESS deployment)`;
  if (!choice.treeAhead) return live + ".";
  return `${live}.\n⚠ the working tree is AHEAD — edition ${choice.treeEdition} is committed but NOT on his page.`;
}
