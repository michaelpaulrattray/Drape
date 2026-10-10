/**
 * THE CAP-WORDING WATCH — "we find out on the first night, not the hundredth".
 *
 * #2236's option A, which is #2198's own lesson turned into an instrument.
 *
 * ----------------------------------------------------------------------------
 * WHAT WENT WRONG, AND WHY A LIST OF FIVE WORDINGS WOULD NOT HAVE FIXED IT
 * ----------------------------------------------------------------------------
 * The runner parks the nights when the founder's Claude allowance runs out.
 * `.agents/foreman/classify-shift-failure.ps1` decides that, by matching the
 * provider's message against `$CAP_PATTERN` — a list of phrases that is HIS
 * ruling (#495, #721 option A) and is not a matcher detail a shift may extend.
 *
 * One of those phrases was `hit your limit`. The message his account actually
 * prints is:
 *
 *     You've hit your weekly limit - resets Oct 14, 4pm (Australia/Brisbane)
 *
 * ONE ADJECTIVE DEFEATED THE WHOLE CONTROL, for four months and 750 logs, and
 * nothing anywhere went red. #2198 added a second reader for that wording.
 *
 * #2236 then swept the class and named five more phrases with the same shape —
 * `limit reached`, `out of credits`, `insufficient credits`, `service
 * unavailable`, `request timed out` — each of which a modifier dropped into its
 * interior would defeat the same way. ⚠ **Not one of the five has ever appeared
 * in the corpus**, so widening the parking control to cover them would put five
 * unobserved wordings into the one control that stops the team instantly. The
 * asymmetry is the whole argument: a missed cap costs one extra 15-minute
 * back-off; a false cap stops the nights.
 *
 * ----------------------------------------------------------------------------
 * SO THIS IS A REPORTER, AND THAT IS THE DESIGN RATHER THAN A LIMITATION
 * ----------------------------------------------------------------------------
 * It never parks anything, never edits the classifier, and never decides what
 * counts as a cap. It answers one question on the Retro's clock:
 *
 *     Is there a log on disk whose line LOOKS like a cap or transient message
 *     the live patterns cannot match?
 *
 * Because it only prints, its net can afford to be far looser than the control
 * it watches — a false positive costs one line of output. That is the inversion
 * that makes option A work where option B could not.
 *
 * ⚠ **AND THE NET IS DERIVED FROM THE CLASSIFIER'S OWN PHRASES, NOT FROM
 * #2236's LIST OF FIVE.** `slotTolerantForms` reads each phrase out of the file
 * on disk and builds the form that admits one or two extra interior words. Two
 * consequences, and the second is the point of doing it this way:
 *
 *   1. It reproduces #2198's repair from first principles: his phrase `hit your
 *      limit` derives the form `hit\s+your\s+(?:[\w-]+\s+){1,2}limit`, which is
 *      `$CAP_MESSAGE` with `\s+` where #2198 wrote a literal space. ⚠ **Not
 *      character for character, and the arm asserts the thing that matters
 *      instead of the thing that reads better**: the derived form MATCHES the
 *      real message that defeated the control, and his unmodified phrase does
 *      not. **This instrument, had it existed, would have named the defect on
 *      the first night** — and the proof of that is not an argument, it is
 *      `capWordingWatch.test.ts` pointed at the real pre-fix classifier.
 *   2. A SIXTH phrase added to `$CAP_PATTERN` next year gets its trigger for
 *      free. A reader keyed on the five hand-listed siblings would stop
 *      watching the moment the list moved — `fix-drops-subject-from-guard`.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS IS A SECOND READING AND NOT A MIRROR (working law 4's precondition)
 * ----------------------------------------------------------------------------
 * `Test-CapDeclared` in the classifier asks *"is this log a cap declaration?"*
 * and is deliberately narrow — a short lead, quotations removed — because its
 * answer parks the team. This file asks a DIFFERENT question: *"is this log
 * carrying a message shape the narrow reading cannot see?"* Law 4 forbids a
 * second list shadowing a source of truth; it does not forbid a second reader
 * answering a different question, and deriving this answer from a set built for
 * the other one would be the silent behaviour change (`derive-only-when-the-
 * question-matches`). What is NEVER copied is the thing that would actually
 * drift: every phrase, lead and pattern is read out of the .ps1 at run time.
 *
 * ----------------------------------------------------------------------------
 * THE ENCODING TRAP
 * ----------------------------------------------------------------------------
 * The runner writes its logs UTF-16LE. Measured 2026-10-11: **3,483 of the
 * 3,774 non-empty logs carry a `ff fe` BOM**, and the rest are plain UTF-8. A
 * reader that opens them as UTF-8 sees `S\0e\0s\0s\0` and matches nothing —
 * it would sweep the whole corpus, find nothing, and read as a clean bill of
 * health. The decode below is BOM-first for that reason.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Where the patterns live, and the only place they are allowed to live. */
