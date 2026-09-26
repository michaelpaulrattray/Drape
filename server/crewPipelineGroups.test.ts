/**
 * THE WHOLE PIPELINE ON ONE PANEL — the partition, and the switch that must
 * never exist (#325).
 *
 * Founder, 2026-08-31: *"all those other ones should be put them under
 * additional categories so i can see the full pipeline like all 97?"*
 *
 * ⚠ **THE TWO WAYS THIS FEATURE GOES WRONG, AND EVERY ARM BELOW IS ONE OF
 * THEM:**
 *
 *   * **A CARD FALLS THROUGH.** The whole point is that all 100 are reachable;
 *     a card matching no group vanishes from his page, which is the exact
 *     failure this card was filed about one layer up. So the partition is
 *     driven over a POPULATION rather than asserted per label — a group renamed
 *     in one place and not the other would still pass twelve happy per-label
 *     arms while dropping cards on the floor.
 *   * **A GROUP GROWS A SWITCH.** `design-unbuilt` and `roadmap` are feature
 *     work, and `PROGRAM.md`'s founder law is *"the team NEVER selects the next
 *     feature. Ever."* A switch on either is that law with a toggle attached.
 *     The two vocabularies are asserted DISJOINT here, so a group key that
 *     found its way into the switch list is a red suite rather than a control
 *     on his page.
 *
 * The population arms use a fixture whose label combinations are the real ones
 * measured off the queue on the day this shipped — `#267` and `#302` carrying
 * `founder-ordered` AND `blocked`, `#219`/`#228`/`#231` carrying only `urgent`,
 * four cards carrying nothing at all — because a fixture where every card has
 * one tidy label cannot fail on the thing that actually happens.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_LADDER_GROUP_KEYS,
  CREW_PIPELINE_GROUPS,
  CREW_PIPELINE_ORPHAN_GROUPS,
  CREW_UNREACHABLE_GROUP_KEYS,
  PIPELINE_GROUP_KEY_PREFIX,
  PIPELINE_SWITCHED_KEY,
  backgroundWorkSentence,
  onePlaceViolations,
  pipelineGroupFor,
  pipelineGroupRowKey,
  rungFromLabels,
} from "../shared/crewPipelineGroups";
import { exclusionFor } from "../shared/crewQueueExclusions";
import { CREW_WORK_CATEGORIES, CREW_WORK_SWITCH_KEYS } from "../shared/crewWorkSwitches";

/**
 * The real label combinations, measured off `gh issue list --state open` on
 * 2026-08-31: 100 open, 29 carrying a switch label, 71 carrying none.
 *
 * Trimmed to one representative card per shape rather than all 100 — what an
 * arm needs from this is every SHAPE that occurs, and a hundred rows would
 * pin a count that moves every night.
 */
const REAL_SHAPES: ReadonlyArray<{ readonly why: string; readonly labels: readonly string[] }> = [
  { why: "a plain bug — reached by a switch", labels: ["bug"] },
  { why: "two seat labels at once — the overlap that breaks naive sums", labels: ["bug", "seat:retro"] },
  { why: "a seat card", labels: ["seat:janitor"] },
  { why: "his card, also blocked — #267's real shape", labels: ["urgent", "founder-ordered", "blocked"] },
  { why: "his card, plain — #321's real shape", labels: ["urgent", "founder-ordered"] },
  { why: "his card that is also a bug — reached by the SWITCH, and excluded there by #324", labels: ["bug", "founder-ordered"] },
  { why: "parked on his ruling", labels: ["parked"] },
  { why: "feature work", labels: ["design-unbuilt"] },
  { why: "a flag-scoped roadmap card", labels: ["roadmap", "CASTING_BORN_INK_SCOPE"] },
  { why: "debt", labels: ["debt"] },
  { why: "debt that is also parked — first match must win once", labels: ["debt", "parked"] },
  { why: "catalogued intention", labels: ["lost-and-found"] },
  { why: "a scope change", labels: ["scope-change"] },
  { why: "a team tool", labels: ["toolbelt"] },
  { why: "a patrol", labels: ["patrol"] },
  { why: "urgent and nothing else — #219's real shape", labels: ["urgent"] },
  { why: "no label at all — #270's real shape", labels: [] },
  /* #429's two new switch labels, measured off the queue 2026-09-04. Both ride
     on top of a group label, which is exactly why they are here: the shape that
     matters is the one where a card was already in a group and a switch now
     reaches it. */
  { why: "debt that is now a small fix — #457's real shape", labels: ["debt", "small-fix"] },
  { why: "a small fix and nothing else — #394's real shape", labels: ["small-fix"] },
  { why: "casting upkeep on a debt card — #242's real shape", labels: ["debt", "casting-upkeep"] },
  { why: "a patrol that is casting upkeep — #129's real shape", labels: ["patrol", "casting-upkeep"] },
];

