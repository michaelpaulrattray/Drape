/**
 * THE ARMS FOR THE MANAGER'S FACT SHEET (#1658).
 *
 * Four things this reader must never get wrong, each in the direction that costs
 * something:
 *
 *  1. **a sheet that is missing, unparseable, stale or partial must be UNUSABLE**
 *     — the card's §5, and the only reason this feature cannot cost a pass
 *     anything. Every arm here asserts the WORD as well as the refusal, because
 *     the word is printed into the plan and *the manager did not run* and *the
 *     manager answered half the queue* are different facts;
 *  2. **a good sheet must be USABLE** — the positive control, without which every
 *     refusal above could be a reader that refuses everything;
 *  3. **a hold with no reason, and a row with no checkable sentence, must be
 *     refused** — those are his own rules everywhere else, and a reader that
 *     accepted one would put a silent hold on his page;
 *  4. ⚠ **the BRIEF and the VALIDATOR must not drift apart.** They are two
 *     statements of one contract — the brief tells the manager what to print, the
 *     validator decides what is acceptable — which is the shape working law 4
 *     warns about. The arm is not a list of field names retyped here: it PARSES
 *     the brief's own worked example and pushes it through the real validator, so
 *     a required field the brief does not show reddens by construction.
 *
 * Nothing here needs a model, a file handle for the sheet, GitHub or a database:
 * `readManagerSheet` takes the text, so the arms hand it text.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/* The last block drives both CLIs as real processes, so this suite is in
   `childProcessTestTimeouts`' derived population and declares the class's
   timeout at file level (#548). */
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";

vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

import {
  extractJsonObject,
  MANAGER_SHEET_MAX_AGE_MS,
  managerRowsByCard,
  parseManagerRows,
  readManagerSheet,
  stampSheet,
  unwrapManagerPayload,
  type ManagerCardRow,
} from "../scripts/lib/managerFactSheet.mts";

const NOW = Date.parse("2026-10-01T02:30:00.000Z");
const FRESH = new Date(NOW - 5 * 60 * 1000).toISOString();

function row(card: number, over: Partial<ManagerCardRow> = {}): Record<string, unknown> {
  return {
    card,
    dependsOn: [],
    area: "billing",
    collidesWith: [],
    ready: "yes",
    why: "",
    batchHint: null,
    reason: `#${card}'s body names server/db/billing.ts and cites no card as a prerequisite.`,
    ...over,
  };
}

/** A whole sheet as `stampSheet` writes one, as text, for the read-time arms. */
function sheetText(over: Record<string, unknown> = {}, rows = [row(1604), row(1606)]): string {
  const verdict = parseManagerRows({ rows }, rows.map((r) => r.card as number));
  if (verdict.kind !== "rows") throw new Error(`fixture is not a valid sheet: ${verdict.why}`);
  return JSON.stringify({
    ...stampSheet({
      rows: verdict.rows,
      pass: "20261001-022100",
      readAt: FRESH,
      snapshotCards: rows.length,
      prNumbers: [],
      model: "claude-opus-5",
      nowMs: NOW,
    }),
    ...over,
  });
}

/* ── PULLING THE OBJECT OUT OF A MODEL'S FINAL MESSAGE ──────────────────────── */

describe("the manager's object is found however it was printed", () => {
  it("takes the object when it is the whole message", () => {
    expect(extractJsonObject('{"rows":[]}')).toBe('{"rows":[]}');
  });

  it("takes it out of a fence and out of prose around it", () => {
    const fenced = 'Here is the sheet:\n```json\n{"rows":[{"card":1}]}\n```\nThat is all.';
    expect(extractJsonObject(fenced)).toBe('{"rows":[{"card":1}]}');
  });

  it("is not ended early by a brace inside a string", () => {
    const text = '{"rows":[{"card":1,"reason":"it mentions a } and a { in prose"}]}';
    expect(extractJsonObject(text)).toBe(text);
    expect(JSON.parse(extractJsonObject(text)!)).toHaveProperty("rows");
  });

  it("skips a brace in the prose BEFORE the real object", () => {
    /* ⚠ The one shape a naive indexOf/lastIndexOf reader fails. */
    const text = 'I considered the shape {card, area} and here it is:\n{"rows":[{"card":7}]}';
    expect(extractJsonObject(text)).toBe('{"rows":[{"card":7}]}');
  });

  it("answers nothing when the manager wrote prose alone", () => {
    expect(extractJsonObject("I could not read the queue, sorry.")).toBeNull();
  });
});

