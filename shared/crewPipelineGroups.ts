/**
 * THE WHOLE PIPELINE ON ONE PANEL — the groups that are VISIBLE and never
 * switchable (issue #325).
 *
 * Founder, 2026-08-31: *"all those other ones should be put them under
 * additional categories so i can see the full pipeline like all 97?"* — then
 * **"yes"** to the shape on the card.
 *
 * Measured the hour this was built, at the queue rather than at the card:
 * **100 open · 29 reached by a switch label · 71 reached by nothing.** So the
 * switch panel he looks at from bed could see under a third of his own
 * pipeline, and the other seventy-one were not merely uncounted — they were
 * invisible, with no way to ask why.
 *
 * # ⚠ VISIBILITY AND SWITCHABILITY ARE NOT THE SAME, AND MERGING THEM WOULD
 * BREAK HIS OWN LAW
 *
 * His card says it outright and it is the reason this file is separate from
 * `shared/crewWorkSwitches.ts` rather than five more rows in it:
 * `design-unbuilt` and `roadmap` are **feature work**, and `PROGRAM.md`'s
 * founder law is *"the team NEVER selects the next feature. Ever."* A switch
 * on either of those categories is that law with a toggle attached.
 *
 * **Nothing in this file is switchable.** There is no key here the mutation
 * accepts, no row in `crew_work_switches` these can ever write, and
 * `server/crewPipelineGroups.test.ts` asserts the two vocabularies are
 * disjoint — because the way this feature goes wrong is by growing a switch.
 *
 * # ⚠ THE GROUPS PARTITION. EVERY OPEN CARD IS IN EXACTLY ONE
 *
 * His bar: *"All 97 open cards are reachable on the panel; the counts sum to
 * the real total."* A count that does not sum is worse than no count — this
 * studio has measured that overlapping boxes double-count and fired a court's
 * own arm on it.
 *
 * So `pipelineGroupFor` is FIRST MATCH WINS over the order below, exactly as
 * `exclusionFor` already works, and a card carrying `debt` + `parked` lands in
 * `parked` once rather than in both. The last two groups exist to make the
 * partition TOTAL:
 *
 * - **`other`** — carries labels, but none this vocabulary names. Today it
 *   holds three cards labelled only `urgent`. It must exist, or a label
 *   invented in GitHub tomorrow makes cards silently vanish from his page,
 *   which is the exact failure this card was filed about one layer up.
 * - **`unfiled`** — no label at all. Today four. His card names these as *"their
 *   own small defect"* and asks for them to be triaged into one.
 *
 * # WHY `switched` IS A GROUP AND NOT A SUBTRACTION
 *
 * The first group is the cards the switches above already reach. It is not
 * drawn as a group in zone 2 — it is what makes the arithmetic on his page
 * DERIVED rather than asserted: the panel prints the sum of every row here and
 * that sum is the real total open. The alternative was adding the switch
 * counts, and those carry #324's exclusions, so they do not sum to the union
 * (today 30 against 29 — one card carries two seat labels). Two numbers that
 * disagree by one, on the panel built because he could not tell a broken
 * counter from a real zero, is not a rounding matter.
 *
 * # THE REASON LINE IS THE PRODUCT
 *
 * His card: *"He then sees all 97 and, more usefully, WHY 71 are not offered.
 * That is the honest answer."* Every group carries one, and the test asserts
 * every group has one — a group that appeared without a reason would read as an
 * oversight rather than as a decision.
 */

/**
 * The five labels the switch panel reaches (`shared/crewWorkSwitches.ts`'s
 * `queueLabel`s), named here so the `switched` group is DERIVED from that
 * vocabulary rather than retyped beside it (working law 4).
 *
 * ⚠ Imported rather than copied on purpose: a sixth switch category added
 * there and forgotten here would make `switched` too small and every other
 * group too big, and the sum would still be right — a silent wrong answer.
 */
import { CREW_WORK_CATEGORIES } from "./crewWorkSwitches.js";

const SWITCH_LABELS: readonly string[] = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);

/**
 * The stored key's prefix.
 *
 * ⚠ **Group rows share `crew_queue_counts` with the switch counts**, which is
 * what makes this whole feature a row and a line rather than a migration and a
 * founder ceremony — `shared/crewWorkSwitches.ts`'s own header promises that,
 * and #324's exclusions vocabulary was built on the same promise. The prefix is
 * how the two populations stay apart in one table: the projection filters each
 * side to its own vocabulary, so neither can ever read the other's rows as its
 * own.
 *
 * `varchar(32)` is the column. The longest key below is `group:lost-and-found`
 * at 21, and `crewPipelineGroups.test.ts` measures every key against 32 rather
 * than trusting that sentence to stay true when a group is added.
 */
export const PIPELINE_GROUP_KEY_PREFIX = "group:";

/** The stored `categoryKey` for one group. */
export function pipelineGroupRowKey(key: string): string {
  return `${PIPELINE_GROUP_KEY_PREFIX}${key}`;
}

