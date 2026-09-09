/**
 * A DERIVED PRIORITY VIEW WHOSE POPULATION IS NARROWER THAN THE RULE IT SERVES
 * (#472, and the third appearance of the shape on this one feature).
 *
 * `scripts/queue-standing-exceptions.mts` is what PROGRAM.md points every shift
 * at to answer *what matters most right now*. It read ONE label, and its empty
 * state said *"Bands 2 and 3 apply"* — which reads as complete. On the day the
 * card was filed the queue held **0 urgent and 14 `founder-ordered`**, so a
 * shift running it was told to go and find a patrol while fourteen cards he had
 * personally ordered sat unnamed.
 *
 * The card's own bar is that both states are DRIVEN and the output quoted, not
 * reasoned about — so the rendering is a pure function of two lists and a clock
 * and every arm below asserts on the real lines.
 */
import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  BAND_CEILING,
  PATROL_POINTER,
  oldestFirst,
  refuseIfTruncated,
  renderBands,
  report,
  type Row,
} from "../scripts/lib/standingExceptions.mts";

const NOW = new Date("2026-09-09T08:00:00Z");

const card = (over: Partial<Row> = {}): Row => ({
  number: 1,
  title: "a card",
  createdAt: "2026-09-01T00:00:00Z",
  labels: [],
  ...over,
});

const render = (ordered: Row[], urgent: Row[]) =>
  renderBands({ ordered, urgent, now: NOW }).join("\n");

describe("the state the card was filed about: nothing urgent, work he ordered", () => {
  const ordered = [
    card({ number: 330, title: "the law file", createdAt: "2026-08-31T00:00:00Z", labels: [{ name: "founder-ordered" }, { name: "urgent" }] }),
    card({ number: 535, title: "re-imagine", createdAt: "2026-09-02T00:00:00Z", labels: [{ name: "founder-ordered" }] }),
  ];

  it("names his ordered cards by number", () => {
    const out = render(ordered, []);
    expect(out).toContain("#330");
    expect(out).toContain("#535");
    expect(out).toContain("the law file");
  });

  it("⚠ does NOT tell the shift that only bands 2 and 3 apply — the whole defect", () => {
    const out = render(ordered, []);
    expect(out).not.toContain("Bands 2 and 3 apply");
  });

  it("prints his band FIRST, because PROGRAM.md says it is taken first", () => {
    const out = render(ordered, [card({ number: 99, labels: [{ name: "urgent" }] })]);
    expect(out.indexOf("HIS ORDERED BAND")).toBeGreaterThan(-1);
    expect(out.indexOf("HIS ORDERED BAND")).toBeLessThan(out.indexOf("THE URGENT BAND"));
  });

  it("says the urgent band is empty and names the label it looked at", () => {
    /* The empty band still reports — a band that vanishes when empty reads as
       a band that was never consulted. */
    const out = render(ordered, []);
    expect(out).toContain("no open card carries `urgent`");
  });
});

describe("the negative arm — the view can still report nothing", () => {
  it("with both bands empty it says so plainly, naming BOTH labels", () => {
    const out = render([], []);
    expect(out).toContain("both bands are empty");
    expect(out).toContain("`founder-ordered`");
    expect(out).toContain("`urgent`");
  });

  it("and only THEN does the bands-2-and-3 sentence appear, with the patrol pointer", () => {
    /* It is true in exactly one state, which is why it moved into that state. */
    const out = render([], []);
    expect(out).toContain("Bands 2 and 3 apply");
    expect(out).toContain(PATROL_POINTER);
  });
});

describe("the two bands are two lists (#471) and stay that way", () => {
  it("a card carrying BOTH labels appears in both bands, not merged into one", () => {
    /* #471's reasoning: `urgent` means this cannot wait, `founder-ordered`
       means he chose the order. A card that is both is both. */
    const both = card({ number: 330, labels: [{ name: "founder-ordered" }, { name: "urgent" }] });
    const out = render([both], [both]);
    expect(out.split("#330")).toHaveLength(3);
  });

  it("each band hides only its OWN label on the labels line", () => {
    const out = render(
      [card({ number: 7, labels: [{ name: "founder-ordered" }, { name: "blocked" }] })],
      [card({ number: 8, labels: [{ name: "urgent" }, { name: "bug" }] })],
    );
    expect(out).toContain("labels: blocked");
    expect(out).toContain("labels: bug");
    expect(out).not.toContain("labels: founder-ordered");
  });

  it("⚠ a `blocked` ordered card is visible as blocked — a hold this view cannot see reads as takeable work", () => {
    const out = render([card({ number: 508, labels: [{ name: "founder-ordered" }, { name: "blocked" }] })], []);
    expect(out).toContain("#508");
    expect(out).toContain("blocked");
  });
});

