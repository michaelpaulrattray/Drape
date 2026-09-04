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
 * The labels the switch panel reaches (`shared/crewWorkSwitches.ts`'s
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
   * are defined by something other than one label: `switched` (any of the
   * switch vocabulary's `queueLabel`s),
   * `other` (a label we do not name) and `unfiled` (no label at all).
   */
  readonly queueLabel: string | null;
  /** Why it is not on offer. One line, his page reads it under the count. */
  readonly blurb: string;
  /**
   * WHERE THIS GROUP'S CARDS RENDER on his page (#493 — his order: *"why do i
   * need to see qued by me again in the pipeline"*). The one-place rule: every
   * open card appears in exactly ONE section, the one that says what it is
   * waiting on. `here` means the pipeline block itself draws the rows;
   * anything else means the block prints only a count in its quiet
   * elsewhere line, and the named section draws the cards.
   */
  readonly home: "switches" | "next-up" | "ladder" | "here";
  /**
   * The phrase the quiet counts line reads for a group homed elsewhere —
   * completed as `{count} {elsewhere}` — and `null` exactly when the group is
   * homed `here` (the consistency is pinned by `crewPipelineGroups.test.ts`).
   */
  readonly elsewhere: string | null;
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
    home: "switches",
    elsewhere: "on offer above",
  },
  {
    key: "ordered",
    label: "Queued by you",
    queueLabel: "founder-ordered",
    blurb: "You asked for these by name — they are in NEXT UP and taken first.",
    home: "next-up",
    elsewhere: "in NEXT UP",
  },
  {
    key: "blocked",
    label: "Blocked",
    queueLabel: "blocked",
    blurb: "Waiting on something the card names.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "parked",
    label: "Parked",
    queueLabel: "parked",
    blurb: "Stopped on your own ruling — the card names which.",
    home: "ladder",
    elsewhere: "parked",
  },
  {
    key: "design-unbuilt",
    label: "Design, unbuilt",
    queueLabel: "design-unbuilt",
    blurb: "Feature work. The team never selects the next feature — this one is yours.",
    home: "ladder",
    elsewhere: "unbuilt designs",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    queueLabel: "roadmap",
    blurb: "Sequenced work — it waits for its rung on the ladder.",
    home: "ladder",
    elsewhere: "on the ladder",
  },
  {
    key: "debt",
    label: "Debt",
    queueLabel: "debt",
    blurb: "Carded cleanup — it needs your word because the scope varies.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "lost-and-found",
    label: "Lost and found",
    queueLabel: "lost-and-found",
    blurb: "Catalogued intentions, not a queue — things found while doing something else.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "scope-change",
    label: "Scope changes",
    queueLabel: "scope-change",
    blurb: "A change to what we agreed we are building — yours to rule on.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "toolbelt",
    label: "Toolbelt",
    queueLabel: "toolbelt",
    blurb: "The team's own tools — nothing a customer sees.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "patrol",
    label: "Patrols",
    queueLabel: "patrol",
    blurb: "A seat's standing round — it runs on its own clock, not on a switch.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "other",
    label: "Other",
    queueLabel: null,
    blurb: "Labelled, but with nothing this panel names — worth a look, they may want a category.",
    home: "here",
    elsewhere: null,
  },
  {
    key: "unfiled",
    label: "Unfiled",
    queueLabel: null,
    blurb: "No label at all — nobody can find these, and they want triaging.",
    home: "here",
    elsewhere: null,
  },
] as const;

/**
 * The group that is arithmetic rather than a group — drawn nowhere in zone 2,
 * counted in the total.
 */
export const PIPELINE_SWITCHED_KEY = "switched";

/*
 * ⚠ `CREW_PIPELINE_VISIBLE_GROUPS` — "every group except the arithmetic" — was
 * DELETED by #493: the page no longer has a section that draws all eleven, so
 * the view lost its one production consumer the day the doubling was removed.
 * The drawn set is `CREW_PIPELINE_ORPHAN_GROUPS` above; a group's cards render
 * where its `home` says.
 */