export const DEFAULT_CLASSIFIER = ".agents/foreman/classify-shift-failure.ps1";
/** Where the runner writes what it is asked about. */
export const DEFAULT_LOG_DIR = ".agents/shift-logs";

/**
 * The lead used when the classifier declares no `$CAP_HEAD` to read.
 *
 * ⚠ **THIS NUMBER IS NOT THIS FILE'S TO CHOOSE, AND THE FIRST DRAFT CHOSE IT
 * ANYWAY — 32, on the reasoning that an unobserved wording might carry a longer
 * prefix than the two observed ones, and that the corpus separates itself (the
 * real message family at lead 0–10, every prose mention at 61 or deeper, with
 * nothing between).** The measurement was real and the conclusion was wrong,
 * because the population it surveyed was PROSE. This suite's own negative
 * control found the shape it had missed on the first run: a shift's own
 * measurement output —
 *
 *     743  743 log(s) | hit your foo limit - resets Nam (Australia/Bris
 *
 * — puts the phrase at lead **18**, which is neither prose nor a message, and
 * #2198's header warns about this exact line. So the lead is now READ out of
 * `$CAP_HEAD`, which is his classifier's own answer to precisely this question
 * and is measured against the real prefixes error lines carry (`"Claude AI "`
 * 10, `"Your Claude "` 12, `"The run stopped: "` 17, `"request failed with "`
 * 20). A number derived from the control it watches cannot drift from it; one
 * invented here can, and had.
 *
 * 24 is only the fallback for a file that declares no `$CAP_HEAD`, and it is
 * `$CAP_HEAD`'s own value at the time of writing rather than a second opinion.
 * `--lead` moves it for a deliberate wider sweep.
 */
export const FALLBACK_LEAD = 24;

export type ClassifierPatterns = {
  /** `$CAP_PATTERN` — his seven spelled-out conditions plus the 429 anchors. */
  capPattern: string;
  /**
   * `$CAP_MESSAGE` — #2198's second reader for the real wording, or `null`
   * where the file does not declare one. See `readClassifierPatterns`.
   */
  capMessage: string | null;
  /** `$TRANSIENT_PATTERN` — "busy, not broken". */
  transientPattern: string;
  /**
   * `$CAP_HEAD` — his own measured answer to "how far in may a condition sit
   * and still be an error line", used as this reader's lead. `null` where the
   * file declares none, in which case `FALLBACK_LEAD` stands in.
   */
  capHead: number | null;
};