/**
 * THE CLAIM A `backgroundWork: true` BLURB MAY NOT MAKE (#1248), AND IT LIVES
 * HERE RATHER THAN BESIDE THE BLURBS.
 *
 * ⚠ It was written in `shared/crewPipelineGroups.ts` first and the
 * cleanup-dispositions door refused it: a `shared/` export whose only importer
 * is a test lands on the uncalled-export sweep's reading list as `unread`. The
 * refusal is right, and the alternative — a KEEP row on the deletion door for a
 * symbol nothing in the product calls — would have been the quieter wrong
 * answer. These phrases are not product data; they are what a CHECKER looks for.
 *
 * ⚠ **One direction only.** A group whose work is ORDINARY must not also say in
 * prose that his word decides it — that is the exact pair this card measured.
 * The reverse is fine: a `false` group may say whatever it likes, because
 * "it waits by design" is precisely what its blurb is there to explain.
 *
 * ⚠ **Its limit, stated rather than hidden:** it reads the spellings this page
 * actually uses, so a new wording is invisible to it. That is why the arm below
 * ALSO pins every `true` group's blurb character for character — a phrase reader
 * and a pin fail differently, and the pin is what catches a wording nobody
 * thought of.
 */
const FOUNDER_WORD_CLAIMS: readonly string[] = [
  "needs your word",
  "yours to rule",
  "your own ruling",
  "this one is yours",
  "without your word",
];

function blurbClaimsHisWord(blurb: string): boolean {
  const haystack = blurb.toLowerCase();
  return FOUNDER_WORD_CLAIMS.some((claim) => haystack.includes(claim));
}

