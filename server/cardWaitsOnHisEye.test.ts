/**
 * A CARD WAITING ON HIS EYE OR HIS VERDICT DOES NOT CLOSE (#1349).
 *
 * # His rule, 2026-09-26 (terminal), verbatim and entire
 *
 * > *"yes it shouldnt close if its waiting on my eye and my verdict"*
 *
 * # What happened
 *
 * #1208 was closed by a shift at 2026-09-25 07:47Z with the receipt *"both
 * halves shipped and live"*. The eye item on that work — *is three lines under
 * a good picture too much?* — was still open on his Desk. He answered it the
 * next day, and **the answer landed on a closed card with nobody to build it**;
 * the relay had to quote it across and open the follow-up by hand.
 *
 * **Shipping is not finishing when his eye is the last step.**
 *
 * # Where the rule is enforced, and why it is not a refusal
 *
 * The one road a shift always walks at the end of its work is
 * `scripts/crew-shift-close.mts`, and the run row already names the card. So
 * the finding is printed THERE, at the moment a shift is deciding its work is
 * done, with the card's number in its hand.
 *
 * ⚠ **It does not REFUSE**, and that is the script's own rule rather than a
 * soft touch: refusing would leave the run row open, which his page renders as
 * a shift still running (#288). The row closes, the finding prints, the exit
 * code carries it — the shape the heartbeat finding has had since #295.
 *
 * # The controls
 *
 * The rule is a pure function, so it is driven directly in both directions —
 * an answered eye item must NOT hold a card, or the finding fires on every
 * close and a shift learns to ignore it. The two source arms each run twice:
 * once over the real script (must pass) and once over a doctored copy carrying
 * the defect (must FAIL), because a grep that cannot go red is the instrument
 * this repository has been burned by (working law 2).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  deskItemsWaitingOnHim,
  waitingOnHimFinding,
  type ResolvableBriefing,
} from "../shared/crewCardResolution";

const REPO = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");

/** His desk the night #1208 closed, as the briefing would have held it. */
const DESK: ResolvableBriefing = {
  needsYou: [
    { id: "view-try-again-1208", state: "answered", issueNumber: 1208 },
    { id: "loader-boards-55", state: "open", issueNumber: 55 },
    { id: "settled-card", state: "done", issueNumber: 900 },
  ],
  eyeItems: [
    { id: "view-try-again-1208-strip", state: "open", issueNumber: 1208, cardId: "view-try-again-1208" },
    { id: "judged-frames", state: "answered", issueNumber: 901, cardId: null },
    { id: "finished-frames", state: "done", issueNumber: 902, cardId: null },
  ],
};

describe("the rule: which desk items still want something from him", () => {
  it("#1208's open frames hold it — the case his ruling was about", () => {
    const waiting = deskItemsWaitingOnHim(DESK, 1208);
    expect(waiting.map((item) => item.id)).toEqual(["view-try-again-1208-strip"]);
    expect(waiting[0].list).toBe("eyeItems");
  });

  it("an open NEEDS YOU question holds it too — the same fact in the other list", () => {
    expect(deskItemsWaitingOnHim(DESK, 55).map((item) => item.id)).toEqual(["loader-boards-55"]);
  });

  it("ANSWERED frames do not hold it — the arm that stops the finding crying wolf", () => {
    /* Without this the finding would fire on every close that names any card
       he has ever looked at, which is how a real signal becomes noise. */
    expect(deskItemsWaitingOnHim(DESK, 901)).toEqual([]);
    expect(deskItemsWaitingOnHim(DESK, 902)).toEqual([]);
    expect(deskItemsWaitingOnHim(DESK, 900)).toEqual([]);
  });

  it("a card his desk has never heard of does not hold it", () => {
    expect(deskItemsWaitingOnHim(DESK, 4242)).toEqual([]);
  });

  it("an empty desk is an empty answer rather than a throw", () => {
    expect(deskItemsWaitingOnHim({}, 1208)).toEqual([]);
  });

  it("`waiting` counts as still needing him — both states, one question", () => {
    const desk: ResolvableBriefing = {
      eyeItems: [{ id: "held", state: "waiting", issueNumber: 7, cardId: null }],
    };
    expect(deskItemsWaitingOnHim(desk, 7).map((item) => item.state)).toEqual(["waiting"]);
  });
});

