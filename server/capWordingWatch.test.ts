import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";
import { TSX_CLI } from "./testing/tsxCli";

import {
  alternatives,
  decode,
  readClassifierPatterns,
  scanLogs,
  slotTolerantForms,
  type ClassifierPatterns,
} from "../scripts/lib/capWordingWatch.mts";

/* One arm spawns the entrance itself (`the entrance runs` below), so this suite
   is in `childProcessSuites`'s derived population from the moment it is
   tracked. File level, never per arm. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE CAP-WORDING WATCH'S CONTROLS (#2236, option A).
 *
 * The subject is `scripts/lib/capWordingWatch.mts` and its entrance
 * `scripts/retro-cap-wordings.mts` — the Retro's standing reading that looks
 * for the NEXT wording able to defeat the park-at-the-cap control the way
 * `hit your WEEKLY limit` defeated `hit your limit` for four months (#2198).
 *
 * ⚠ **A WATCH IS EXACTLY THE KIND OF INSTRUMENT WORKING LAW 2 WAS WRITTEN
 * ABOUT**: its healthy answer and its broken answer are the same sentence,
 * *"nothing found"*. So the arms below come in pairs, and the pair that matters
 * most is driven against the REAL pre-#2198 classifier on disk rather than a
 * fixture — if this instrument cannot find the defect that is already on the
 * record, its silence about future ones means nothing.
 *
 * Everything here runs in process over temp fixtures, except that one spawn.
 * ⚠ That is deliberate and it is #2164's lesson: the gate gets slower every
 * time a shift fixes a tooling bug, and a 3,774-log corpus walk inside `pnpm
 * test` would be this card paying that tax for a reading no pull request needs.
 */

/** The real message, byte for byte off `foreman-20261010-040545.log:1`. */
const REAL_CAP_LINE = "You've hit your weekly limit \u00b7 resets Oct 14, 4pm (Australia/Brisbane)";
/** The second real wording, off `foreman-20261009-005826.log:1`. */
const REAL_SESSION_LINE = "You've hit your session limit \u00b7 resets 1:50am (Australia/Brisbane)";

const LIVE_CLASSIFIER = "C:/Users/Admin/Drape/.agents/foreman/classify-shift-failure.ps1";
const PRE_2198_CLASSIFIER = "C:/Users/Admin/Drape/.agents/foreman/classify-shift-failure.before-2198.ps1";

/** His phrase list as it stood when #2198 found the defect, and still does. */
const HIS_CAP_PATTERN =
  "usage limit|rate limit|limit reached|hit your limit|out of credits|insufficient credits" +
  "|\\bquota\\b|API Error:\\s*429|429 Too Many Requests|rate_limit_error" +
  "|status(?: code)?[:=]?\\s*429|HTTP\\s*429";
const HIS_TRANSIENT_PATTERN =
  "API Error:\\s*5\\d\\d|overloaded|service unavailable|bad gateway|gateway time-?out" +
  "|connection reset|ECONNRESET|ETIMEDOUT|socket hang up|request timed out|upstream connect error";
/** #2198's second reader. */
const CAP_MESSAGE = "hit your (?:[\\w-]+\\s+){1,2}limit";
/** His own measured lead, which this watch takes rather than choosing one. */
const HIS_CAP_HEAD = 24;

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "cap-wording-2236-"));
}

/** Write a log, UTF-8 by default and UTF-16LE on request (92% of the corpus). */
function writeLog(dir: string, name: string, lines: string[], utf16 = false): void {
  const text = lines.join("\r\n");
  writeFileSync(join(dir, name), utf16 ? Buffer.from("\ufeff" + text, "utf16le") : text);
}

function patterns(over: Partial<ClassifierPatterns> = {}): ClassifierPatterns {
  return {
    capPattern: HIS_CAP_PATTERN,
    capMessage: CAP_MESSAGE,
    transientPattern: HIS_TRANSIENT_PATTERN,
    capHead: HIS_CAP_HEAD,
    ...over,
  };
}