/**
 * Read the patterns out of the PowerShell source.
 *
 * ⚠ **THE TWO PATTERNS THAT ARE HIS RULING ARE REQUIRED AND THROW WHEN
 * ABSENT.** A collector that can come up empty must refuse rather than return a
 * short list (CLAUDE.md's Atlas lesson). A watch that silently read
 * `$CAP_PATTERN` as the empty string would build an empty net and report a
 * clean corpus — the silence direction, on the control that stops the nights.
 *
 * ⚠ **`$CAP_MESSAGE` IS DELIBERATELY OPTIONAL, AND THE DECISION IS LOAD-BEARING
 * TWICE.** It is #2198's implementation of his ruling, not one of the ruled
 * phrases, so a later card that folds it back into `$CAP_PATTERN` is an
 * entirely reasonable thing to do — and requiring it here would mean this
 * reading THROWS on that day and the Retro silently loses it. The fail
 * direction is right too: without it the live-cap exclusion is NARROWER, so the
 * watch reports MORE, which for a reporter is noise rather than silence. The
 * entrance says out loud when it is absent, because "absent" and "renamed and
 * now reporting 754 false findings" look identical in a finding list.
 *
 * It is also what lets this reader be pointed at `classify-shift-failure.
 * before-2198.ps1` — the real pre-fix artifact, which declares no
 * `$CAP_MESSAGE` — and that is this instrument's strongest control: against
 * that file the whole 754-log cap population must light up as findings, which
 * is #2198's defect reproduced rather than argued.
 */
export function readClassifierPatterns(path: string): ClassifierPatterns {
  const text = readFileSync(path, "utf8");
  const read = (name: string): string | null => {
    const m = text.match(new RegExp("^\\$" + name + '\\s*=\\s*"([^"]*)"', "m"));
    return m ? m[1] : null;
  };
  const required = (name: string): string => {
    const value = read(name);
    if (value === null || value.length === 0) {
      throw new Error(
        `${path} declares no usable $${name} — expected a line '$${name} = "…"'. ` +
          "This watch reads every phrase out of that file rather than carrying a copy, " +
          "so a renamed variable is followed here rather than silently skipped: an empty " +
          "net would report a clean corpus, which is the one answer this reading must " +
          "never give by accident.",
      );
    }
    return value;
  };
  /* `$CAP_HEAD = 24` — a bare integer, not a quoted string, so its own read. */
  const headMatch = text.match(/^\$CAP_HEAD\s*=\s*(\d+)\s*$/m);
  return {
    capPattern: required("CAP_PATTERN"),
    capMessage: read("CAP_MESSAGE"),
    transientPattern: required("TRANSIENT_PATTERN"),
    capHead: headMatch ? Number.parseInt(headMatch[1], 10) : null,
  };
}

/** A plain-word phrase: two or more words, no regex metacharacters at all. */
const PLAIN_PHRASE = /^[a-z]+(?: [a-z]+)+$/;

/**
 * Split a PowerShell alternation into its alternatives.
 *
 * The patterns contain no groups with `|` inside them today (`(?: code)?` is
 * the only group and holds none), so a plain split is exact. It is asserted in
 * the suite against the real file rather than assumed here, because the day
 * somebody writes `(?:a|b) limit` this split silently produces two nonsense
 * alternatives — and the suite's arm says so by name.
 */
export function alternatives(pattern: string): string[] {
  return pattern.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
}

export type SlotForm = {
  /** The phrase exactly as the classifier spells it. */
  phrase: string;
  /** The form that admits one or two extra interior words, as a source string. */
  source: string;
  /** Where the interior slot was opened — the word index the modifier precedes. */
  afterWord: number;
};

/**
 * For each plain-word phrase, the forms a provider's modifier could produce.
 *
 * A modifier lands BETWEEN two words of the phrase. `hit your limit` has one
 * interior boundary that matters (`your`→`limit`) and yields `hit your <mod>
 * limit`; a three-word phrase has two. A modifier in FRONT of the phrase is not
 * a defeat at all — "weekly usage limit" still contains "usage limit" — which
 * is exactly why this is a small class and not a panic about every string.
 *
 * `[\w-]+` and `{1,2}`, copied in spirit from `$CAP_MESSAGE`'s own comment: an
 * adjective may be hyphenated ("5-hour") or doubled ("weekly Opus"). `{1,2}`
 * and not `{0,2}`, because the zero case IS the phrase and the live pattern
 * already matches it — a `{0,2}` form would report every real cap as a finding.
 */