describe("the envelope road, where the cost figure lives", () => {
  it("reads the rows out of a --output-format json envelope, with the cost beside them", () => {
    const envelope = JSON.stringify({
      type: "result",
      total_cost_usd: 0.1234,
      result: `Here it is.\n${JSON.stringify({ rows: [row(1604)] })}`,
    });
    const unwrapped = unwrapManagerPayload(envelope);
    expect(unwrapped).not.toBeNull();
    expect(unwrapped!.costUsd).toBe(0.1234);
    const verdict = parseManagerRows(unwrapped!.payload, [1604]);
    expect(verdict.kind).toBe("rows");
  });

  it("⚠ does not stop at the envelope — the failure that reads a good session as prose", () => {
    /*
      On the JSON road the FIRST balanced object is the envelope and it has no
      `rows`. A reader that stopped there would report *the manager answered in
      prose* about a session that answered perfectly, which is the confusing
      direction. The discriminator is `rows`, not position.
    */
    const envelope = JSON.stringify({ result: JSON.stringify({ rows: [row(1604)] }) });
    const unwrapped = unwrapManagerPayload(envelope);
    expect((unwrapped!.payload as { rows?: unknown[] }).rows).toHaveLength(1);
  });

  it("still takes the plain final message, where no cost is reported", () => {
    const unwrapped = unwrapManagerPayload(JSON.stringify({ rows: [row(1604)] }));
    expect(unwrapped!.costUsd).toBeNull();
    expect(parseManagerRows(unwrapped!.payload, [1604]).kind).toBe("rows");
  });

  it("answers no payload for an envelope whose result is prose", () => {
    const envelope = JSON.stringify({ total_cost_usd: 0.5, result: "I could not read the queue." });
    const unwrapped = unwrapManagerPayload(envelope);
    expect(unwrapped!.payload).toBeNull();
    expect(unwrapped!.costUsd).toBe(0.5);
  });

  it("carries the cost onto the stamped sheet and back off it", () => {
    const verdict = parseManagerRows({ rows: [row(1604)] }, [1604]);
    if (verdict.kind !== "rows") throw new Error("fixture");
    const stamped = stampSheet({
      rows: verdict.rows, pass: "p", readAt: FRESH, snapshotCards: 1, prNumbers: [],
      model: "claude-opus-5", costUsd: 0.42, nowMs: NOW,
    });
    expect(stamped.costUsd).toBe(0.42);
    const read = readManagerSheet({ raw: JSON.stringify(stamped), pass: "p", nowMs: NOW });
    expect(read.kind).toBe("usable");
    if (read.kind !== "usable") return;
    expect(read.sheet.costUsd).toBe(0.42);
  });
});

/* ── THE VALIDATION, AGAINST THE QUEUE THE MANAGER WAS GIVEN ────────────────── */