export type CrewPipelineGroup = {
  /** The group's own key — the stored row is this with the prefix on it. */
  readonly key: string;
  /** The words on his page. */
  readonly label: string;
  /**
   * The queue label that puts a card here, or `null` for the three groups that
   * are defined by something other than one label: `switched` (any of five),
   * `other` (a label we do not name) and `unfiled` (no label at all).
   */
  readonly queueLabel: string | null;
  /** Why it is not on offer. One line, his page reads it under the count. */
  readonly blurb: string;
};

/**
 * ⚠ **ORDER IS MEANING HERE, NOT PRESENTATION.** First match wins, so a card
 * carrying two of these labels is filed under whichever comes first — and that
 * choice is what his page will say about it.
 *
 * Seven of these are his card's own list, verbatim in wording and in order of
 * concern. **Five were added to make the partition total**, and each is named
 * on the PR so he can strike any of them:
 *
 * - `switched` — the arithmetic, above.
 * - `ordered` — his own cards. It is FIRST for `exclusionFor`'s stated reason:
 *   what he needs to know about a card he queued is that HE queued it, not
 *   that it is also blocked or also debt. Today it takes `#267` and `#302`,
 *   which carry `blocked` too.
 * - `scope`, `toolbelt`, `patrol` — three small populations his card's own
 *   table enumerates (*"2 blocked · 2 toolbelt · 1 patrol · 3 scope-change"*)
 *   but his group list did not carry down.
 * - `other` — the remainder, above.
 */
export const CREW_PIPELINE_GROUPS: readonly CrewPipelineGroup[] = [
  {
    key: "switched",
    label: "On offer above",
    queueLabel: null,
    blurb: "Reached by the switches above — this is the only group that is switchable.",
  },
  {
    key: "ordered",
    label: "Queued by you",
    queueLabel: "founder-ordered",
    blurb: "You asked for these by name — they are in NEXT UP and taken first.",
  },
  {
    key: "blocked",
    label: "Blocked",
    queueLabel: "blocked",
    blurb: "Waiting on something the card names.",
  },
  {
    key: "parked",
    label: "Parked",
    queueLabel: "parked",
    blurb: "Stopped on your own ruling — the card names which.",
  },
  {
    key: "design-unbuilt",
    label: "Design, unbuilt",
    queueLabel: "design-unbuilt",
    blurb: "Feature work. The team never selects the next feature — this one is yours.",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    queueLabel: "roadmap",
    blurb: "Sequenced work — it waits for its rung on the ladder.",
  },
  {
    key: "debt",
    label: "Debt",
    queueLabel: "debt",
    blurb: "Carded cleanup — it needs your word because the scope varies.",
  },
  {
    key: "lost-and-found",
    label: "Lost and found",
    queueLabel: "lost-and-found",
    blurb: "Catalogued intentions, not a queue — things found while doing something else.",
  },
  {
    key: "scope-change",
    label: "Scope changes",
    queueLabel: "scope-change",
    blurb: "A change to what we agreed we are building — yours to rule on.",
  },
  {
    key: "toolbelt",
    label: "Toolbelt",
    queueLabel: "toolbelt",
    blurb: "The team's own tools — nothing a customer sees.",
  },
  {
    key: "patrol",
    label: "Patrols",
    queueLabel: "patrol",
    blurb: "A seat's standing round — it runs on its own clock, not on a switch.",
  },
  {
    key: "other",
    label: "Other",
    queueLabel: null,
    blurb: "Labelled, but with nothing this panel names — worth a look, they may want a category.",
  },
  {
    key: "unfiled",
    label: "Unfiled",
    queueLabel: null,
    blurb: "No label at all — nobody can find these, and they want triaging.",
  },
] as const;

/**
 * The group that is arithmetic rather than a group — drawn nowhere in zone 2,
 * counted in the total.
 */
export const PIPELINE_SWITCHED_KEY = "switched";

/**
 * The groups his page actually DRAWS, which is every one except the arithmetic.
 *
 * A derived view rather than a second array, because a second array is the one
 * mistake this whole panel keeps being rebuilt to avoid.
 */
export const CREW_PIPELINE_VISIBLE_GROUPS: readonly CrewPipelineGroup[] =
  CREW_PIPELINE_GROUPS.filter((group) => group.key !== PIPELINE_SWITCHED_KEY);

/**
 * Which group one open card belongs to — exactly one, always.
 *
 * ⚠ **THIS FUNCTION IS THE PARTITION**, and it is total by construction: a card
 * that matches nothing falls to `other` if it has any label and `unfiled` if it
 * has none. There is no path that returns nothing, which is what lets the
 * counts sum to the real total instead of nearly to it.
 *
 * Takes the raw label-name list a `gh issue list --json labels` row carries, so
 * the caller does no shaping and cannot shape it differently from the next
 * caller — `exclusionFor`'s own contract, for the same reason.
 */
export function pipelineGroupFor(labels: readonly string[]): string {
  /* The switches first: a card the panel above already reaches is answered,
     whatever else it carries. Anything else here would show him one card in two
     places and make the total larger than the queue. */
  if (labels.some((name) => SWITCH_LABELS.includes(name))) return PIPELINE_SWITCHED_KEY;
  for (const group of CREW_PIPELINE_GROUPS) {
    if (group.queueLabel !== null && labels.includes(group.queueLabel)) return group.key;
  }
  return labels.length === 0 ? "unfiled" : "other";
}