export function slotTolerantForms(pattern: string): SlotForm[] {
  const out: SlotForm[] = [];
  for (const phrase of alternatives(pattern)) {
    if (!PLAIN_PHRASE.test(phrase)) continue;
    const words = phrase.split(" ");
    for (let i = 1; i < words.length; i++) {
      const head = words.slice(0, i).join("\\s+");
      const tail = words.slice(i).join("\\s+");
      out.push({
        phrase,
        source: `${head}\\s+(?:[\\w-]+\\s+){1,2}${tail}`,
        afterWord: i,
      });
    }
  }
  return out;
}

export type Finding = {
  /** The log's filename, never its contents. */
  file: string;
  /** 1-based line number, so the reader can be sent straight to it. */
  line: number;
  /** How far into the line the shape sits. */
  lead: number;
  /** Which of the classifier's phrases this is a slot-filled form of. */
  phrase: string;
  /** `cap` or `transient` — which control the wording would have to join. */
  shape: "cap" | "transient";
  /** The line itself, trimmed and capped, so the repair has its fixture. */
  text: string;
};

export type ScanResult = {
  /** Every `*.log` in the directory. */
  files: number;
  /** Those with bytes in them — an empty log is not a reading. */
  nonEmpty: number;
  /** How many were UTF-16LE, so a zero here is visible as the trap it is. */
  utf16: number;
  /** Logs the LIVE cap reading would match somewhere — the watch's own control. */
  liveCapMatches: number;
  /** The forms the net was built from, so the report can show its own net. */
  forms: { cap: SlotForm[]; transient: SlotForm[] };
  /** Unrecognised wordings, worst-first by nothing — in file order. */
  findings: Finding[];
};

/** BOM-first, because 92% of the corpus is UTF-16LE. See the header. */
export function decode(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le").slice(1);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.toString("utf8").slice(1);
  return buf.toString("utf8");
}

/**
 * Strip the furniture a shift's own markdown puts in front of a phrase.
 *
 * This is the reader's OWN reading and not a copy of `Test-CapDeclared`'s — see
 * the header. It is looser on purpose in one direction (it keeps going after a
 * fence, since a log is not a markdown document) and identical in the one that
 * matters: a table row, a blockquote and a list marker are a shift writing
 * ABOUT a message, never a provider printing one.
 */