describe("the finding a shift reads", () => {
  const finding = waitingOnHimFinding(1208, deskItemsWaitingOnHim(DESK, 1208));

  it("names the card, the item and the receipt to leave on it", () => {
    expect(finding).toContain("#1208");
    expect(finding).toContain("view-try-again-1208-strip");
    expect(finding).toContain("built and live — waiting on his eye");
  });

  it("quotes his rule rather than paraphrasing it", () => {
    expect(finding).toContain("yes it shouldnt close if its waiting on my eye and");
  });
});

describe("the rule has a caller on the road every shift walks", () => {
  const CLOSE = "scripts/crew-shift-close.mts";

  /**
   * The READING, as a function, so the arm and its control run the same one.
   *
   * A control that asserts a doctored string no longer contains a token proves
   * only that `String.replace` works. What has to be shown is that THIS reading
   * — the one the arm believes — goes red on source carrying the defect.
   */
  const consultsTheRule = (source: string): boolean =>
    source.includes("deskItemsWaitingOnHim(")
    && source.includes("waitingOnHimFinding(")
    /* Both target reads must carry the column the rule is keyed on: a close
       resolving its target by shift id would otherwise read `cardRef` undefined
       and report a clean desk for every run. */
    && (source.match(/SELECT id, shift, seat, cardRef, intent/g) ?? []).length === 2;

  it("the close script asks the rule, and reads the card off the row to do it", () => {
    expect(
      consultsTheRule(read(CLOSE)),
      "the close does not consult the rule — a control with no caller does not exist",
    ).toBe(true);
  });

  it("POSITIVE CONTROL — that reading goes red on a copy carrying each defect", () => {
    const real = read(CLOSE);
    /* Three ways to break it, each the shape a later edit would take. */
    expect(consultsTheRule(real.replace(/deskItemsWaitingOnHim\(/g, "somethingElse("))).toBe(false);
    expect(consultsTheRule(real.replace(/waitingOnHimFinding\(/g, "somethingElse("))).toBe(false);
    expect(
      consultsTheRule(real.replace("SELECT id, shift, seat, cardRef, intent", "SELECT id, shift, seat, intent")),
      "dropping cardRef from one read must be visible — that is the column the rule is keyed on",
    ).toBe(false);
  });

  it("the finding does not refuse the close — the row still gets stamped", () => {
    const source = read(CLOSE);
    /* `refuse()` exits BEFORE the UPDATE. The finding must come after it, or a
       card waiting on his eye would cost a shift its close and leave a row open
       that his page reads as a shift still running (#288). */
    const update = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
    const finding = source.indexOf("deskItemsWaitingOnHim(");
    expect(update, "the close no longer writes — this arm is reading the wrong file").toBeGreaterThan(0);
    expect(finding, "the finding must be raised AFTER the row is stamped").toBeGreaterThan(update);
    /* And it is raised as a finding rather than a refusal. */
    const block = source.slice(finding, finding + 600);
    expect(block).not.toContain("refuse(");
  });

  /** The sweep's half of the rule, read as one function for the same reason. */
  const sweepStatesTheRule = (source: string): boolean =>
    source.includes("CLOSED while his eye is still owed")
    && source.includes("built and live — waiting on his eye");

  it("the desk sweep says the same rule over a card that closed with his eye owed", () => {
    /* Every held eye item IS such a card: `planCardResolutions` reaches a hold
       only through `closing()`, which means the issue is already CLOSED. */
    expect(sweepStatesTheRule(read("scripts/crew-desk-sweep.mts"))).toBe(true);
  });

  it("POSITIVE CONTROL — that reading goes red on a copy without either half", () => {
    const real = read("scripts/crew-desk-sweep.mts");
    expect(sweepStatesTheRule(real.replace("CLOSED while his eye is still owed", "tidied up"))).toBe(false);
    expect(sweepStatesTheRule(real.replace("built and live — waiting on his eye", "done"))).toBe(false);
  });
});