describe("the net is DERIVED from his phrases, not from #2236's list of five", () => {
  it("opens an interior slot in every one of the five siblings the card named", () => {
    /* ⚠ The point of deriving rather than listing: a SIXTH phrase added to
       `$CAP_PATTERN` next year gets its trigger with no edit here. A suite
       asserting "these five forms exist" would stop watching the day the list
       moved — `fix-drops-subject-from-guard`. So this asserts the five are
       COVERED, and the arm below asserts the derivation is total. */
    const forms = slotTolerantForms(HIS_CAP_PATTERN).concat(slotTolerantForms(HIS_TRANSIENT_PATTERN));
    const covered = new Set(forms.map((f) => f.phrase));
    for (const sibling of [
      "limit reached",
      "out of credits",
      "insufficient credits",
      "service unavailable",
      "request timed out",
    ]) {
      expect(covered, `#2236 named "${sibling}" as a sibling and the net does not cover it`).toContain(
        sibling,
      );
    }
  });

  it("covers EVERY plain-word phrase in both patterns, so the derivation is total", () => {
    const plain = (pattern: string) => alternatives(pattern).filter((a) => /^[a-z]+(?: [a-z]+)+$/.test(a));
    for (const pattern of [HIS_CAP_PATTERN, HIS_TRANSIENT_PATTERN]) {
      const covered = new Set(slotTolerantForms(pattern).map((f) => f.phrase));
      expect([...plain(pattern)].filter((p) => !covered.has(p))).toEqual([]);
    }
  });

  it("leaves a regex alternative alone — a slot form built from `\\bquota\\b` is nonsense", () => {
    /* The NEGATIVE half of the derivation. Without this, `API Error:\s*429`
       would yield forms like `API\s+(?:[\w-]+\s+){1,2}Error:\s*429` which can
       never match anything a provider prints, and the net would read as
       broader than it is. */
    const phrases = slotTolerantForms(HIS_CAP_PATTERN).map((f) => f.phrase);
    for (const metacharacterAlternative of ["\\bquota\\b", "API Error:\\s*429", "rate_limit_error"]) {
      expect(phrases).not.toContain(metacharacterAlternative);
    }
  });

  it("a single-word alternative has no interior slot and yields nothing", () => {
    expect(slotTolerantForms("overloaded")).toEqual([]);
  });

  it("does NOT open a zero-width slot — a `{0,2}` form would report every real cap", () => {
    /* If any derived form matched the bare phrase, the 750 real caps in the
       corpus would all become findings and the report would be unreadable. */
    for (const form of slotTolerantForms(HIS_CAP_PATTERN)) {
      expect(new RegExp(form.source, "i").test(form.phrase)).toBe(false);
    }
  });
});