describe("what the validator refuses, and what it accepts", () => {
  it("accepts a complete sheet and sorts its rows", () => {
    const verdict = parseManagerRows({ rows: [row(1606), row(1604)] }, [1604, 1606]);
    expect(verdict.kind).toBe("rows");
    if (verdict.kind !== "rows") return;
    expect(verdict.rows.map((r) => r.card)).toEqual([1604, 1606]);
  });

  it("calls a short sheet PARTIAL and names what is missing", () => {
    const verdict = parseManagerRows({ rows: [row(1604)] }, [1604, 1606, 1607]);
    expect(verdict.kind).toBe("refused");
    if (verdict.kind !== "refused") return;
    expect(verdict.state).toBe("partial");
    expect(verdict.why).toContain("#1606");
    expect(verdict.why).toContain("#1607");
  });

  it("refuses a row for a card the manager was never shown", () => {
    const verdict = parseManagerRows({ rows: [row(1604), row(999)] }, [1604]);
    expect(verdict.kind).toBe("refused");
    if (verdict.kind !== "refused") return;
    expect(verdict.state).toBe("unparseable");
    expect(verdict.why).toContain("#999");
  });

  it("refuses two rows for one card", () => {
    const verdict = parseManagerRows({ rows: [row(1604), row(1604)] }, [1604]);
    expect(verdict.kind).toBe("refused");
    if (verdict.kind !== "refused") return;
    expect(verdict.why).toContain("two rows for #1604");
  });

  it("refuses a hold with no reason — his own rule everywhere else", () => {
    const verdict = parseManagerRows({ rows: [row(1604, { ready: "no", why: "   " })] }, [1604]);
    expect(verdict.kind).toBe("refused");
    if (verdict.kind !== "refused") return;
    expect(verdict.why).toContain("a hold without a reason is refused");
  });

  it("accepts a hold that HAS a reason — the control for the arm above", () => {
    const verdict = parseManagerRows(
      { rows: [row(1604, { ready: "no", why: "it waits on his answer about top-up pricing" })] },
      [1604],
    );
    expect(verdict.kind).toBe("rows");
  });

  it("refuses a row with no checkable sentence", () => {
    const verdict = parseManagerRows({ rows: [row(1604, { reason: "" })] }, [1604]);
    expect(verdict.kind).toBe("refused");
    if (verdict.kind !== "refused") return;
    expect(verdict.why).toContain("carries no `reason`");
  });

  it("refuses a readiness that is neither word", () => {
    const verdict = parseManagerRows({ rows: [row(1604, { ready: "maybe" as never })] }, [1604]);
    expect(verdict.kind).toBe("refused");
    if (verdict.kind !== "refused") return;
    expect(verdict.why).toContain("neither");
  });

  it("refuses a dependency list that is not a list of cards", () => {
    const bad = parseManagerRows({ rows: [row(1604, { dependsOn: ["#1598"] as never })] }, [1604]);
    expect(bad.kind).toBe("refused");
    const notArray = parseManagerRows({ rows: [row(1604, { dependsOn: 1598 as never })] }, [1604]);
    expect(notArray.kind).toBe("refused");
  });

  describe("the two lists the manager was shown are the only numbers it may name", () => {
    /*
      ⚠ THE RELAY'S FINDING ON PR #1668. `collidesWith` accepted any positive
      integer, `managerPairVerdict` could only compare CARD numbers, and the brief
      asked for pull-request numbers — so a row that did exactly what it was asked
      read as *no collision*, and FREED a card the file-set proof would have held.
      The repair is that the manager's own inputs are the allowlist.
    */
    it("accepts a pull-request number in `collidesWith`", () => {
      const verdict = parseManagerRows({ rows: [row(1604, { collidesWith: [1660] })] }, [1604], [1660]);
      expect(verdict.kind).toBe("rows");
      if (verdict.kind !== "rows") return;
      expect(verdict.rows[0]!.collidesWith).toEqual([1660]);
    });

    it("accepts a card number in `collidesWith`", () => {
      expect(parseManagerRows({ rows: [row(1604, { collidesWith: [1606] }), row(1606)] }, [1604, 1606], []).kind).toBe("rows");
    });

    it("⚠ REFUSES a number that is in neither list — a hallucination costs the sheet", () => {
      const verdict = parseManagerRows({ rows: [row(1604, { collidesWith: [424242] })] }, [1604], [1660]);
      expect(verdict.kind).toBe("refused");
      if (verdict.kind !== "refused") return;
      expect(verdict.state).toBe("unparseable");
      expect(verdict.why).toContain("#424242");
      expect(verdict.why).toContain("open card or an open pull request");
    });

    it("⚠ REFUSES a pull-request number in `dependsOn` — that is the columns confused", () => {
      const verdict = parseManagerRows({ rows: [row(1604, { dependsOn: [1660] })] }, [1604], [1660]);
      expect(verdict.kind).toBe("refused");
      if (verdict.kind !== "refused") return;
      expect(verdict.why).toContain("an open card the manager was shown");
    });

    it("refuses a dependency on a card that was not in the queue it was given", () => {
      expect(parseManagerRows({ rows: [row(1604, { dependsOn: [9999] })] }, [1604], []).kind).toBe("refused");
    });

    it("carries the allowlist onto the sheet and re-checks against it at read time", () => {
      const verdict = parseManagerRows({ rows: [row(1604, { collidesWith: [1660] })] }, [1604], [1660]);
      if (verdict.kind !== "rows") throw new Error("fixture");
      const stamped = stampSheet({
        rows: verdict.rows, pass: "p", readAt: FRESH, snapshotCards: 1,
        prNumbers: [1660], model: "m", nowMs: NOW,
      });
      expect(stamped.prNumbers).toEqual([1660]);
      const read = readManagerSheet({ raw: JSON.stringify(stamped), pass: "p", nowMs: NOW });
      expect(read.kind).toBe("usable");
      if (read.kind !== "usable") return;
      expect(read.sheet.prNumbers).toEqual([1660]);

      /* ⚠ AND THE SAME SHEET WITH THE ALLOWLIST REMOVED IS UNPARSEABLE, NOT
         EMPTY. Defaulting it to `[]` would refuse a row that was correct when it
         was written, for a reason nobody could diagnose. */
      const stripped = { ...stamped } as Record<string, unknown>;
      delete stripped.prNumbers;
      const blind = readManagerSheet({ raw: JSON.stringify(stripped), pass: "p", nowMs: NOW });
      expect(blind.kind).toBe("unusable");
      if (blind.kind !== "unusable") return;
      expect(blind.state).toBe("unparseable");
      expect(blind.why).toContain("which pull requests the manager was shown");
    });
  });

  it("treats an absent dependency or collision list as empty, never as a failure", () => {
    const sparse = { card: 1604, ready: "yes", reason: "nothing names it.", area: null };
    const verdict = parseManagerRows({ rows: [sparse] }, [1604]);
    expect(verdict.kind).toBe("rows");
    if (verdict.kind !== "rows") return;
    expect(verdict.rows[0]!.dependsOn).toEqual([]);
    expect(verdict.rows[0]!.collidesWith).toEqual([]);
    expect(verdict.rows[0]!.batchHint).toBeNull();
  });

  it("de-duplicates and sorts a card list rather than trusting the order it was given", () => {
    /* Driven on `collidesWith` with a pull-request allowlist, so the row count
       still matches the queue it was given — a snapshot widened to hold the cited
       numbers would make the sheet PARTIAL and the arm would fail for that
       instead, which is what the first shape of it did. */
    const verdict = parseManagerRows(
      { rows: [row(1604, { collidesWith: [1606, 1601, 1606] })] },
      [1604],
      [1601, 1606],
    );
    expect(verdict.kind).toBe("rows");
    if (verdict.kind !== "rows") return;
    expect(verdict.rows[0]!.collidesWith).toEqual([1601, 1606]);
  });

  it("refuses output that is not an object with rows", () => {
    expect(parseManagerRows([], [1]).kind).toBe("refused");
    expect(parseManagerRows({ cards: [] }, [1]).kind).toBe("refused");
    expect(parseManagerRows(null, [1]).kind).toBe("refused");
  });
});