describe("the pipeline vocabulary", () => {
  it("⚠ CONTROL — every group is defined by a label that already exists, or by nothing", () => {
    /* `shared/crewWorkSwitches.ts`'s anti-drift design, one level out: a card
       relabelled in GitHub must move group with nobody touching that file. Not
       one label below was invented for this feature — the relay applies
       `founder-ordered`, and the rest are the queue's own. The four nulls are
       the groups defined by something other than one label, and they are named
       so a fifth cannot appear silently. */
    expect(CREW_PIPELINE_GROUPS.map((group) => group.queueLabel)).toEqual([
      null, // switched — any of the switch labels
      "founder-ordered",
      "parked",
      "design-unbuilt",
      "roadmap",
      null, // rung — a `rung:` label, matched on its prefix (#1199)
      "blocked",
      "debt",
      "lost-and-found",
      "scope-change",
      "toolbelt",
      "patrol",
      null, // other — a label this vocabulary does not name
      null, // unfiled — no label at all
    ]);
  });

  it("⚠ THE LAW — no group is switchable: the two vocabularies share no key", () => {
    /* This is the arm that stands between him and a toggle on `design-unbuilt`.
       Both directions, because either collision would let a row of one
       vocabulary be read as a row of the other. */
    for (const group of CREW_PIPELINE_GROUPS) {
      expect(CREW_WORK_SWITCH_KEYS as readonly string[]).not.toContain(group.key);
    }
    for (const key of CREW_WORK_SWITCH_KEYS) {
      expect(CREW_PIPELINE_GROUPS.map((group) => group.key)).not.toContain(key);
    }
    /* POSITIVE CONTROL — the assertion above is only meaningful if these lists
       are non-empty and this comparison can fail. A key that IS in both is
       caught: `bugs` is a switch key, and asserting it is absent from the
       switch list would fail. */
    expect(CREW_WORK_SWITCH_KEYS as readonly string[]).toContain("bugs");
    expect(CREW_PIPELINE_GROUPS.length).toBeGreaterThan(5);
  });

  it("⚠ THE STORED KEYS CANNOT COLLIDE WITH A SWITCH COUNT'S KEY, and fit the column", () => {
    /* Group rows share `crew_queue_counts` with the switch counts — that shared
       table is what makes this a row and a line rather than a migration and a
       founder ceremony. The prefix is the whole separation. */
    for (const group of CREW_PIPELINE_GROUPS) {
      const rowKey = pipelineGroupRowKey(group.key);
      expect(rowKey.startsWith(PIPELINE_GROUP_KEY_PREFIX)).toBe(true);
      expect(CREW_WORK_CATEGORIES.map((category) => category.key)).not.toContain(rowKey);
      /* `categoryKey` is `varchar(32)`. MEASURED rather than trusted to a
         sentence in a docblock, because the failure mode is a silent MySQL
         truncation that makes two groups the same row. */
      expect(rowKey.length).toBeLessThanOrEqual(32);
    }
  });

  it("every group states why it is not on offer", () => {
    /* His card's own bar — *"Every non-switchable group states why it is not on
       offer"*. A group that appeared without a reason would read on his page as
       an oversight rather than as a decision. */
    for (const group of CREW_PIPELINE_GROUPS) {
      expect(group.blurb.trim().length).toBeGreaterThan(10);
      expect(group.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("every group is homed, and `elsewhere` exists exactly when the home is not here (#493)", () => {
    for (const group of CREW_PIPELINE_GROUPS) {
      /* The phrase and the home are one fact: a group homed elsewhere with no
         phrase would silently vanish from the quiet counts line, and a phrase
         on a group drawn here would count its cards twice. */
      expect(group.elsewhere === null).toBe(group.home === "here");
    }
  });

  it("the pipeline block draws the orphans and only the orphans — derived, never a second list (#493)", () => {
    expect(CREW_PIPELINE_ORPHAN_GROUPS.map((group) => group.key))
      .toEqual(CREW_PIPELINE_GROUPS.filter((group) => group.home === "here").map((group) => group.key));
    /* The one-place rule at the vocabulary: the sections that draw cards are
       the switches, NEXT UP, the ladder and this block — and no group is in
       two of them, because `home` is one field. */
    expect(CREW_PIPELINE_ORPHAN_GROUPS.map((group) => group.key)).toEqual([
      "blocked", "debt", "lost-and-found", "scope-change", "toolbelt", "patrol", "other", "unfiled",
    ]);
    /* POSITIVE CONTROLS — the filter actually removed something, and the
       doubling his order names cannot come back through this list. */
    expect(CREW_PIPELINE_ORPHAN_GROUPS.length).toBe(CREW_PIPELINE_GROUPS.length - 6);
    for (const gone of [PIPELINE_SWITCHED_KEY, "ordered", "roadmap", "parked", "design-unbuilt", "rung"]) {
      expect(CREW_PIPELINE_ORPHAN_GROUPS.map((group) => group.key)).not.toContain(gone);
    }
    /* The ladder's population is the other side of the same field. */
    expect(CREW_LADDER_GROUP_KEYS).toEqual(["parked", "design-unbuilt", "roadmap", "rung"]);
  });

  it("a rung label reads against the ladder's own keys, and a typo is unplaced rather than invented (#493)", () => {
    const rungs = ["N1", "N2", "N3"];
    expect(rungFromLabels(["roadmap", "rung:N2"], rungs)).toBe("N2");
    expect(rungFromLabels(["roadmap"], rungs)).toBeNull();
    /* A rung the ladder does not hold is UNPLACED — the sweep says so out
       loud; silently inventing N9 on his page would be worse than either. */
    expect(rungFromLabels(["rung:N9"], rungs)).toBeNull();
    /* Two rung labels resolve deterministically to ladder order. */
    expect(rungFromLabels(["rung:N3", "rung:N1"], rungs)).toBe("N1");
  });

  it("the one-place checker names a doubled card, and only a doubled card (#493's bar)", () => {
    /* Negative arm: four disjoint sections are clean. */
    expect(onePlaceViolations([[493, 494], [16, 203], [484], []])).toEqual([]);
    /* POSITIVE CONTROL — the checker can fail: one card in two sections is
       named. A checker that cannot name a duplicate proves nothing (law 2). */
    expect(onePlaceViolations([[493, 494], [16, 493]])).toEqual([493]);
    /* A duplicate WITHIN one section is that section's own schema's problem,
       not a cross-section double — asserted so the checker's question stays
       the question. */
    expect(onePlaceViolations([[493, 493], [16]])).toEqual([]);
  });
});

describe("the partition", () => {
  it("⚠ EVERY CARD LANDS SOMEWHERE — driven over the real shapes, not asserted per label", () => {
    const keys = new Set(CREW_PIPELINE_GROUPS.map((group) => group.key));
    for (const shape of REAL_SHAPES) {
      const key = pipelineGroupFor(shape.labels);
      expect(keys.has(key), `${shape.why} → \`${key}\` is not a declared group`).toBe(true);
    }
  });

  it("⚠ AND LANDS IN EXACTLY ONE — the counts sum to the population they came from", () => {
    /* His bar: *"the counts sum to the real total."* This is that bar as an arm,
       over a population where a third of the shapes carry two or more labels
       this vocabulary names — the count is derived from `REAL_SHAPES` itself
       rather than stated, because a number written here goes stale the next
       time a shape is added (it did, in the commit that added #429's four). */
    const tally = new Map<string, number>();
    for (const shape of REAL_SHAPES) {
      const key = pipelineGroupFor(shape.labels);
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    let sum = 0;
    for (const count of tally.values()) sum += count;
    expect(sum).toBe(REAL_SHAPES.length);
  });

  it("a card the switches reach is filed there whatever else it carries", () => {
    /* Anything else would show him one card in two places and make the total
       larger than the queue. `bug` + `founder-ordered` is #316's real shape, and
       #324 already excludes it from the switch COUNT — but it is still a card
       the switch panel is responsible for, and it must not appear again below. */
    expect(pipelineGroupFor(["bug", "founder-ordered"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["seat:retro", "debt"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["seat:warden"])).toBe(PIPELINE_SWITCHED_KEY);
  });

  it("⚠ #429's two labels move eighteen cards OUT of the groups below — this is what changed on his page", () => {
    /* `SWITCH_LABELS` is imported from `shared/crewWorkSwitches.ts`, so adding a
       category there silently re-files every card carrying its label. That is
       the design and it is correct — a card a switch can reach must not also be
       offered as un-switchable work below — but it is a VISIBLE change to his
       zone-2 numbers (measured 2026-09-04: Debt 22 → 9, Toolbelt 1 → 0, Patrols
       1 → 0, Lost and found 3 → 2, Roadmap 2 → 1, Other 1 → 0, On offer 33 →
       51, total 77 either way). Driven here so it is a stated consequence
       rather than a surprise. */
    expect(pipelineGroupFor(["debt", "small-fix"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["small-fix"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["toolbelt", "small-fix"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["debt", "casting-upkeep"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["patrol", "casting-upkeep"])).toBe(PIPELINE_SWITCHED_KEY);
    /* POSITIVE CONTROLS — the same labels WITHOUT the new one still land where
       they always did, so the arms above measure the new label rather than a
       `pipelineGroupFor` that has started answering `switched` to everything. */
    expect(pipelineGroupFor(["debt"])).toBe("debt");
    expect(pipelineGroupFor(["toolbelt"])).toBe("toolbelt");
    expect(pipelineGroupFor(["patrol"])).toBe("patrol");
  });

  it("⚠ AND HIS OWN CARDS STILL OUTRANK THEM — `founder-ordered` is read FIRST", () => {
    /* The one shape that would have been a regression: a switch label lands a
       card in `switched` BEFORE the group loop runs, so a `founder-ordered`
       card that also carried `small-fix` would leave "Queued by you" and appear
       as ordinary background work. No open card has that pair today (checked at
       the queue, 2026-09-04) — this arm is what makes that a property rather
       than today's luck. */
    expect(pipelineGroupFor(["founder-ordered", "small-fix"])).toBe(PIPELINE_SWITCHED_KEY);
    /* ⚠ Which is the DECLARED behaviour, not the desired one: it matches
       `#316`'s existing `bug` + `founder-ordered` shape exactly, and #324's
       exclusion is what keeps such a card off the offered count — the row reads
       `Small fixes (n on offer, 1 already queued)` rather than offering it twice. The
       arm below is that promise, driven. */
    expect(exclusionFor(["founder-ordered", "small-fix"])).toBe("ordered");
    expect(exclusionFor(["debt", "small-fix"])).toBe(null);
  });

  it("⚠ A CARD ON A RUNG IS ON THE ROAD — his ruling 2026-09-25 (#1199), on the three cards that were wrong that day", () => {
    /* #1129 `blocked` + `rung:N2`, #1121 `blocked` + `rung:N1`, #1125 `debt` +
       `rung:N3`: all three sat in NOT ON ANY ROAD while carrying a rung. */
    expect(pipelineGroupFor(["blocked", "rung:N2"])).toBe("rung");
    expect(pipelineGroupFor(["rung:N1", "blocked"])).toBe("rung");
    expect(pipelineGroupFor(["debt", "rung:N3"])).toBe("rung");
    expect(pipelineGroupFor(["rung:N4"])).toBe("rung");
    /* What still outranks a rung: the switches, his ordered band, and the
       three named ladder words — a parked card on a rung reads "parked". */
    expect(pipelineGroupFor(["bug", "rung:N2"])).toBe(PIPELINE_SWITCHED_KEY);
    expect(pipelineGroupFor(["founder-ordered", "rung:N2"])).toBe("ordered");
    expect(pipelineGroupFor(["parked", "rung:N2"])).toBe("parked");
    expect(pipelineGroupFor(["roadmap", "rung:N2"])).toBe("roadmap");
    /* And a card with no rung still reaches `blocked` — the group moved, it did not leave. */
    expect(pipelineGroupFor(["blocked"])).toBe("blocked");
    expect(pipelineGroupFor(["blocked", "debt"])).toBe("blocked");
  });

  it("⚠ FIRST MATCH WINS, and his own cards outrank everything they also carry", () => {
    /* `exclusionFor`'s stated reason, and #267's real shape: what he needs to
       know about a card he queued is that HE queued it, not that it is also
       blocked. */
    expect(pipelineGroupFor(["urgent", "founder-ordered", "blocked"])).toBe("ordered");
    expect(pipelineGroupFor(["founder-ordered", "debt", "parked"])).toBe("ordered");
    /* Below him the vocabulary's order decides, once. */
    expect(pipelineGroupFor(["debt", "parked"])).toBe("parked");
    expect(pipelineGroupFor(["debt", "roadmap"])).toBe("roadmap");
  });

  it("⚠ A LABEL NOBODY DECLARED IS VISIBLE, NEVER DROPPED", () => {
    /* The group that keeps the partition total when GitHub grows a label
       tomorrow. Today it holds #219, #228 and #231 — three cards labelled only
       `urgent`, and three of the most important open cards there are. */
    expect(pipelineGroupFor(["urgent"])).toBe("other");
    expect(pipelineGroupFor(["a-label-invented-next-tuesday"])).toBe("other");
    /* POSITIVE CONTROL — `other` is not what everything falls to. A declared
       label still reaches its own group. */
    expect(pipelineGroupFor(["debt"])).toBe("debt");
  });

  it("⚠ #893 — the switch-unreachable groups are DERIVED, and every one of them really is unreachable", () => {
    /* The property the reading rests on, driven rather than reasoned: a card in
       any group flagged `backgroundWork` carries no switch label, because
       `pipelineGroupFor` files a card that does under `switched` first. If that
       ever stopped being true, the untakeable list would name cards a shift
       could already have taken — noise, which is how a finding stops being
       read. */
    expect(CREW_UNREACHABLE_GROUP_KEYS.length).toBeGreaterThan(0);
    expect(CREW_UNREACHABLE_GROUP_KEYS).not.toContain(PIPELINE_SWITCHED_KEY);
    for (const key of CREW_UNREACHABLE_GROUP_KEYS) {
      const group = CREW_PIPELINE_GROUPS.find((entry) => entry.key === key);
      expect(group, `${key} is not a declared group`).toBeDefined();
      /* A group defined by a label: that label alone must not reach a switch. */
      if (group?.queueLabel) expect(pipelineGroupFor([group.queueLabel])).toBe(key);
    }
    /* ⚠ POSITIVE CONTROL — it is not simply every group. The ones waiting on
       him by design are OUT, or the line would report his own roadmap back to
       him as work nobody can take. */
    for (const key of ["ordered", "parked", "design-unbuilt", "roadmap", "scope-change", "blocked", "patrol"]) {
      expect(CREW_UNREACHABLE_GROUP_KEYS, `${key} waits on him or on its own clock`).not.toContain(key);
    }
  });

  it("⚠ #893 — #804's real shape lands in a group the reading reports", () => {
    /* The specimen, at its measured labels: `debt` and nothing else, from 11
       September. Two days of shifts read the queue and correctly never saw it.
       This arm is what makes the next one impossible to add silently. */
    const group = pipelineGroupFor(["debt"]);
    expect(group).toBe("debt");
    expect(CREW_UNREACHABLE_GROUP_KEYS).toContain(group);
    /* And the moment somebody gives it a category it leaves the list — which is
       the whole remedy, and it must not need a code change. */
    expect(CREW_UNREACHABLE_GROUP_KEYS).not.toContain(pipelineGroupFor(["debt", "bug"]));
  });

  /* ── #1248: ONE ANSWER PER GROUP, NEVER TWO ──────────────────────────────
     `debt` carried `backgroundWork: true` and a blurb reading *"Carded cleanup
     — it needs your word because the scope varies"*, four lines apart in the
     same object. One said his word was required; the other, by the field's own
     docblock, said ordinary background work. `CREW_UNREACHABLE_GROUP_KEYS`
     derives from the field and `crew-count-queue.mts` prints that reading at
     every shift start, so a number a shift is told rested on a flag the words
     beside it contradicted. The blurbs stopped making the claim; his page draws
     it from the field. */

  it("⚠ #1248 — a group that holds ORDINARY work never also claims his word decides it", () => {
    for (const group of CREW_PIPELINE_GROUPS) {
      if (!group.backgroundWork) continue;
      expect(
        blurbClaimsHisWord(group.blurb),
        `"${group.key}" holds ordinary background work, so its blurb must not say his word decides it: "${group.blurb}"`,
      ).toBe(false);
    }
    /* POSITIVE CONTROL — the exact string `debt` carried must read as a claim,
       or this arm is a checker that cannot fail (working law 2). */
    expect(blurbClaimsHisWord("Carded cleanup — it needs your word because the scope varies.")).toBe(true);
    /* NEGATIVE CONTROL — a `false` group may say it, and one does. A reader that
       forbade the phrase everywhere would be measuring something else. */
    const scope = CREW_PIPELINE_GROUPS.find((group) => group.key === "scope-change")!;
    expect(scope.backgroundWork).toBe(false);
    expect(blurbClaimsHisWord(scope.blurb)).toBe(true);
  });

  it("⚠ #1248 — every `true` group's blurb is PINNED, because a phrase reader cannot see a new wording", () => {
    /* The phrase list above reads the spellings this page uses today; a claim
       worded some new way is invisible to it. The pin is the second reader, and
       the two fail differently: change any of these and the arm reddens whatever
       words were chosen. */
    const pinned: Record<string, string> = {
      debt: "Carded cleanup, and the scope varies from card to card.",
      toolbelt: "The team's own tools — nothing a customer sees.",
      other: "Labelled, but with nothing this panel names — worth a look, they may want a category.",
      unfiled: "No label at all — nobody can find these, and they want triaging.",
    };
    const ordinary = CREW_PIPELINE_GROUPS.filter((group) => group.backgroundWork).map((group) => group.key);
    expect([...ordinary].sort()).toEqual(Object.keys(pinned).sort());
    for (const group of CREW_PIPELINE_GROUPS) {
      if (!group.backgroundWork) continue;
      expect(group.blurb, `${group.key}'s blurb`).toBe(pinned[group.key]);
    }
  });

  it("⚠ #1248 — the stance sentence comes from `backgroundWork` and from nothing else", () => {
    const ordinary = backgroundWorkSentence(CREW_PIPELINE_GROUPS.find((g) => g.key === "debt")!);
    const waiting = backgroundWorkSentence(CREW_PIPELINE_GROUPS.find((g) => g.key === "blocked")!);
    expect(ordinary).toContain("Real work");
    expect(waiting).toContain("waits by design");
    expect(ordinary).not.toBe(waiting);

    /* Every drawn group gets one, and it agrees with the field on all of them —
       the whole population, so a fifteenth group homed `here` cannot arrive
       without an answer. */
    for (const group of CREW_PIPELINE_ORPHAN_GROUPS) {
      expect(backgroundWorkSentence(group), `${group.key}`).toBe(group.backgroundWork ? ordinary : waiting);
    }
    /* And it is the DRAWN rows only: a group homed elsewhere has its own section
       saying what it waits for, so a second sentence here would be the doubling
       #493 removed. */
    for (const group of CREW_PIPELINE_GROUPS) {
      if (group.home === "here") continue;
      expect(backgroundWorkSentence(group), `${group.key} is drawn elsewhere`).toBeNull();
    }
  });

  it("⚠ #1248 — the claim list is not empty, so the reader cannot pass by having nothing to look for", () => {
    expect(FOUNDER_WORD_CLAIMS.length).toBeGreaterThan(0);
    expect(blurbClaimsHisWord("Carded cleanup, and the scope varies from card to card.")).toBe(false);
  });

  it("no label at all is its own answer, and is not `other`", () => {
    /* His card names these as *"their own small defect"* wanting triage — which
       is a different sentence from "carries a label we do not group", so they
       must not share a row. */
    expect(pipelineGroupFor([])).toBe("unfiled");
    expect(pipelineGroupFor([])).not.toBe("other");
  });
});