/**
 * The groups the pipeline block actually DRAWS — those homed `here` (#493).
 *
 * His order, verbatim: *"the issue i have with the pipeline is its doubling up
 * for exable i can already see my next up so why do i need to see qued by me
 * again in the pipeline"*. So the block lists only the cards NO other section
 * shows — the ones nobody will act on without his word — and everything homed
 * elsewhere appears as one quiet line of counts.
 *
 * ⚠ Derived from `home`, never a second array: the card's own enumeration
 * ("debt, lost-and-found, scope-change, blocked, other, unfiled") omitted
 * `toolbelt` and `patrol`, and dropping them would put a future toolbelt card
 * on NO section of the page — the exact no-place failure #493 exists to
 * prevent. The one-place rule outranks the enumeration, said on the card.
 */
export const CREW_PIPELINE_ORPHAN_GROUPS: readonly CrewPipelineGroup[] =
  CREW_PIPELINE_GROUPS.filter((group) => group.home === "here");

/**
 * The groups whose cards live under the ladder in THE PROGRAM (#493 move 2):
 * `roadmap`, `parked`, `design-unbuilt` — derived from `home`, so a group
 * re-homed later moves its population in one field.
 */
export const CREW_LADDER_GROUP_KEYS: readonly string[] =
  CREW_PIPELINE_GROUPS.filter((group) => group.home === "ladder").map((group) => group.key);

/**
 * THE RUNG LABEL — `rung:N3` places a card under ladder rung N3 (#493).
 *
 * ⚠ **A rung label is TRANSCRIPTION, never sequencing.** It is applied only
 * where the record already names the rung — the founder's word, the card's own
 * title, or the signed rebaseline plan naming the card by number. A shift
 * assigning a rung on its own judgement would be selecting the next feature,
 * which `PROGRAM.md` reserves to him. A card with no rung label renders in the
 * ladder's honest remainder: *on the ladder, rung not yet named.*
 */
export const RUNG_LABEL_PREFIX = "rung:";

/**
 * The rung a card's labels place it on, or `null` for unplaced.
 *
 * Validated against the ladder's OWN keys (the deployed briefing's
 * `program.ladder`), so a typo like `rung:N9` reads as unplaced rather than
 * inventing a rung — the sweep reports it out loud rather than dropping it
 * silently. Two rung labels on one card resolve to the first in ladder order,
 * deterministically.
 */
export function rungFromLabels(
  labels: readonly string[],
  rungKeys: readonly string[],
): string | null {
  const named = new Set(
    labels
      .filter((label) => label.startsWith(RUNG_LABEL_PREFIX))
      .map((label) => label.slice(RUNG_LABEL_PREFIX.length)),
  );
  for (const key of rungKeys) {
    if (named.has(key)) return key;
  }
  return null;
}

/**
 * THE ONE-PLACE RULE'S CHECKER (#493's bar): given the card numbers each
 * section draws, every number that appears in more than one section.
 *
 * Pure and total so it can be positively controlled — a checker that cannot
 * name a duplicate cannot fail, and a guard that cannot fail proves nothing
 * (working law 2). Its consumers: the one-place guard arm over the real
 * briefing fixture, and the briefing schema's own nextUp/ladder refinement.
 */
export function onePlaceViolations(
  populations: readonly (readonly number[])[],
): number[] {
  const seen = new Set<number>();
  const doubled = new Set<number>();
  for (const population of populations) {
    /* Within one section a duplicate is that section's own defect (its schema
       already refuses it); this checker reads ACROSS sections. Deduped via a
       Set but iterated as an array — one tsconfig on this file targets es5. */
    const unique = Array.from(new Set(population));
    for (const issueNumber of unique) {
      if (seen.has(issueNumber)) doubled.add(issueNumber);
      seen.add(issueNumber);
    }
  }
  return Array.from(doubled).sort((a, b) => a - b);
}

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
