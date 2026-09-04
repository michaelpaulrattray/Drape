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
  CREW_PIPELINE_GROUPS,
  CREW_PIPELINE_VISIBLE_GROUPS,
  PIPELINE_GROUP_KEY_PREFIX,
  PIPELINE_SWITCHED_KEY,
  pipelineGroupFor,
  pipelineGroupRowKey,
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

describe("the pipeline vocabulary", () => {
  it("⚠ CONTROL — every group is defined by a label that already exists, or by nothing", () => {
    /* `shared/crewWorkSwitches.ts`'s anti-drift design, one level out: a card
       relabelled in GitHub must move group with nobody touching that file. Not
       one label below was invented for this feature — the relay applies
       `founder-ordered`, and the rest are the queue's own. The three nulls are
       the groups defined by something other than one label, and they are named
       so a fourth cannot appear silently. */
    expect(CREW_PIPELINE_GROUPS.map((group) => group.queueLabel)).toEqual([
      null, // switched — any of the switch labels
      "founder-ordered",
      "blocked",
      "parked",
      "design-unbuilt",
      "roadmap",
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

  it("the drawn groups are the vocabulary minus the arithmetic — derived, never a second list", () => {
    expect(CREW_PIPELINE_VISIBLE_GROUPS.map((group) => group.key))
      .toEqual(CREW_PIPELINE_GROUPS.filter((group) => group.key !== PIPELINE_SWITCHED_KEY).map((group) => group.key));
    /* POSITIVE CONTROL — the filter actually removed something. */
    expect(CREW_PIPELINE_VISIBLE_GROUPS.length).toBe(CREW_PIPELINE_GROUPS.length - 1);
    expect(CREW_PIPELINE_VISIBLE_GROUPS.map((group) => group.key)).not.toContain(PIPELINE_SWITCHED_KEY);
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
       `Small fixes (n, 1 already queued)` rather than offering it twice. The
       arm below is that promise, driven. */
    expect(exclusionFor(["founder-ordered", "small-fix"])).toBe("ordered");
    expect(exclusionFor(["debt", "small-fix"])).toBe(null);
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

  it("no label at all is its own answer, and is not `other`", () => {
    /* His card names these as *"their own small defect"* wanting triage — which
       is a different sentence from "carries a label we do not group", so they
       must not share a row. */
    expect(pipelineGroupFor([])).toBe("unfiled");
    expect(pipelineGroupFor([])).not.toBe("other");
  });
});