/* ── MAY THIS PASS USE THIS SHEET? ─────────────────────────────────────────── */

describe("the read-time verdict, and all four unusable states", () => {
  it("accepts a fresh sheet for this pass — the positive control", () => {
    const verdict = readManagerSheet({ raw: sheetText(), pass: "20261001-022100", nowMs: NOW });
    expect(verdict.kind).toBe("usable");
    if (verdict.kind !== "usable") return;
    expect(verdict.sheet.rows.map((r) => r.card)).toEqual([1604, 1606]);
    expect(verdict.sheet.model).toBe("claude-opus-5");
    expect(managerRowsByCard(verdict.sheet).get(1606)?.area).toBe("billing");
  });

  it("calls an absent file MISSING", () => {
    const verdict = readManagerSheet({ raw: null, pass: "20261001-022100", nowMs: NOW });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.state).toBe("missing");
  });

  it("calls a sheet from another pass STALE and names both stamps", () => {
    const verdict = readManagerSheet({ raw: sheetText(), pass: "20261001-033000", nowMs: NOW });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.state).toBe("stale");
    expect(verdict.why).toContain("20261001-022100");
    expect(verdict.why).toContain("20261001-033000");
  });

  it("calls an old queue read STALE even when the pass matches", () => {
    const old = new Date(NOW - MANAGER_SHEET_MAX_AGE_MS - 60_000).toISOString();
    const verdict = readManagerSheet({ raw: sheetText({ readAt: old }), pass: "20261001-022100", nowMs: NOW });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.state).toBe("stale");
  });

  it("accepts a queue read just INSIDE the ceiling — the control for the arm above", () => {
    const edge = new Date(NOW - MANAGER_SHEET_MAX_AGE_MS + 60_000).toISOString();
    const verdict = readManagerSheet({ raw: sheetText({ readAt: edge }), pass: "20261001-022100", nowMs: NOW });
    expect(verdict.kind).toBe("usable");
  });

  it("calls a stamp from the future STALE", () => {
    const ahead = new Date(NOW + 30 * 60 * 1000).toISOString();
    const verdict = readManagerSheet({ raw: sheetText({ readAt: ahead }), pass: "20261001-022100", nowMs: NOW });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.state).toBe("stale");
  });

  it("calls a sheet with fewer rows than it was given cards PARTIAL", () => {
    const verdict = readManagerSheet({
      raw: sheetText({ snapshotCards: 53 }),
      pass: "20261001-022100",
      nowMs: NOW,
    });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.state).toBe("partial");
    expect(verdict.why).toContain("2 rows for the 53 cards");
  });

  it("calls an empty sheet PARTIAL rather than clean", () => {
    const verdict = readManagerSheet({
      raw: JSON.stringify({ pass: "p", readAt: FRESH, snapshotCards: 0, prNumbers: [], model: "m", rows: [] }),
      pass: "p",
      nowMs: NOW,
    });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.state).toBe("partial");
  });

  it("calls junk and a missing denominator UNPARSEABLE", () => {
    for (const raw of [
      "not json at all",
      "[]",
      JSON.stringify({ readAt: FRESH, snapshotCards: 1, rows: [row(1)] }),
      JSON.stringify({ pass: "p", readAt: "whenever", snapshotCards: 1, rows: [row(1)] }),
      JSON.stringify({ pass: "p", readAt: FRESH, rows: [row(1)] }),
    ]) {
      const verdict = readManagerSheet({ raw, pass: "p", nowMs: NOW });
      expect(verdict.kind, raw.slice(0, 40)).toBe("unusable");
      if (verdict.kind !== "unusable") continue;
      expect(["unparseable", "stale"], raw.slice(0, 40)).toContain(verdict.state);
    }
  });

  it("re-validates the rows at read time, not only at write time", () => {
    /* A file hand-edited after it was written — the shape two independent
       readings of one fact exist for. */
    const doctored = JSON.stringify({
      pass: "p",
      readAt: FRESH,
      snapshotCards: 1,
      prNumbers: [],
      model: "m",
      rows: [row(1604, { ready: "no", why: "" })],
    });
    const verdict = readManagerSheet({ raw: doctored, pass: "p", nowMs: NOW });
    expect(verdict.kind).toBe("unusable");
    if (verdict.kind !== "unusable") return;
    expect(verdict.why).toContain("a hold without a reason is refused");
  });
});

