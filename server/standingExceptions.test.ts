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

import {
  PATROL_POINTER,
  oldestFirst,
  renderBands,
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

describe("the script wires the lib and reads BOTH labels", () => {
  /* Assert at the caller, not near it (invariant 5's shape): the rendering
     being right is worthless if the script still fetches one band. */
  const SCRIPT = new URL("../scripts/queue-standing-exceptions.mts", import.meta.url);

  it("fetches the ordered band and the urgent band", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync(SCRIPT, "utf8"));
    expect(source).toContain('readBand("founder-ordered")');
    expect(source).toContain('readBand("urgent")');
  });

  it("refuses rather than printing an empty ranking it could not read", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync(SCRIPT, "utf8"));
    expect(source).toContain("could not read the queue");
    expect(source).toMatch(/catch[\s\S]*return 1;/);
  });
});
