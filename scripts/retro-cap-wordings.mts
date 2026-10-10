/**
 * `pnpm retro:cap-wordings` — the Retro's standing per-run reading (#2236).
 *
 * Prints every shift log carrying a cap- or transient-SHAPED line that the
 * live patterns in `.agents/foreman/classify-shift-failure.ps1` cannot match —
 * i.e. the next wording that would defeat the park-at-the-cap control the way
 * `hit your WEEKLY limit` defeated `hit your limit` for four months (#2198).
 *
 * The whole argument, the derivation of the net, and why this is a reporter
 * rather than a widening of the control are in `lib/capWordingWatch.mts`.
 *
 * ----------------------------------------------------------------------------
 * IT EXITS 0 WHATEVER IT FINDS, AND IT IS NOT A GATE ARM
 * ----------------------------------------------------------------------------
 * The Warden log's own test for this: *"a reading belongs in the gate when it
 * can honestly REFUSE, and beside the patrol's reading when it cannot."* This
 * one cannot. It reads untracked `.agents/`, which CI does not have, and a
 * finding is intelligence about a wording nobody has seen rather than a fault
 * somebody can be held to. ⚠ It would also be the exact loop #2164 measured —
 * *"the gate gets slower each time a shift fixes a tooling bug"* — for a
 * reading no pull request needs.
 *
 * Usage:
 *   pnpm retro:cap-wordings                    # the whole corpus
 *   pnpm retro:cap-wordings --lead 48          # a roomier net
 *   pnpm retro:cap-wordings --no-classify      # skip the oracle below
 *   pnpm retro:cap-wordings --logs <dir> --classifier <path>
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_CLASSIFIER,
  DEFAULT_LOG_DIR,
  FALLBACK_LEAD,
  readClassifierPatterns,
  scanLogs,
  type Finding,
} from "./lib/capWordingWatch.mts";

function parseArgs(argv: string[]): {
  logs: string;
  classifier: string;
  /** `null` means "take the classifier's own `$CAP_HEAD`" — the default. */
  lead: number | null;
  classify: boolean;
} {
  const flags = new Map<string, string>();
  let classify = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--no-classify") {
      classify = false;
      continue;
    }
    if (argv[i].startsWith("--")) flags.set(argv[i], argv[i + 1] ?? "");
  }
  const lead = flags.has("--lead") ? Number.parseInt(flags.get("--lead") ?? "", 10) : null;
  if (lead !== null && (!Number.isFinite(lead) || lead < 0)) {
    throw new Error(`--lead wants a non-negative number, got ${JSON.stringify(flags.get("--lead"))}`);
  }
  return {
    logs: resolve(flags.get("--logs") ?? DEFAULT_LOG_DIR),
    classifier: resolve(flags.get("--classifier") ?? DEFAULT_CLASSIFIER),
    lead,
    classify,
  };
}

/**
 * Ask the REAL control what it makes of a finding.
 *
 * The finding is already certain without this (see `scanLogs`'s note), so this
 * is here for working law 1: the report quotes the control's own `class=`
 * rather than this script's reasoning about it. ⚠ It is also the half that
 * cannot run in CI or on a POSIX box, so a failure to consult is REPORTED
 * beside the finding and never allowed to drop it.
 */
function classOf(classifier: string, log: string): string {
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", classifier, "-Log", log],
      { encoding: "utf8", timeout: 60_000 },
    );
    const m = out.match(/class=(\w+)/);
    return m ? m[1] : `unparseable (${out.trim().slice(0, 60)})`;
  } catch (error) {
    return `not consulted (${error instanceof Error ? error.message.split("\n")[0] : String(error)})`;
  }
}