function stripFurniture(raw: string): string | null {
  if (/^\s*\|/.test(raw)) return null; // a table row is a shift's own output
  if (/^\s*>/.test(raw)) return null; // a blockquote is a quotation
  let s = raw.replace(/`[^`]*`/g, ""); // an inline code span is a quotation
  s = s.replace(/^[\s>\-*+#|]+/, "");
  s = s.replace(/^\d+[.)]\s*/, "");
  s = s.replace(/^[\s*_]+/, "");
  return s;
}

export type ScanOptions = {
  dir: string;
  patterns: ClassifierPatterns;
  lead?: number;
};

/**
 * Walk the corpus and report every cap- or transient-SHAPED line the live
 * patterns cannot match.
 *
 * ⚠ **A finding needs no oracle to be certain, and that is why this returns one
 * without consulting the classifier.** If a line matches none of the live
 * patterns anywhere, then `Test-CapDeclared` — which can only ever be NARROWER
 * than a bare pattern test — cannot possibly call it a cap. So a finding here
 * is a wording the control provably does not recognise. The entrance still runs
 * the real classifier over each finding, because a printed verdict from the
 * real control is a fact where this reasoning is an inference (working law 1).
 */
export function scanLogs(options: ScanOptions): ScanResult {
  const { capPattern, capMessage, transientPattern, capHead } = options.patterns;
  /* His own measured lead, read off the file; `FALLBACK_LEAD` only where the
     file declares none. See `FALLBACK_LEAD`'s note for why this reader does not
     choose its own number. */
  const lead = options.lead ?? capHead ?? FALLBACK_LEAD;

  /* The live patterns, used ONLY to exclude what is already recognised. Not a
     reimplementation of the classifier's decision — a necessary condition of
     it. `$CAP_MESSAGE` may legitimately be absent (see
     `readClassifierPatterns`), in which case the exclusion is narrower and the
     watch reports more. */
  const liveCap =
    capMessage === null
      ? new RegExp(capPattern, "i")
      : new RegExp(`(?:${capPattern})|(?:${capMessage})`, "i");
  const liveTransient = new RegExp(transientPattern, "i");

  const forms = {
    cap: [
      ...slotTolerantForms(capPattern),
      ...(capMessage === null ? [] : slotTolerantForms(capMessage)),
    ],
    transient: slotTolerantForms(transientPattern),
  };
  const nets: Array<{ shape: "cap" | "transient"; form: SlotForm; re: RegExp }> = [];
  for (const shape of ["cap", "transient"] as const) {
    for (const form of forms[shape]) {
      nets.push({ shape, form, re: new RegExp(`^.{0,${lead}}?(${form.source})`, "i") });
    }
  }

  const names = readdirSync(options.dir).filter((n) => n.endsWith(".log")).sort();
  const result: ScanResult = {
    files: names.length,
    nonEmpty: 0,
    utf16: 0,
    liveCapMatches: 0,
    forms,
    findings: [],
  };

  for (const name of names) {
    const path = join(options.dir, name);
    if (statSync(path).size === 0) continue;
    result.nonEmpty++;
    const buf = readFileSync(path);
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) result.utf16++;
    const text = decode(buf);
    if (liveCap.test(text)) result.liveCapMatches++;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const stripped = stripFurniture(lines[i]);
      if (stripped === null || stripped.length === 0) continue;
      for (const net of nets) {
        const m = stripped.match(net.re);
        if (!m) continue;
        const at = stripped.indexOf(m[1]);
        /* ⚠ A PIPE BEFORE THE PHRASE IS A SHIFT'S OWN COLUMN, NOT A PROVIDER'S
           MESSAGE — and this rule exists because the suite's negative control
           caught its absence. `Test-CapDeclared` already rejects a line that
           STARTS with `|` on exactly this ground ("a table row is furniture,
           not an error line"); the shape that got through was a shift's
           measurement output, where the pipe sits mid-line:

               743  743 log(s) | hit your foo limit - resets Nam (Australia/Bris

           So this extends his ruled judgement from "starts with" to "has one
           in front of the phrase", rather than inventing a new one.

           The residual, stated rather than discovered: a real provider message
           carrying a `|` before its condition would be missed. None of the
           observed prefixes has one (`You've `, `Claude AI `, `HTTP/1.1 `,
           `{"type":"`), and the cost of being wrong here is a later discovery
           in a REPORTER — the same one-extra-back-off asymmetry the classifier
           reasons from, where the cost of being wrong the other way is a Retro
           reading that lights up every time a shift writes about this card and
           is therefore learned to be ignored. */
        if (at > 0 && stripped.slice(0, at).includes("|")) continue;
        /* Already recognised by the control? Then it is not a finding, whatever
           shape it wears. This is the one test that keeps the 750 real caps out
           of the report. */
        const live = net.shape === "cap" ? liveCap : liveTransient;
        if (live.test(stripped)) continue;
        const trimmed = stripped.trim();
        result.findings.push({
          file: name,
          line: i + 1,
          lead: at < 0 ? 0 : at,
          phrase: net.form.phrase,
          shape: net.shape,
          text: trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed,
        });
        break; // one finding per line; the phrase named is enough to repair it
      }
    }
  }
  return result;
}