/* ── THE BRIEF AND THE VALIDATOR ARE ONE CONTRACT ──────────────────────────── */

const BRIEF_PATH = resolve(import.meta.dirname, "..", "docs", "specs", "MANAGER_SEAT_BRIEF.md");
const BRIEF = readFileSync(BRIEF_PATH, "utf8");

/** Every fenced ```json block in the brief, parsed. */
function fencedJson(text: string): unknown[] {
  const found: unknown[] = [];
  for (const match of text.matchAll(/```json\n([\s\S]*?)```/g)) {
    try {
      found.push(JSON.parse(match[1]!));
    } catch {
      found.push({ __unparseable: match[1]!.slice(0, 60) });
    }
  }
  return found;
}

describe("the manager's brief cannot drift from the validator", () => {
  it("shows a worked example, and that example parses", () => {
    const blocks = fencedJson(BRIEF);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toHaveProperty("__unparseable");
    }
  });

  it("⚠ pushes the brief's OWN example row through the real validator", () => {
    /*
      THE DRIFT ARM, and it names no field. If the validator ever requires
      something the brief does not demonstrate — or the brief demonstrates a
      shape the validator refuses — this reddens, which is the only mechanical
      hold on two statements of one contract.
    */
    const example = fencedJson(BRIEF).find(
      (block): block is { rows: Record<string, unknown>[] } =>
        block !== null && typeof block === "object" && Array.isArray((block as { rows?: unknown }).rows),
    );
    expect(example, "the brief shows no `rows` example").toBeDefined();
    const rows = example!.rows;
    expect(rows.length).toBeGreaterThan(0);
    const verdict = parseManagerRows(example, rows.map((r) => r.card as number));
    expect(verdict.kind === "rows" ? "rows" : verdict.why).toBe("rows");
  });

  it("⚠ states the two-list rule and what each kind of number MEANS", () => {
    /*
      The relay's finding on PR #1668: the brief asked for pull-request numbers in
      `collidesWith` and the only consumer compared card numbers, so a correct row
      read as *no collision*. The brief is the contract the manager is prompted
      with, so these three sentences are part of the repair and not commentary on
      it — a brief that loses them puts the defect back with the reader intact.
    */
    /* Matched on the UNWRAPPED text: the brief is hard-wrapped prose, so a phrase
       long enough to be worth asserting is a phrase long enough to carry a
       newline. Collapsing whitespace first makes the arm about the sentence
       rather than about the column it happens to wrap at. */
    const flat = BRIEF.replace(/\s+/g, " ");
    expect(flat).toContain("Every number you put here must come from one of the two files you were given");
    expect(flat).toContain("a number in neither refuses the whole sheet");
    expect(flat).toContain("**a CARD number** says");
    expect(flat).toContain("**a PULL-REQUEST number** says");
    expect(flat).toContain("`dependsOn` is **card numbers only**");
  });

  it("names the three rules a breach of which costs the pass its sheet", () => {
    /* Each is a refusal the validator actually makes, so the brief must say so
       before the manager pays for it. Searched as phrases the brief uses. */
    expect(BRIEF).toContain("one per card");
    expect(BRIEF).toContain('`ready` is the string `"yes"` or `"no"`');
    expect(BRIEF).toContain("`reason` is non-empty on **every** row");
  });

  it("says the manager has no write tool and must not launch anything", () => {
    expect(BRIEF).toContain("`Read`, `Grep` and `Glob` and nothing else");
    expect(BRIEF).toMatch(/do not launch anything/i);
  });

  it("every placeholder it declares is used, and every placeholder used is declared", () => {
    /*
      SELF-CONSISTENCY, derived from the file rather than from the runner — which
      is gitignored and therefore unreachable from any suite. A placeholder the
      runner is told about but the body never uses would silently do nothing; one
      used but never declared is one nobody knows to substitute, and it would
      reach the manager as literal braces.
    */
    const headerEnd = BRIEF.indexOf("\n---\n");
    expect(headerEnd).toBeGreaterThan(0);
    const header = BRIEF.slice(0, headerEnd);
    const body = BRIEF.slice(headerEnd);
    expect(header).toContain("The placeholders the runner fills:");
    const declared = new Set([...header.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]!));
    const used = new Set([...body.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]!));
    expect(declared.size).toBeGreaterThan(0);
    expect([...declared].sort()).toEqual([...used].sort());
  });

  it("⚠ the brief reader can FAIL — the negative control for the arms above", () => {
    /*
      Without this, every assertion above would pass for a reader that cannot
      tell a brief from a blank page (working law 2). Driven on text rather than
      on the file, so it proves the predicate rather than the document.
    */
    const gutted = BRIEF.replace("one per card", "whichever cards you like")
      .replace("`reason` is non-empty on **every** row", "");
    expect(gutted).not.toContain("one per card");
    expect(gutted).not.toContain("`reason` is non-empty on **every** row");
    const exampleless = "# a brief with no example\n\nnothing fenced here.\n";
    expect(fencedJson(exampleless)).toEqual([]);
  });
});