describe("oldest first, in both bands", () => {
  it("orders by createdAt and not by issue number", () => {
    const rows = [
      card({ number: 700, createdAt: "2026-08-01T00:00:00Z", title: "older, higher number" }),
      card({ number: 12, createdAt: "2026-09-05T00:00:00Z", title: "newer, lower number" }),
    ];
    expect(oldestFirst(rows).map((row) => row.number)).toEqual([700, 12]);
    const out = render(rows, []);
    expect(out.indexOf("#700")).toBeLessThan(out.indexOf("#12"));
  });

  it("does not re-sort the caller's array", () => {
    const rows = [card({ number: 2, createdAt: "2026-09-05T00:00:00Z" }), card({ number: 1, createdAt: "2026-08-01T00:00:00Z" })];
    oldestFirst(rows);
    expect(rows.map((row) => row.number)).toEqual([2, 1]);
  });

  it("ages are counted against the injected clock", () => {
    const out = render([card({ number: 5, createdAt: "2026-09-01T00:00:00Z" })], []);
    expect(out).toContain("(8d)");
  });

  it("the header counts both bands", () => {
    const out = render([card({ number: 1 }), card({ number: 2 })], [card({ number: 3 })]);
    expect(out).toContain("2 ordered · 1 urgent");
  });
});

describe("the fetch -> render seam, DRIVEN — where the interesting bug lives", () => {
  /*
    ⚠ THE ARMS HERE REPLACE TWO SOURCE GREPS, AND THE GREPS COULD NOT SEE THE
    ONE BUG THAT MATTERS (gate review of PR #716, finding 2). They asserted the
    file CONTAINED `readBand("founder-ordered")` and a `catch … return 1`.
    Transposing the bands at the call site kept every arm green, and a
    commented-out call would have passed too. `report` takes the band reader as
    a parameter for exactly this reason.
  */
  const ordered = card({ number: 330, title: "his ordered card", labels: [{ name: "founder-ordered" }] });
  const urgent = card({ number: 711, title: "the urgent card", labels: [{ name: "urgent" }] });

  const byLabel = (label: string): Row[] => {
    if (label === "founder-ordered") return [ordered];
    if (label === "urgent") return [urgent];
    throw new Error(`unexpected label ${label}`);
  };

  function drive(readBand: (label: string) => readonly Row[]) {
    const out: string[] = [];
    const errs: string[] = [];
    const code = report({ readBand, now: NOW, log: (l) => out.push(l), error: (l) => errs.push(l) });
    return { code, out: out.join("\n"), errs: errs.join("\n") };
  }

  it("⚠ each band's rows land under THAT band — a transposition is red here", () => {
    const { code, out } = drive(byLabel);
    expect(code).toBe(0);
    const hisBand = out.indexOf("HIS ORDERED BAND");
    const urgentBand = out.indexOf("THE URGENT BAND");
    expect(out.indexOf("#330")).toBeGreaterThan(hisBand);
    expect(out.indexOf("#330")).toBeLessThan(urgentBand);
    expect(out.indexOf("#711")).toBeGreaterThan(urgentBand);
  });

  it("asks for both labels, once each", () => {
    const asked: string[] = [];
    drive((label) => { asked.push(label); return byLabel(label); });
    expect(asked).toEqual(["founder-ordered", "urgent"]);
  });

  it("an unreadable queue REFUSES — exit 1, nothing printed as a ranking", () => {
    /* An unauthenticated `gh` prints nothing, which looks exactly like an empty
       queue — and an empty ordered band tells a shift he has asked for nothing. */
    const { code, out, errs } = drive(() => { throw new Error("gh: not authenticated"); });
    expect(code).toBe(1);
    expect(out).toBe("");
    expect(errs).toContain("REFUSING");
    expect(errs).toContain("not authenticated");
  });

  it("the refusal names the real reason FIRST, and the gh hint second", () => {
    /* The truncation refusal comes through this same channel, and "is gh
       authenticated?" is the wrong first sentence when the answer is a ceiling. */
    const { errs } = drive(() => { refuseIfTruncated("founder-ordered", BAND_CEILING); return []; });
    expect(errs.indexOf("ceiling")).toBeLessThan(errs.indexOf("authenticated"));
  });
});

describe("a band at its ceiling is INCOMPLETE and says so", () => {
  /* ⚠ A silent cap is this view's own defect class in different clothes: past
     the limit `gh` drops the OLDEST card, which is the one this ranking exists
     to surface (#236), while the header still prints a count that reads whole. */
  it("refuses at the ceiling, naming the band and the constant", () => {
    expect(() => refuseIfTruncated("founder-ordered", BAND_CEILING)).toThrow(/INCOMPLETE/);
    expect(() => refuseIfTruncated("founder-ordered", BAND_CEILING)).toThrow(/founder-ordered/);
    expect(() => refuseIfTruncated("founder-ordered", BAND_CEILING)).toThrow(/BAND_CEILING/);
  });

  it("and does NOT refuse below it — the arm that keeps it usable", () => {
    /* Without this the refusal could be unconditional and every arm above would
       still pass by refusing. */
    expect(() => refuseIfTruncated("urgent", BAND_CEILING - 1)).not.toThrow();
    expect(() => refuseIfTruncated("urgent", 0)).not.toThrow();
  });

  it("the executable asks gh for exactly BAND_CEILING rows", () => {
    /* The one claim left that only the script can answer: the ceiling it refuses
       at must be the ceiling it ASKED for, or the refusal never fires. */
    const source = readFileSync(new URL("../scripts/queue-standing-exceptions.mts", import.meta.url), "utf8");
    expect(source).toContain("String(BAND_CEILING)");
    expect(source).toContain("refuseIfTruncated(label, rows.length)");
  });
});
