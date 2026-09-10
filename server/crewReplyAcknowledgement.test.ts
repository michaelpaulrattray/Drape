/**
 * HIS REPLY CLEARS THE ITEM HE REPLIED TO, DRIVEN (issue #749).
 *
 * The instance: he replied "seen" on the fangs frames and "Seen" on the card
 * beside them, both were acknowledged, and both were still drawn `open` on his
 * desk 29 hours and four shifts later — *"for some reason the fangs desk card
 * wont dissapear even though i replied seen ages ago"*.
 *
 * The arms that matter:
 *
 *   - the FANGS PAIR, together, in one plan. A card and the frames that name it
 *     both carry a reply, and judged card-first the card is held by its own
 *     frames — half his desk clears and the complaint stands. The order of the
 *     two loops in the planner is the whole fix for that, so it is driven as a
 *     pair and not as two independent items.
 *   - the class the card did not ask for: `toolbelt-socket-35` is a CARD, and a
 *     frames-only fix would have left it open under a reply saying "Done".
 *   - the two schema orphans (#133, #291), which are the reason a card can be
 *     held where a set of frames never is.
 *   - the provenance guard: the ids come from a reading of the DEPLOYED
 *     briefing and the file being written is on disk, so a state that has moved
 *     under the plan is a no-op rather than a rewrite.
 *
 * And the last arm proves the thing the others only imply: the REAL shipped
 * briefing, with the plan applied, still PARSES against the real schema. A
 * planner that produced a briefing the rite refuses would be worse than the
 * defect it fixes — his page would go blank rather than stale.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type ResolvableBriefing } from "../shared/crewCardResolution.js";
import {
  acknowledgementLine,
  planReplyAcknowledgements,
} from "../shared/crewReplyAcknowledgement.js";
import { crewBriefingSchema } from "./crew/crewBriefing.js";

const card = (id: string, state: string) => ({ id, state, issueNumber: null });
const eye = (id: string, state: string, cardId: string | null = null) =>
  ({ id, state, issueNumber: null, cardId });

describe("planReplyAcknowledgements — a reply of his is the act (#749)", () => {
  it("marks a set of frames he replied to `answered`", () => {
    const briefing: ResolvableBriefing = { eyeItems: [eye("fangs-court-strips-599", "open")] };

    const plan = planReplyAcknowledgements(briefing, ["fangs-court-strips-599"]);

    expect(plan.apply).toEqual([{ list: "eyeItems", id: "fangs-court-strips-599" }]);
    expect(plan.held).toEqual([]);
  });

  it("marks a CARD he replied to `answered` — the half the card's own fix would have missed", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("toolbelt-socket-35", "open")] };

    const plan = planReplyAcknowledgements(briefing, ["toolbelt-socket-35"]);

    expect(plan.apply).toEqual([{ list: "needsYou", id: "toolbelt-socket-35" }]);
    expect(plan.held).toEqual([]);
  });

  it("clears the FANGS PAIR in one plan — the frames name the card and both carry a reply", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("fangs-at-rest-599", "open")],
      eyeItems: [eye("fangs-court-strips-599", "open", "fangs-at-rest-599")],
    };

    const plan = planReplyAcknowledgements(briefing, [
      "fangs-at-rest-599",
      "fangs-court-strips-599",
    ]);

    /* Frames FIRST, and the card not held by frames this same plan settles.
       Reverse the two loops in the planner and this arm reddens on `held`. */
    expect(plan.apply).toEqual([
      { list: "eyeItems", id: "fangs-court-strips-599" },
      { list: "needsYou", id: "fangs-at-rest-599" },
    ]);
    expect(plan.held).toEqual([]);
  });

  it("leaves an item alone when he has not replied to it", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("toolbelt-socket-35", "open")],
      eyeItems: [eye("fangs-court-strips-599", "open")],
    };

    expect(planReplyAcknowledgements(briefing, [])).toEqual({ apply: [], held: [] });
  });

  it("names the item and the direction in the line a shift reads", () => {
    expect(acknowledgementLine({ list: "eyeItems", id: "fangs-court-strips-599" }))
      .toContain("eye item fangs-court-strips-599: open → answered");
    expect(acknowledgementLine({ list: "needsYou", id: "toolbelt-socket-35" }))
      .toContain("card toolbelt-socket-35: open → answered");
  });
});