describe("the positive control that matters: it reproduces #2198's discovery", () => {
  it("his phrase does NOT match the real message, and the derived form DOES", () => {
    /* This is the whole of #2198 in one arm. `hit your limit` is his ruled
       phrase; the message his account prints is `hit your WEEKLY limit`; one
       adjective defeated the control for four months. The derivation finds it
       with no wording guessed by anybody.

       ⚠ It is NOT asserted that the derived source equals `$CAP_MESSAGE`
       character for character — it does not (`\s+` where #2198 wrote a literal
       space). What is asserted is the thing that would have mattered on the
       night. */
    expect(new RegExp("hit your limit", "i").test(REAL_CAP_LINE)).toBe(false);
    expect(new RegExp("hit your limit", "i").test(REAL_SESSION_LINE)).toBe(false);

    const derived = slotTolerantForms("hit your limit").map((f) => new RegExp(f.source, "i"));
    expect(derived.some((re) => re.test(REAL_CAP_LINE))).toBe(true);
    expect(derived.some((re) => re.test(REAL_SESSION_LINE))).toBe(true);
  });

  it("finds a real cap message when the classifier cannot, and names the phrase to repair", () => {
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-cap.log", [REAL_CAP_LINE], true);
      /* `capMessage: null` is the pre-#2198 state exactly: his phrase list, and
         no second reader. */
      const result = scanLogs({ dir, patterns: patterns({ capMessage: null }) });
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        file: "foreman-cap.log",
        line: 1,
        shape: "cap",
        phrase: "hit your limit",
      });
      expect(result.findings[0].text).toContain("resets Oct 14");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("and says NOTHING about the same log once #2198's reader is in place", () => {
    /* The other half, and the arm that proves the first one is not simply a
       reader that reports everything. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-cap.log", [REAL_CAP_LINE], true);
      expect(scanLogs({ dir, patterns: patterns() }).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the negative controls — what must never become a finding", () => {
  it("a shift writing PROSE about the cap machinery is not a finding", () => {
    /* #721's whole population: every shift that documents this mechanism was
       joining the cap class. Measured in the real corpus, prose sits at lead 61
       or deeper and the real message at 0–10, with nothing between. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-prose.log", [
        "**What was actually wrong.** The alarm that stops the team when the allowance " +
          "runs out looked for the phrase hit your limit. The real message says hit your weekly limit.",
      ]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }) }).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a shift's own COLUMN OUTPUT is not a finding — the line #2198's header warns about", () => {
    /* ⚠ THIS ARM FOUND A REAL DEFECT ON ITS FIRST RUN and is the reason the
       pipe rule and the derived lead exist. The first draft rejected a line
       only when it STARTED with `|`, and chose its own lead of 32; this line
       carries the phrase at lead 18 behind a mid-line pipe, so it was reported.

       It matters because the population is a shift REPORTING ON THIS VERY
       CARD — the #495/#721 lineage, third generation. A Retro reading that
       lights up every time somebody writes about cap wordings is a reading
       that gets learned and ignored. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-table.log", [
        "    743  743 log(s) | hit your foo limit - resets Nam (Australia/Bris",
        "| 748 | hit your bar limit | the real message |",
        "  shard 1 | out of 8 credits | 277.7 s",
      ]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }) }).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("but a pipe AFTER the phrase does not excuse a real message", () => {
    /* The negative half of the pipe rule: it is about what sits in FRONT of the
       condition. A provider message that happens to contain a pipe later is
       still a message, and a rule that looked anywhere in the line would have
       quietly stopped reporting it. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-pipe-after.log", [`${REAL_CAP_LINE} | retry at 4pm`]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }) }).findings).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a blockquote is a quotation, not a message", () => {
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-quote.log", ["> You've hit your weekly limit - resets Oct 14"]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }) }).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a wording the control ALREADY matches is excluded whatever shape it wears", () => {
    /* The exclusion that keeps 750 recognised caps out of the report. `out of
       credits` is one of his phrases; `out of credits entirely` wears the slot
       shape and is still matched by the bare phrase, so it is not a finding. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-known.log", ["You are out of credits entirely - nothing to do"]);
      expect(scanLogs({ dir, patterns: patterns() }).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an empty log is not a reading", () => {
    const dir = fixtureDir();
    try {
      writeFileSync(join(dir, "foreman-empty.log"), "");
      const result = scanLogs({ dir, patterns: patterns() });
      expect(result.files).toBe(1);
      expect(result.nonEmpty).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores anything that is not a *.log — the runner's json and txt are not messages", () => {
    const dir = fixtureDir();
    try {
      writeLog(dir, "seat-plan.json", [REAL_CAP_LINE]);
      writeLog(dir, "seat-prompt.txt", [REAL_CAP_LINE]);
      const result = scanLogs({ dir, patterns: patterns({ capMessage: null }) });
      expect(result.files).toBe(0);
      expect(result.findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the traps that would make a broken reader look like a clean corpus", () => {
  it("reads UTF-16LE and UTF-8 alike — 92% of the real corpus is UTF-16LE", () => {
    /* ⚠ THE SILENCE TRAP. The runner writes UTF-16LE; a reader opening those
       bytes as UTF-8 sees `Y\0o\0u\0` and matches nothing. It would sweep 3,774
       logs, find nothing, and read as a clean bill of health. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "a-utf16.log", [REAL_CAP_LINE], true);
      writeLog(dir, "b-utf8.log", [REAL_CAP_LINE], false);
      const result = scanLogs({ dir, patterns: patterns({ capMessage: null }) });
      expect(result.utf16).toBe(1);
      expect(result.findings.map((f) => f.file)).toEqual(["a-utf16.log", "b-utf8.log"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("decode strips the BOM rather than leaving it in front of the first phrase", () => {
    expect(decode(Buffer.from("\ufeffhit your weekly limit", "utf16le"))).toBe("hit your weekly limit");
    expect(decode(Buffer.from("\ufeffhit your weekly limit", "utf8"))).toBe("hit your weekly limit");
    expect(decode(Buffer.from("hit your weekly limit", "utf8"))).toBe("hit your weekly limit");
  });

  it("counts the live cap reading's own reach, so a zero is visible as a broken reader", () => {
    /* The entrance refuses to call a corpus clean when the LIVE pattern matched
       nothing in it, and this is the field that tells it. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-cap.log", [REAL_CAP_LINE], true);
      expect(scanLogs({ dir, patterns: patterns() }).liveCapMatches).toBe(1);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }) }).liveCapMatches).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the lead bounds the net — a cap shape buried in prose is not a message", () => {
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-deep.log", [`${"x".repeat(200)} hit your weekly limit`]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }) }).findings).toEqual([]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null }), lead: 250 }).findings).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the lead is HIS number, read off $CAP_HEAD, not one this reader chose", () => {
    /* ⚠ The arm for the correction itself. A line at lead 30 is inside the 32
       the first draft invented and outside the 24 his classifier measured, so
       these two readings disagree on it — which is exactly how a drifted
       constant would show up, and the thing a derived one cannot do. */
    const dir = fixtureDir();
    const line = `${"x".repeat(30)}hit your weekly limit`;
    try {
      writeLog(dir, "foreman-thirty.log", [line]);
      const his = patterns({ capMessage: null, capHead: 24 });
      expect(scanLogs({ dir, patterns: his }).findings).toEqual([]);
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null, capHead: 32 }) }).findings).toHaveLength(1);
      /* And with no `$CAP_HEAD` in the file at all, the stated fallback — which
         is his number, not a second opinion. */
      expect(scanLogs({ dir, patterns: patterns({ capMessage: null, capHead: null }) }).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("reading the patterns out of the classifier, never carrying a copy", () => {
  it("refuses a file that declares no $CAP_PATTERN rather than building an empty net", () => {
    /* ⚠ The silence direction again, one level up: an empty net reports a clean
       corpus. The two patterns that are HIS RULING must be present or the
       reading refuses. */
    const dir = fixtureDir();
    try {
      const path = join(dir, "no-cap.ps1");
      writeFileSync(path, `$TRANSIENT_PATTERN = "overloaded"\n`);
      expect(() => readClassifierPatterns(path)).toThrow(/declares no usable \$CAP_PATTERN/);

      const empty = join(dir, "empty-cap.ps1");
      writeFileSync(empty, `$CAP_PATTERN = ""\n$TRANSIENT_PATTERN = "overloaded"\n`);
      expect(() => readClassifierPatterns(empty)).toThrow(/declares no usable \$CAP_PATTERN/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts a file with no $CAP_MESSAGE and reports it as null, because that is #2198's own addition", () => {
    const dir = fixtureDir();
    try {
      const path = join(dir, "pre-2198.ps1");
      writeFileSync(path, `$CAP_PATTERN = "hit your limit"\n$TRANSIENT_PATTERN = "overloaded"\n`);
      expect(readClassifierPatterns(path)).toEqual({
        capPattern: "hit your limit",
        capMessage: null,
        transientPattern: "overloaded",
        capHead: null,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the alternation split is exact only while no alternative holds a `|` inside a group", () => {
    /* ⚠ `alternatives()` splits on a bare `|`. That is exact for the patterns as
       they stand, and SILENTLY WRONG the day somebody writes `(?:a|b) limit` —
       it would produce `(?:a` and `b) limit` and derive forms from neither. The
       arm says so by name rather than leaving a future shift to discover it. */
    for (const pattern of [HIS_CAP_PATTERN, HIS_TRANSIENT_PATTERN, CAP_MESSAGE]) {
      for (const group of pattern.match(/\((?:\?:)?[^)]*\)/g) ?? []) {
        expect(
          group,
          "an alternative now holds `|` inside a group, so `alternatives()` splits it into " +
            "nonsense and the derived net silently loses that phrase. Parse the groups, or " +
            "split only on top-level pipes.",
        ).not.toContain("|");
      }
    }
  });
});

/* ⚠ THE ARM THAT MAKES THE REST MEAN ANYTHING, and it reads the two REAL
   classifier files on disk. `.agents/` is untracked and absent in CI, so this
   block skips there and says so — which is the honest shape (CLAUDE.md:
   "env-dependent suites skip with a console message"), not a hole, because the
   fixtures above carry the same logic with the patterns as literals. */
const hasRealClassifiers = existsSync(LIVE_CLASSIFIER) && existsSync(PRE_2198_CLASSIFIER);
describe.skipIf(!hasRealClassifiers)("driven against the real classifiers on this box", () => {
  it("his phrase list, read off the live file, is the one these arms hard-code", () => {
    /* ⚠ The literals above exist so the logic arms run in CI. This is the arm
       that keeps them honest: if his ruled phrases ever move, this reddens and
       the literals are followed rather than drifting into a second list that
       passes forever. Working law 4, with the mirror made loud. */
    const live = readClassifierPatterns(LIVE_CLASSIFIER);
    expect(live.capPattern).toBe(HIS_CAP_PATTERN);
    expect(live.transientPattern).toBe(HIS_TRANSIENT_PATTERN);
    expect(live.capMessage).toBe(CAP_MESSAGE);
    expect(live.capHead).toBe(HIS_CAP_HEAD);
  });

  it("the pre-#2198 file declares no $CAP_MESSAGE, and the live one does", () => {
    expect(readClassifierPatterns(PRE_2198_CLASSIFIER).capMessage).toBeNull();
    expect(readClassifierPatterns(LIVE_CLASSIFIER).capMessage).not.toBeNull();
  });

  it("finds the four-month defect against the real pre-#2198 patterns, and nothing against the live ones", () => {
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-20261010-040545.log", [REAL_CAP_LINE], true);
      writeLog(dir, "foreman-20261009-005826.log", [REAL_SESSION_LINE], true);

      const before = scanLogs({ dir, patterns: readClassifierPatterns(PRE_2198_CLASSIFIER) });
      expect(before.findings.map((f) => f.phrase)).toEqual(["hit your limit", "hit your limit"]);

      const after = scanLogs({ dir, patterns: readClassifierPatterns(LIVE_CLASSIFIER) });
      expect(after.findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the entrance", () => {
  const SCRIPT = resolve("scripts/retro-cap-wordings.mts");

  /* ⚠ `entrance-before-the-road`: five commits of finished road, unreachable.
     Everything above drives the library. This drives the thing a Retro actually
     types, once, over fixtures and with the oracle off so no PowerShell is
     spawned inside it.

     Through `runHook`, not a bare `execFileSync` — `hookDriver.test.ts` polices
     that shape and is right to: `execFileSync` hides the child's stderr behind
     the thrown error, so an arm reading a status it never got reports a
     launcher failure as the subject's verdict. `process.execPath` + `TSX_CLI`
     needs no PATH lookup and no shell (`server/testing/tsxCli.ts`). */
  function run(args: string[]): { status: number; out: string } {
    const result = runHook(process.execPath, [TSX_CLI, SCRIPT, ...args], {
      timeout: CHILD_PROCESS_TEST_TIMEOUT_MS,
    });
    return { status: result.status, out: `${result.stdout}${result.stderr}` };
  }

  it("runs, prints its net, names the finding, and still exits 0", () => {
    /* It exits 0 whatever it finds, on purpose: it reads untracked `.agents/`
       and reports a wording nobody has seen, so it can never honestly refuse —
       the Warden log's own test for what belongs in the gate. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-cap.log", [REAL_CAP_LINE], true);
      const classifier = join(dir, "classify.ps1");
      writeFileSync(classifier, `$CAP_PATTERN = "hit your limit"\n$TRANSIENT_PATTERN = "overloaded"\n`);

      const { status, out } = run(["--logs", dir, "--classifier", classifier, "--no-classify"]);
      expect(status).toBe(0);
      expect(out).toContain("DERIVED from those phrases");
      expect(out).toContain("1 UNRECOGNISED WORDING(S)");
      expect(out).toContain("foreman-cap.log:1");
      expect(out).toContain("hit your limit");
      /* The null-$CAP_MESSAGE warning, which is what tells a reader whether 750
         findings are a control firing or a renamed variable. */
      expect(out).toContain("DECLARES NO $CAP_MESSAGE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("says nothing is wrong when nothing is, and does not call a dead reader clean", () => {
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-cap.log", [REAL_CAP_LINE], true);
      const classifier = join(dir, "classify.ps1");
      writeFileSync(
        classifier,
        `$CAP_PATTERN = "hit your limit"\n$CAP_MESSAGE = "${CAP_MESSAGE.replace(/\\/g, "\\")}"\n` +
          `$TRANSIENT_PATTERN = "overloaded"\n`,
      );
      const { status, out } = run(["--logs", dir, "--classifier", classifier, "--no-classify"]);
      expect(status).toBe(0);
      expect(out).toContain("NO UNRECOGNISED WORDINGS");
      expect(out).not.toContain("NOT A CLEAN BILL OF HEALTH");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to call a corpus clean when the live cap reading matched nothing in it", () => {
    /* The arm that would catch a decode regression or a pattern that read
       empty. A corpus with no real cap in it at all has not proved the nights
       are safe — it has proved the reader cannot read. */
    const dir = fixtureDir();
    try {
      writeLog(dir, "foreman-ordinary.log", ["a quiet night, nothing needed doing"]);
      const classifier = join(dir, "classify.ps1");
      writeFileSync(classifier, `$CAP_PATTERN = "hit your limit"\n$TRANSIENT_PATTERN = "overloaded"\n`);
      const { out } = run(["--logs", dir, "--classifier", classifier, "--no-classify"]);
      expect(out).toContain("NOT A CLEAN BILL OF HEALTH");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips rather than throwing where `.agents/` does not exist — CI, and any clone", () => {
    const dir = fixtureDir();
    try {
      const { status, out } = run([
        "--logs",
        join(dir, "nope"),
        "--classifier",
        join(dir, "nope.ps1"),
      ]);
      expect(status).toBe(0);
      expect(out).toContain("SKIPPED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a nonsense --lead rather than silently reading the whole line", () => {
    const dir = fixtureDir();
    try {
      mkdirSync(join(dir, "logs"));
      const classifier = join(dir, "classify.ps1");
      writeFileSync(classifier, `$CAP_PATTERN = "hit your limit"\n$TRANSIENT_PATTERN = "overloaded"\n`);
      const { status, out } = run([
        "--logs",
        join(dir, "logs"),
        "--classifier",
        classifier,
        "--lead",
        "banana",
      ]);
      expect(status).not.toBe(0);
      expect(out).toContain("--lead");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