function main(argv: string[]): number {
  const args = parseArgs(argv);

  if (!existsSync(args.classifier)) {
    console.log(`SKIPPED — no classifier at ${args.classifier}.`);
    console.log("  The patterns live in untracked `.agents/`, so this reading only runs on a box");
    console.log("  that has the runner. Nothing is wrong; there is simply nothing to read.");
    return 0;
  }
  if (!existsSync(args.logs)) {
    console.log(`SKIPPED — no log directory at ${args.logs}. Same reason as above.`);
    return 0;
  }

  const patterns = readClassifierPatterns(args.classifier);
  const result = scanLogs({ dir: args.logs, patterns, lead: args.lead ?? undefined });
  /* Printed rather than assumed: a reader has to be able to see WHOSE number
     the lead is, because a lead invented in this file is the thing that
     drifted once already. */
  const lead = args.lead ?? patterns.capHead ?? FALLBACK_LEAD;
  const leadSource = args.lead !== null ? "--lead" : patterns.capHead !== null ? "$CAP_HEAD" : "fallback";

  console.log(`read out of ${args.classifier} (never copied):`);
  console.log(`  $CAP_PATTERN       ${patterns.capPattern}`);
  console.log(`  $CAP_MESSAGE       ${patterns.capMessage ?? "— ABSENT (see below)"}`);
  console.log(`  $TRANSIENT_PATTERN ${patterns.transientPattern}`);
  if (patterns.capMessage === null) {
    console.log("");
    console.log("⚠ THAT FILE DECLARES NO $CAP_MESSAGE, SO READ THE FINDINGS BELOW TWICE.");
    console.log("  Either it is the pre-#2198 classifier (in which case the whole real cap");
    console.log("  population SHOULD appear below, and that is this watch's own control), or");
    console.log("  somebody renamed the live one — in which case the findings are the watch");
    console.log("  reporting hundreds of messages the control does recognise. The two look");
    console.log("  identical in a list, so the file path above is the thing to check first.");
  }
  console.log("");
  console.log(
    `the net, DERIVED from those phrases: ${result.forms.cap.length} cap form(s), ` +
      `${result.forms.transient.length} transient form(s), lead ${lead} (from ${leadSource})`,
  );
  for (const form of [...result.forms.cap, ...result.forms.transient]) {
    console.log(`  ${form.phrase.padEnd(22)} -> ${form.source}`);
  }
  console.log("");
  console.log(
    `corpus: ${result.files} *.log, ${result.nonEmpty} non-empty, ${result.utf16} UTF-16LE, ` +
      `${result.liveCapMatches} matched by the live cap reading somewhere`,
  );

  /* The watch's own control, and it is the arm that would catch a decode or a
     pattern-read failure reading as a clean corpus. A reader that saw no real
     cap at all has not proved the nights are safe — it has proved it cannot
     read. */
  if (result.nonEmpty > 0 && result.liveCapMatches === 0) {
    console.log("");
    console.log("⚠ NOT A CLEAN BILL OF HEALTH — the live cap reading matched NOTHING in this corpus.");
    console.log("  Every corpus this has ever been pointed at holds hundreds of real cap messages,");
    console.log("  so zero means this reader is broken (a decode, or a pattern that read empty),");
    console.log("  not that the wordings are all recognised. Read it before trusting the findings.");
  }

  if (result.findings.length === 0) {
    console.log("");
    console.log("NO UNRECOGNISED WORDINGS — every cap- and transient-shaped line in the corpus is one");
    console.log("the live patterns already match. #2236's five siblings stay theoretical.");
    return 0;
  }

  console.log("");
  console.log(`${result.findings.length} UNRECOGNISED WORDING(S) — each is a one-line addition to the`);
  console.log("pattern it names, and WHETHER to add it is his ruling (#495, #721), not a shift's.");
  const verdicts = new Map<string, string>();
  for (const f of result.findings as Finding[]) {
    if (args.classify && !verdicts.has(f.file)) {
      verdicts.set(f.file, classOf(args.classifier, resolve(args.logs, f.file)));
    }
    const verdict = args.classify ? verdicts.get(f.file) : "not asked (--no-classify)";
    console.log("");
    console.log(`  ${f.file}:${f.line}  (${f.shape} shape, lead ${f.lead})`);
    console.log(`    the phrase it would have to join: ${f.phrase}`);
    console.log(`    the real classifier says:         class=${verdict}`);
    console.log(`    the line:                         ${f.text}`);
  }
  console.log("");
  console.log("A `class=CAP` verdict beside a finding means the control catches it by another");
  console.log("phrase and only the NET was loose — report it, do not widen anything. A");
  console.log("`class=GENUINE` verdict is #2198's defect happening again: file it with this line");
  console.log("as the fixture.");
  return 0;
}

process.exit(main(process.argv.slice(2)));