describe("planReplyAcknowledgements — a card that would orphan a dependant is HELD", () => {
  it("holds a card whose OPEN frames he has NOT replied to (#133)", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("fangs-at-rest-599", "open")],
      eyeItems: [eye("fangs-court-strips-599", "open", "fangs-at-rest-599")],
    };

    /* Only the card carries a reply this time. Marking it answered leaves open
       frames beside a card that no longer needs him, which the schema refuses. */
    const plan = planReplyAcknowledgements(briefing, ["fangs-at-rest-599"]);

    expect(plan.apply).toEqual([]);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].id).toBe("fangs-at-rest-599");
    expect(plan.held[0].reason).toContain("fangs-court-strips-599");
    expect(plan.held[0].reason).toContain("#133");
  });

  it("holds a card whose frames are `waiting` — and does NOT say he has not replied", () => {
    /*
      PR #757 review. `crewCardNeedsHim` is true of `waiting` too, so the guard
      fires here correctly — but on `waiting` frames he HAS replied and an act of
      his is outstanding. The hold reason is the one artifact a shift acts on, so
      it must not send that shift to ask him for something he already gave.
    */
    const briefing: ResolvableBriefing = {
      needsYou: [card("fangs-at-rest-599", "open")],
      eyeItems: [eye("fangs-court-strips-599", "waiting", "fangs-at-rest-599")],
    };

    const plan = planReplyAcknowledgements(briefing, ["fangs-at-rest-599"]);

    expect(plan.apply).toEqual([]);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].reason).toContain("#133");
    expect(plan.held[0].reason).toContain("he has replied on those frames");
    expect(plan.held[0].reason).not.toContain("he has not replied");
  });

  it("holds a card a `waiting-founder` pipeline row still names (#291)", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("toolbelt-socket-35", "open")],
      pipeline: [{ id: "socket-pr", status: "waiting-founder", cardId: "toolbelt-socket-35" }],
    };

    const plan = planReplyAcknowledgements(briefing, ["toolbelt-socket-35"]);

    expect(plan.apply).toEqual([]);
    expect(plan.held[0].reason).toContain("socket-pr");
    expect(plan.held[0].reason).toContain("#291");
  });

  it("collects BOTH reasons when a card is held by both — never the first one only", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("both-599", "open")],
      eyeItems: [eye("both-599-frames", "open", "both-599")],
      pipeline: [{ id: "both-row", status: "waiting-founder", cardId: "both-599" }],
    };

    const plan = planReplyAcknowledgements(briefing, ["both-599"]);

    expect(plan.apply).toEqual([]);
    expect(plan.held[0].reason).toContain("#133");
    expect(plan.held[0].reason).toContain("#291");
  });

  it("does NOT hold a card whose only open frames this same plan is settling", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("both-599", "open")],
      eyeItems: [eye("both-599-frames", "open", "both-599")],
    };

    const plan = planReplyAcknowledgements(briefing, ["both-599", "both-599-frames"]);

    expect(plan.held).toEqual([]);
    expect(plan.apply).toHaveLength(2);
  });

  it("still holds a card whose OTHER frames are open, even while settling one set", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("two-sets", "open")],
      eyeItems: [
        eye("set-a", "open", "two-sets"),
        eye("set-b", "open", "two-sets"),
      ],
    };

    /* He replied on set-a only. `eyeItemStillNeedingHim` returns the first
       match, so this arm is what stops the planner reading "a set is settling"
       as "every set is settling". */
    const plan = planReplyAcknowledgements(briefing, ["two-sets", "set-a"]);

    expect(plan.apply).toEqual([{ list: "eyeItems", id: "set-a" }]);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].id).toBe("two-sets");
  });
});

describe("planReplyAcknowledgements — the state is re-read where it is written", () => {
  it.each(["answered", "done", "waiting"])(
    "leaves a `%s` item alone even when the reading called it open",
    (state) => {
      const briefing: ResolvableBriefing = {
        needsYou: [card("moved-on", state)],
        eyeItems: [eye("moved-on-frames", state)],
      };

      expect(planReplyAcknowledgements(briefing, ["moved-on", "moved-on-frames"]))
        .toEqual({ apply: [], held: [] });
    },
  );

  it("is a no-op for an id no briefing holds, rather than a throw", () => {
    expect(planReplyAcknowledgements({}, ["retired-card-from-an-old-edition"]))
      .toEqual({ apply: [], held: [] });
  });
});

describe("the plan applied to the REAL briefing still parses (his page must not go blank)", () => {
  it("marks every open item answered and the result survives the real schema", () => {
    const briefingPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "crew",
      "crew-briefing.json",
    );
    const briefing = JSON.parse(readFileSync(briefingPath, "utf8")) as ResolvableBriefing
      & Record<string, unknown>;

    /* The worst case this planner can be handed: he has replied to EVERYTHING
       the page still calls open. If the result parses, no narrower plan can
       produce a briefing the rite refuses. */
    const everyOpenId = [
      ...(briefing.needsYou ?? []),
      ...(briefing.eyeItems ?? []),
    ].filter((row) => row.state === "open").map((row) => row.id);

    const plan = planReplyAcknowledgements(briefing, everyOpenId);
    for (const item of plan.apply) {
      const rows = (item.list === "eyeItems" ? briefing.eyeItems : briefing.needsYou) ?? [];
      const row = rows.find((candidate) => candidate.id === item.id);
      expect(row).toBeDefined();
      row!.state = "answered";
    }

    expect(() => crewBriefingSchema.parse(briefing)).not.toThrow();
  });
});