/* ── THE TWO CLIs, DRIVEN AS REAL PROCESSES ────────────────────────────────── */

const REPO = resolve(import.meta.dirname, "..");

/**
 * ⚠ **EXACT EXIT CODES, NEVER `not.toBe(0)`** — `runHook`'s own docblock: through
 * `shell: true` a missing binary becomes the shell's `9009`/`127`, so a refusal
 * arm written as *not zero* would pass over a command that never ran.
 */
function runScript(script: string, args: string[]) {
  return runHook("npx", ["tsx", script, ...args], { cwd: REPO, shell: true, timeout: 120_000 });
}

describe("the brief composer puts this pass's facts into the brief", () => {
  let dir = "";
  function setUp() {
    dir = mkdtempSync(join(tmpdir(), "mgr-brief-"));
    const p = { queue: join(dir, "queue.json"), prs: join(dir, "prs.json"), out: join(dir, "prompt.txt") };
    writeFileSync(p.queue, JSON.stringify([{ number: 1604, title: "a" }, { number: 1606, title: "b" }]), "utf8");
    writeFileSync(p.prs, JSON.stringify([{ number: 1660, files: [{ path: "server/db/billing.ts" }] }]), "utf8");
    return p;
  }

  it("writes a prompt with no placeholder left in it, and the Atlas's own vocabulary", () => {
    const p = setUp();
    try {
      const run = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "20261001-022100",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out,
      ]);
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain("BRIEF 2 cards");
      const prompt = readFileSync(p.out, "utf8");
      expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
      /* The READABLE copy, never the runner's one-line snapshot — the manager's
         only reading tool cannot paginate that one (the arm below drives it). */
      expect(prompt).toContain(p.queue.replace(/\.json$/, ".readable.json"));
      expect(prompt).toContain("20261001-022100");
      expect(prompt).toContain("exactly `2` rows");
      /* ⚠ THE VOCABULARY IS THE CUTTER'S OWN: real Atlas domains, and never the
         Atlas's `unassigned`, which `buildAreaIndex` drops and the brief answers
         with `null`. */
      expect(prompt).toContain("casting");
      expect(prompt).toContain("billing");
      expect(prompt).not.toContain("unassigned");
      /* The header is about the brief and must not reach the manager. */
      expect(prompt).not.toContain("THIS FILE IS THE BRIEF ITSELF");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /*
    ⚠ THE ARM FOR THE DEFECT THAT COST THE FIRST ARMED PASS ITS SHEET.

    `gh --json` prints compact JSON — ONE line. The manager holds `Read`, `Grep`
    and `Glob`, and `Read` cannot paginate a one-line file: on pass
    `20261001-141427` it returned the first 21,249 of 171,326 characters, which
    held 5 of that pass's 54 card numbers, and `offset: 2` was refused as past
    the end of the file. The brief asked for 54 rows from a file the session
    could see 5 cards of.

    So the arm is about LINES, not about bytes or prettiness: the file the brief
    hands the manager must have one JSON value per line, which is the only thing
    that makes `offset`/`limit` work. It drives the real script, reads the real
    output, and asserts the raw snapshot is left alone — the sheet writer takes
    its allowlists from that one.
  */
  it("hands the manager pretty-printed snapshots it can page, and leaves the raw ones alone", () => {
    const p = setUp();
    try {
      /* A body long enough that a compact snapshot would be one unreadable line,
         and long enough to prove a long line survives a paged read. */
      const longBody = `Parent: #1598.\n\n${"detail ".repeat(400)}`;
      writeFileSync(
        p.queue,
        JSON.stringify([
          { number: 1604, title: "a", body: longBody, labels: [], createdAt: "2026-09-30T00:00:00Z" },
          { number: 1606, title: "b", body: longBody, labels: [], createdAt: "2026-09-30T00:00:00Z" },
        ]),
        "utf8",
      );
      const rawQueueBefore = readFileSync(p.queue, "utf8");
      const rawPrsBefore = readFileSync(p.prs, "utf8");
      expect(rawQueueBefore.split("\n")).toHaveLength(1);

      const run = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "20261001-022100",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out,
      ]);
      expect(run.status, run.stderr).toBe(0);

      const readableQueue = p.queue.replace(/\.json$/, ".readable.json");
      const readablePrs = p.prs.replace(/\.json$/, ".readable.json");
      expect(existsSync(readableQueue)).toBe(true);
      expect(existsSync(readablePrs)).toBe(true);

      /* THE WHOLE POINT: many lines, not one. */
      const queueLines = readFileSync(readableQueue, "utf8").split("\n").length - 1;
      expect(queueLines).toBeGreaterThan(10);
      /* `\n` only — a CRLF copy would make the brief's line count disagree with
         the bytes a later reading quotes. */
      expect(readFileSync(readableQueue, "utf8")).not.toContain("\r");
      /* And it is the SAME data, not a summary of it. */
      expect(JSON.parse(readFileSync(readableQueue, "utf8"))).toEqual(JSON.parse(rawQueueBefore));
      expect(JSON.parse(readFileSync(readablePrs, "utf8"))).toEqual(JSON.parse(rawPrsBefore));

      /* The brief points at the readable copies and never at the raw ones. */
      const prompt = readFileSync(p.out, "utf8");
      expect(prompt).toContain(readableQueue);
      expect(prompt).toContain(readablePrs);
      /* `<dir>\queue.json` is not a substring of `<dir>\queue.readable.json`, so
         this is a real exclusion rather than a tautology — the check that the
         placeholder was not left pointing at the one-line file. */
      expect(prompt).not.toContain(p.queue);
      /* The line counts reach the manager, so it knows to page rather than
         discovering it by running out. */
      expect(prompt).toContain(`${queueLines} lines`);
      expect(run.stdout).toContain(`queue ${queueLines} lines`);

      /* The raw snapshots are untouched: `manager-fact-sheet.mts` reads its card
         and pull-request allowlists from them. */
      expect(readFileSync(p.queue, "utf8")).toBe(rawQueueBefore);
      expect(readFileSync(p.prs, "utf8")).toBe(rawPrsBefore);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /*
    THE NEGATIVE CONTROL FOR THE ARM ABOVE (working law 2). A refusal must leave
    NOTHING behind — not the prompt, and not a readable copy written before the
    refusal was reached. Without this, a run that refused halfway would plant
    files at paths the next reader would treat as this pass's.
  */
  it("a refusal leaves neither a prompt nor a readable copy behind", () => {
    const p = setUp();
    try {
      const leaky = join(dir, "leaky.md");
      writeFileSync(leaky, "# header\n\n---\n\nRead {{QUEUE_FILE}} and also {{NOPE}}.\n", "utf8");
      const run = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "x",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out, "--brief", leaky,
      ]);
      expect(run.status).toBe(1);
      expect(existsSync(p.out)).toBe(false);
      expect(existsSync(p.queue.replace(/\.json$/, ".readable.json"))).toBe(false);
      expect(existsSync(p.prs.replace(/\.json$/, ".readable.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /*
    AND A PULL-REQUEST SNAPSHOT THIS CANNOT PARSE REFUSES THE BRIEF. It was
    `existsSync` alone before the snapshots were re-written here. Refusing is the
    safe direction: no brief, no manager, and the pass cuts as it did before
    #1658 — nothing can be made worse by it.
  */
  it("refuses a pull-request snapshot that is not a readable array", () => {
    const p = setUp();
    try {
      writeFileSync(p.prs, "not json at all", "utf8");
      const broken = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "x",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out,
      ]);
      expect(broken.status).toBe(1);
      expect(broken.stdout).toContain("BRIEF none");
      expect(broken.stdout).toContain("pull-request snapshot");
      expect(existsSync(p.out)).toBe(false);

      writeFileSync(p.prs, JSON.stringify({ number: 1 }), "utf8");
      const notArray = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "x",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out,
      ]);
      expect(notArray.status).toBe(1);
      expect(notArray.stdout).toContain("is not an array");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses an empty queue, a leftover placeholder and a brief with no separator", () => {
    const p = setUp();
    try {
      writeFileSync(join(dir, "empty.json"), "[]", "utf8");
      const empty = runScript("scripts/manager-brief.mts", [
        "--queue", join(dir, "empty.json"), "--prs", p.prs, "--pass", "x",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out,
      ]);
      expect(empty.status).toBe(1);
      expect(empty.stdout).toContain("BRIEF none");
      expect(existsSync(p.out)).toBe(false);

      const leaky = join(dir, "leaky.md");
      writeFileSync(leaky, "# header\n\n---\n\nRead {{QUEUE_FILE}} and also {{NOPE}}.\n", "utf8");
      const left = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "x",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out, "--brief", leaky,
      ]);
      expect(left.status).toBe(1);
      expect(left.stdout).toContain("{{NOPE}}");
      expect(existsSync(p.out)).toBe(false);

      const flat = join(dir, "flat.md");
      writeFileSync(flat, "no separator anywhere, just prose.\n", "utf8");
      const noSep = runScript("scripts/manager-brief.mts", [
        "--queue", p.queue, "--prs", p.prs, "--pass", "x",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", p.out, "--brief", flat,
      ]);
      expect(noSep.status).toBe(1);
      expect(noSep.stdout).toContain("separat");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the sheet writer is the only thing that writes, and it refuses cleanly", () => {
  let dir = "";

  function setUp(logBody: string) {
    dir = mkdtempSync(join(tmpdir(), "mgr-sheet-"));
    const f = { queue: join(dir, "queue.json"), log: join(dir, "manager.log"), out: join(dir, "sheet.json") };
    writeFileSync(f.queue, JSON.stringify([{ number: 1604 }, { number: 1606 }]), "utf8");
    writeFileSync(f.log, logBody, "utf8");
    return f;
  }

  const goodRows = {
    rows: [
      {
        card: 1604, dependsOn: [], area: "billing", collidesWith: [], ready: "yes", why: "",
        batchHint: null, reason: "it names server/db/billing.ts alone.",
      },
      {
        card: 1606, dependsOn: [1604], area: "billing", collidesWith: [], ready: "no",
        why: "it cannot sell a top-up until #1604 lands", batchHint: null,
        reason: "its body says the renewal fix must land first.",
      },
    ],
  };

  it("extracts the object from a log with prose around it and stamps the runner's facts", () => {
    const f = setUp(`I read the queue.\n\n${JSON.stringify(goodRows)}\n\nDone.`);
    try {
      const run = runScript("scripts/manager-fact-sheet.mts", [
        "--from-log", f.log, "--queue", f.queue, "--pass", "20261001-022100",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", f.out,
      ]);
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain("SHEET 2 rows");
      expect(run.stdout).toContain("1 ready");
      const sheet = JSON.parse(readFileSync(f.out, "utf8"));
      expect(sheet.pass).toBe("20261001-022100");
      expect(sheet.readAt).toBe("2026-10-01T02:21:00.000Z");
      expect(sheet.snapshotCards).toBe(2);
      expect(sheet.rows).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes nothing when the manager answered in prose", () => {
    const f = setUp("I could not read the queue file, sorry.");
    try {
      const run = runScript("scripts/manager-fact-sheet.mts", [
        "--from-log", f.log, "--queue", f.queue, "--pass", "p",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", f.out,
      ]);
      expect(run.status).toBe(1);
      expect(run.stdout).toContain("SHEET none");
      expect(existsSync(f.out)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names PARTIAL when the manager covered only half the queue", () => {
    const f = setUp(JSON.stringify({ rows: [goodRows.rows[0]] }));
    try {
      const run = runScript("scripts/manager-fact-sheet.mts", [
        "--from-log", f.log, "--queue", f.queue, "--pass", "p",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", f.out,
      ]);
      expect(run.status).toBe(1);
      expect(run.stdout).toContain("partial");
      expect(run.stdout).toContain("#1606");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("⚠ REMOVES a sheet already sitting at the output path when it refuses", () => {
    /*
      The planted-stale-sheet shape. `readManagerSheet`'s `stale` arm exists for a
      sheet left by an earlier pass — and this script would BE the thing that
      planted one if a refusal left yesterday's file in place under this pass's
      name. Its negative control is the happy arm two above: on success a file
      appears, so this is about the refusal road rather than a path nothing writes.
    */
    const f = setUp("prose only, no object here.");
    try {
      writeFileSync(f.out, JSON.stringify({ pass: "an-earlier-pass", rows: [] }), "utf8");
      expect(existsSync(f.out)).toBe(true);
      const run = runScript("scripts/manager-fact-sheet.mts", [
        "--from-log", f.log, "--queue", f.queue, "--pass", "p",
        "--read-at", "2026-10-01T02:21:00.000Z", "--out", f.out,
      ]);
      expect(run.status).toBe(1);
      expect(existsSync(f.out)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
