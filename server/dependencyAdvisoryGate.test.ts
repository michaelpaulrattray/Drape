/**
 * THE GATE'S KNOWN-VULNERABILITY READER, DRIVEN (#1805).
 *
 * Three things are proven here and they answer different questions:
 *
 *   1. **IT CAN GO RED, ON THE REAL INSTANCE.** The positive control is `pnpm
 *      audit --prod --json` run against the lockfile as it stood at
 *      `dfdcc3a33` — the commit PR #1599 merged — captured whole and unedited.
 *      A green suite over an invented fixture would prove only that the parser
 *      parses (working law 2).
 *   2. **IT REFUSES RATHER THAN PASSES** when it cannot read the report. This is
 *      the direction that matters: a gate step that passes because it could not
 *      look is invariant 7's defect, and it is also how a registry outage would
 *      arrive.
 *   3. **THE CALL SITE EXISTS AND IS IN A JOB THAT BLOCKS.** The card's whole
 *      subject is a reader that spoke too late; a fix for that which itself sits
 *      in an unreachable place would be the same death in a new coat.
 *
 * Every read here is of a FIXED path with a bare `readFileSync`, on
 * `eyeFrameGate.test.ts`'s reasoning: nothing is walked, and a missing subject
 * must THROW rather than let an arm pass over a file it could not open.
 *
 * ⚠ **NOTHING HERE TOUCHES THE NETWORK.** A unit suite that asked the registry
 * would be red on an aeroplane. The live reading is the gate step's job, which is
 * exactly where it belongs.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* ⚠ THIS SUITE SPAWNS SINCE #1899: the tree-line arms drive REAL git in this
   repository rather than a fixture of what git is believed to print, because
   the format is the assumption most likely to be wrong. So it declares the
   class's timeout rather than racing vitest's 5 s default under a parallel
   run (#548) — and `childProcessTestTimeouts` is what noticed it joined the
   population, which is the guard doing exactly its job. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

import {
  type Acknowledgement,
  ACKNOWLEDGED_ADVISORIES,
  advisoryDevNotice,
  advisoryPass,
  advisoryRefusal,
  AUDIT_ARGUMENTS,
  DEV_AUDIT_ARGUMENTS,
  judgeAdvisories,
  OUTAGE_GUIDANCE,
  readAuditReport,
  readTreeFromRevList,
  advisoryTreeLine,
} from "../scripts/lib/dependencyAdvisories.mts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), "utf8");

/*
  THE TWO REAL REPORTS.

  `pnpm-audit-prod-dfdcc3a3.json` is the output of `pnpm audit --prod --json` run
  against `package.json` + `pnpm-lock.yaml` extracted from `dfdcc3a33` (the
  #1599 merge) into a scratch directory — 28,619 bytes, byte-identical to the
  captured run, no field removed. The clean one is the same command on this tree
  on 2026-10-03.
*/
const PREPATCH = read("server/__fixtures__/pnpm-audit-prod-dfdcc3a3.json");
const CLEAN = read("server/__fixtures__/pnpm-audit-prod-clean.json");

/*
  THE TWO CAPTURED OUTAGES (#1856).

  An outage of the real registry cannot be summoned, so these were DRIVEN rather
  than written: `pnpm audit --prod --json --registry …` pointed first at a dead
  port (`127.0.0.1:9`) and then at a local HTTP server standing in for the audit
  endpoint, on pnpm 10.28.2 / Node 24.18.0, captured whole and unedited. Five
  shapes were driven in that sitting — ECONNREFUSED, a captive portal's HTML, a
  503, a 429 and a 500 — and ALL FIVE answered with valid JSON on stdout carrying
  an `error` object, with stderr at zero bytes. These two are the extremes of
  that set: a transport failure that never reached an endpoint, and an endpoint
  that answered badly.

  ⚠ They are the reason this card exists. Every one of the five used to land on
  the `advisories`-is-missing refusal, which named a key and not a cause.
*/
const OUTAGE_ECONNREFUSED = read("server/__fixtures__/pnpm-audit-outage-econnrefused.json");
const OUTAGE_BAD_RESPONSE = read("server/__fixtures__/pnpm-audit-outage-bad-response.json");

/** The two the card names, and the two whose severity is `high`. */
const CARD_HIGHS = ["GHSA-6j4f-fj2g-mc7p", "GHSA-qhr7-859c-m2p7"];

const reportOf = (text: string) => {
  const result = readAuditReport(text);
  if (!result.ok) throw new Error(`fixture did not read: ${result.why}`);
  return result.report;
};

describe("⚠ POSITIVE CONTROL — the step would have reddened PR #1599", () => {
  it("reads all four advisories out of the real pre-patch report", () => {
    const report = reportOf(PREPATCH);
    expect(report.advisories).toHaveLength(4);
    expect(report.counts).toEqual({ info: 0, low: 1, moderate: 1, high: 2, critical: 0 });
    expect(report.dependencies).toBe(478);
  });

  it("REFUSES that report, naming both highs the card is about", () => {
    const verdict = judgeAdvisories(reportOf(PREPATCH), []);
    expect(verdict.ok).toBe(false);
    expect(verdict.blocking).toHaveLength(4);

    const blockedIds = verdict.blocking.map((advisory) => advisory.ghsa);
    for (const ghsa of CARD_HIGHS) expect(blockedIds).toContain(ghsa);

    /* And both of those are HIGH in the report itself, not just present in it —
       the claim on the card is about severity, so the arm reads severity. */
    for (const ghsa of CARD_HIGHS) {
      expect(verdict.blocking.find((advisory) => advisory.ghsa === ghsa)?.severity).toBe("high");
    }
  });

  it("the refusal carries the chain, the fix version and what to DO", () => {
    const text = advisoryRefusal(judgeAdvisories(reportOf(PREPATCH), []));
    /* The dependency chain is what tells a reader WHICH change brought it in —
       here, the Sentry bundler plug-in #1599 added. */
    expect(text).toContain("@sentry/node>@sentry/bundler-plugins>glob>minimatch>brace-expansion");
    expect(text).toContain("patched in: >=5.0.12");
    expect(text).toContain("pnpm.overrides");
    expect(text).toContain("ACKNOWLEDGED_ADVISORIES");
    /* It must say its severity in a form a reader scanning a log will catch. */
    expect(text).toContain("HIGH · brace-expansion");
  });

  it("⚠ it also catches one nobody in this program had noticed — dompurify", () => {
    /*
      Not decoration: it is the evidence that the reader is not fitted to the two
      advisories the card happens to name. The `jspdf>dompurify` low was in the
      same pre-patch tree and no card, patrol or report mentions it.
    */
    const verdict = judgeAdvisories(reportOf(PREPATCH), []);
    const dompurify = verdict.blocking.find((advisory) => advisory.module === "dompurify");
    expect(dompurify?.ghsa).toBe("GHSA-p98j-92pf-mc4p");
    expect(dompurify?.paths).toContain(".>jspdf>dompurify");
  });
});

describe("NEGATIVE CONTROL — a clean tree passes, and says what it read", () => {
  it("today's real report has no advisories and is a PASS", () => {
    const report = reportOf(CLEAN);
    expect(report.advisories).toHaveLength(0);
    const verdict = judgeAdvisories(report, []);
    expect(verdict.ok).toBe(true);
    expect(advisoryRefusal(verdict)).toBe("");
  });

  it("the pass line names the scope AND the limit, so a green is not read as coverage", () => {
    const report = reportOf(CLEAN);
    const text = advisoryPass(report, judgeAdvisories(report, []));
    expect(text).toContain("478 production dependencies");
    /*
      ⚠ THIS ARM PINNED *"devDependencies are NOT read here"* UNTIL #2703, AND
      THAT SENTENCE WOULD HAVE BECOME FALSE THE MOMENT THE DEV READING LANDED.

      Keeping it would have been the exact shape law 7c exists for — a guard
      holding the product to a claim the product had stopped making. What the
      arm is actually FOR survives unchanged: a green must not read as
      coverage, so the line still says what this verdict is OF.
    */
    expect(text).toContain("this verdict is the PRODUCTION tree alone");
    expect(text).toContain("WARN ONLY");
    expect(text).not.toContain("devDependencies are NOT read here");
  });
});

describe("the acknowledgement road — an exemption is written down, and only shrinks", () => {
  const signFor = (ghsa: string): Acknowledgement => ({
    ghsa,
    module: "brace-expansion",
    why: "a fixture's reason, not a real one",
    since: "2026-10-03",
    card: "#1805",
  });

  it("a signed advisory stops blocking, and its siblings still do", () => {
    const verdict = judgeAdvisories(reportOf(PREPATCH), [signFor(CARD_HIGHS[0])]);
    expect(verdict.ok).toBe(false);
    expect(verdict.acknowledged.map((advisory) => advisory.ghsa)).toEqual([CARD_HIGHS[0]]);
    expect(verdict.blocking).toHaveLength(3);
    expect(verdict.blocking.map((advisory) => advisory.ghsa)).not.toContain(CARD_HIGHS[0]);
  });

  it("signing every one of them is a PASS — the control on the arm above", () => {
    const report = reportOf(PREPATCH);
    const all = report.advisories.map((advisory) => signFor(advisory.ghsa!));
    const verdict = judgeAdvisories(report, all);
    expect(verdict.ok).toBe(true);
    expect(verdict.blocking).toHaveLength(0);
    expect(advisoryPass(report, verdict)).toContain("4 acknowledged and standing");
  });

  it("⚠ a STALE acknowledgement refuses, even over a perfectly clean report", () => {
    /*
      The failure this forbids: an override closes the hole, the exemption stays,
      and it quietly becomes a standing permission for the next time that advisory
      id appears. The capability atlas's KNOWN_DEBTS works exactly this way.
    */
    const verdict = judgeAdvisories(reportOf(CLEAN), [signFor("GHSA-dead-beef-0000")]);
    expect(verdict.ok).toBe(false);
    expect(verdict.blocking).toHaveLength(0);
    expect(verdict.stale.map((entry) => entry.ghsa)).toEqual(["GHSA-dead-beef-0000"]);
    expect(advisoryRefusal(verdict)).toContain("no longer carries");
    expect(advisoryRefusal(verdict)).toContain("the list only shrinks");
  });

  it("an acknowledgement is matched on the advisory id, never on the package name", () => {
    /* A module-name match would let a renamed package re-open a signed hole. */
    const signedWrong: Acknowledgement = { ...signFor("GHSA-not-in-this-report"), module: "brace-expansion" };
    const verdict = judgeAdvisories(reportOf(PREPATCH), [signedWrong]);
    expect(verdict.blocking).toHaveLength(4);
    expect(verdict.stale).toHaveLength(1);
  });

  it("the shipped list is EMPTY, which is the measured state of this tree", () => {
    /*
      If this arm ever reddens, somebody has signed for a hole — which is allowed,
      and is exactly the moment a reader should be made to look at this file.
    */
    expect(ACKNOWLEDGED_ADVISORIES).toHaveLength(0);
  });
});

describe("⚠ IT REFUSES RATHER THAN PASSING — the only direction that is dangerous", () => {
  const whyOf = (text: string): string => {
    const result = readAuditReport(text);
    expect(result.ok, `this should not have read as a report: ${text.slice(0, 60)}`).toBe(false);
    return result.ok ? "" : result.why;
  };

  it("printed nothing", () => {
    expect(whyOf("")).toContain("printed nothing");
    expect(whyOf("   \n  ")).toContain("printed nothing");
  });

  it("prose instead of JSON must never pass — whatever prints it", () => {
    /*
      ⚠ THIS ARM'S TITLE AND COMMENT USED TO CLAIM THIS WAS "how an offline or
      rate-limited CI runner actually arrives". That was reasoned, and #1856 drove
      it: it is not. Under `--json`, pnpm 10.28.2 puts
      `ERR_PNPM_AUDIT_BAD_RESPONSE` in a JSON `error` object (see
      `OUTAGE_BAD_RESPONSE`) and prints no loose prose at all — five failure
      shapes out of five.

      The ARM is kept exactly as it was, and deliberately: a fail-closed reader
      must not depend on which shape arrives, and a wrapper, a proxy or the next
      pnpm could put a line on stdout tomorrow. What changed is only the claim
      about which road an outage takes.
    */
    const why = whyOf("ERR_PNPM_AUDIT_BAD_RESPONSE  The audit endpoint returned a non-JSON response");
    expect(why).toContain("did not answer with JSON");
    expect(why).toContain("ERR_PNPM_AUDIT_BAD_RESPONSE");
  });

  it("JSON that is not an object", () => {
    expect(whyOf("[]")).toContain("not an object");
    expect(whyOf('"ok"')).toContain("not an object");
    expect(whyOf("null")).toContain("not an object");
  });

  it("⚠ an object with NO `advisories` key — absent is not the same fact as empty", () => {
    /*
      `{"advisories":{}}` is a real answer meaning nothing was found. A missing
      key is a different document, and reading the second as the first is how a
      collector comes up empty and calls it clean.
    */
    expect(whyOf('{"metadata":{"vulnerabilities":{},"totalDependencies":1}}')).toContain("no `advisories` object");
    expect(whyOf('{"advisories":[],"metadata":{}}')).toContain("no `advisories` object");
    expect(whyOf('{"advisories":null,"metadata":{}}')).toContain("no `advisories` object");
  });

  it("an object with no `metadata`", () => {
    expect(whyOf('{"advisories":{}}')).toContain("no `metadata`");
  });

  it("an advisory entry that is not an object", () => {
    expect(whyOf('{"advisories":{"1240107":"high"},"metadata":{}}')).toContain("1240107 is not an object");
  });

  it("the empty-but-real report is NOT refused — the control on all of the above", () => {
    const result = readAuditReport('{"advisories":{},"metadata":{"vulnerabilities":{},"totalDependencies":0}}');
    expect(result.ok).toBe(true);
  });
});

describe("⚠ AN OUTAGE SAYS IT IS AN OUTAGE — and still refuses (#1856)", () => {
  const refusalOf = (text: string): string => {
    const result = readAuditReport(text);
    expect(result.ok, `this should not have read as a report: ${text.slice(0, 60)}`).toBe(false);
    return result.ok ? "" : result.why;
  };

  /*
    THE ARM THAT MATTERS MOST, AND IT IS FIRST ON PURPOSE. The card's one
    instruction was "do not soften the refusal": a security check that waves a
    change through because it could not look is what #1805 was filed about. So
    before any arm reads a word of the new sentence, both captured outages are
    proven to be REFUSALS.
  */
  it("both captured outages are REFUSED, not passed", () => {
    for (const captured of [OUTAGE_ECONNREFUSED, OUTAGE_BAD_RESPONSE]) {
      expect(readAuditReport(captured).ok).toBe(false);
    }
  });

  it("the ECONNREFUSED capture names the registry and quotes pnpm's own reason", () => {
    const why = refusalOf(OUTAGE_ECONNREFUSED);
    /* The words the relay asked for, in the refusal's first line. */
    expect(why).toContain("could not read the advisory registry");
    /* And the diagnosis the report stated about itself, which used to be dropped. */
    expect(why).toContain("ECONNREFUSED");
    expect(why).toContain("/-/npm/v1/security/audits");
    /* It must NOT read as the key-shaped refusal it used to land on. */
    expect(why).not.toContain("carries no `advisories` object");
  });

  it("the bad-response capture carries the endpoint's status, not a key name", () => {
    const why = refusalOf(OUTAGE_BAD_RESPONSE);
    expect(why).toContain("could not read the advisory registry");
    expect(why).toContain("ERR_PNPM_AUDIT_BAD_RESPONSE");
    expect(why).toContain("responded with 503");
    expect(why).not.toContain("carries no `advisories` object");
  });

  /*
    ⚠ THE SENTENCE'S WORDS ARE READ HERE AND NOWHERE ELSE. Every other arm
    asserts containment of the `OUTAGE_GUIDANCE` export rather than retyping it
    (working law 4) — which means every other arm would still pass if the
    constant were gutted to an empty string. This is the one arm that reads what
    it actually SAYS, against the three things the card required it to say.
  */
  it("the sentence says it is an outage, that the change may be fine, and that it comes back", () => {
    expect(OUTAGE_GUIDANCE).toContain("REGISTRY OUTAGE");
    expect(OUTAGE_GUIDANCE).toContain("your own change is");
    expect(OUTAGE_GUIDANCE).toContain("probably fine");
    expect(OUTAGE_GUIDANCE).toContain("nothing about the diff was judged");
    expect(OUTAGE_GUIDANCE).toContain("as soon as the advisory service answers");
    /* And it says out loud why it refuses anyway, so nobody reads it as a waiver. */
    expect(OUTAGE_GUIDANCE).toContain("refuses rather than passing on purpose");
    expect(OUTAGE_GUIDANCE).toContain("#1805");
  });

  it("every refusal an outage can arrive at carries the sentence", () => {
    /*
      The four roads, derived from `readAuditReport`'s own branches rather than
      from the card: a stated failure, an unrecognised JSON document, prose, and
      silence. The first is what the five driven shapes use; the other three are
      the same class on a quieter day.
    */
    const outageShaped = [
      OUTAGE_ECONNREFUSED,
      OUTAGE_BAD_RESPONSE,
      '{"metadata":{"vulnerabilities":{},"totalDependencies":1}}',
      "ERR_PNPM_AUDIT_BAD_RESPONSE  the endpoint returned a non-JSON response",
      "",
    ];
    for (const text of outageShaped) {
      expect(refusalOf(text), `no outage sentence on: ${text.slice(0, 40)}`).toContain(OUTAGE_GUIDANCE);
    }
  });

  it("⚠ NEGATIVE CONTROL — a document an outage cannot produce does NOT claim to be one", () => {
    /*
      Without this arm the one above is satisfied by pasting the sentence onto
      every refusal, which is how a sentence stops being information. A bare
      array and a non-object advisory entry are "this is not the document we
      think we are reading", and they must keep saying only that.
    */
    for (const text of ['[]', '"ok"', 'null', '{"advisories":{"1240107":"high"},"metadata":{}}']) {
      expect(refusalOf(text), `wrongly blamed an outage: ${text}`).not.toContain(OUTAGE_GUIDANCE);
    }
  });

  it("⚠ an `error` beside a perfectly good `advisories` object still REFUSES", () => {
    /*
      The fail-closed ordering, and the only reason `statedFailure` is consulted
      before the report is read at all. A document that announces a failure and
      then gets judged on the advisories it happens to list is invariant 7's
      defect with extra steps — it would report "none blocking" over an answer
      that said it had failed.
    */
    const why = refusalOf(
      '{"error":{"code":"ERR_PNPM_AUDIT_BAD_RESPONSE","message":"responded with 500"},'
      + '"advisories":{},"metadata":{"vulnerabilities":{},"totalDependencies":478}}',
    );
    expect(why).toContain("could not read the advisory registry");
    expect(why).toContain("responded with 500");
  });

  it("a stated failure is read however thinly the report states it", () => {
    /* A string rather than an object — the shape a different tool version might use. */
    expect(refusalOf('{"error":"the audit endpoint is unavailable"}')).toContain("the audit endpoint is unavailable");
    /* A code with no message. */
    expect(refusalOf('{"error":{"code":"ENOTFOUND"}}')).toContain("ENOTFOUND");
    /* A message with no code. */
    expect(refusalOf('{"error":{"message":"socket hang up"}}')).toContain("socket hang up");
    /*
      ⚠ AND AN `error` THAT SAYS NOTHING IS STILL AN OUTAGE, never a silence.
      "it answered with an error" is itself the finding; reading an empty error
      as no error is how this reader would come up blank and blame a key again.
    */
    for (const empty of ['{"error":{}}', '{"error":null}', '{"error":{"code":"","message":""}}']) {
      const why = refusalOf(empty);
      expect(why, empty).toContain("could not read the advisory registry");
      expect(why, empty).toContain("did not say what went wrong");
    }
  });

  it("pnpm's generic `code: \"pnpm\"` is dropped, because the message is the whole diagnosis", () => {
    /*
      Driven: a captive portal's HTML answered with `code: "pnpm"` and a message
      carrying the real parse failure. Printing `pnpm: …` in front of it is noise
      at the top of a refusal somebody is reading in a hurry.
    */
    const why = refusalOf('{"error":{"code":"pnpm","message":"Unexpected token \'<\' is not valid JSON"}}');
    expect(why).toContain("Unexpected token '<' is not valid JSON");
    expect(why).not.toContain("pnpm: Unexpected token");
  });

  it("a real report is untouched by any of this — the control on the whole block", () => {
    /* No `error` key, so nothing above fires and the clean tree still reads and passes. */
    const result = readAuditReport(CLEAN);
    expect(result.ok).toBe(true);
    expect(result.ok && result.report.dependencies).toBe(478);
  });
});

describe("a finding is never dropped for a gap in its shape", () => {
  it("⚠ an advisory with no GHSA id still BLOCKS, keyed by its npm id", () => {
    /*
      An acknowledgement cannot cover it (there is no id to sign), so the only
      safe answer is to block — and the refusal has to name it in a form a reader
      can act on.
    */
    const report = reportOf('{"advisories":{"1240107":{"severity":"high","module_name":"left-pad"}},'
      + '"metadata":{"vulnerabilities":{"high":1},"totalDependencies":1}}');
    const verdict = judgeAdvisories(report, []);
    expect(verdict.ok).toBe(false);
    expect(verdict.blocking).toHaveLength(1);
    expect(verdict.blocking[0].ghsa).toBeNull();
    expect(advisoryRefusal(verdict)).toContain("npm advisory 1240107");
  });

  it("a missing title, url or patched range reads as absent rather than throwing", () => {
    const report = reportOf('{"advisories":{"9":{"github_advisory_id":"GHSA-x","severity":"low",'
      + '"module_name":"m","findings":[{"paths":["a>b"]},{"nope":1}]}},"metadata":{}}');
    const advisory = report.advisories[0];
    expect(advisory.title).toBe("(no title in the report)");
    expect(advisory.url).toBeNull();
    expect(advisory.patched).toBeNull();
    expect(advisory.paths).toEqual(["a>b"]);
  });
});

describe("⚠ THE CALL SITE — a reader with no caller does not exist (invariant 7)", () => {
  const gate = read(".github/workflows/gate.yml");

  /*
    THE JOB BOUNDARY IS DERIVED, not two job names typed here. `gate-checks` has
    been resharded twice (#1034 split out semgrep, #1811 split out the unit
    suite), so naming the job that happens to follow it today would be a mirror
    that drifts (working law 4).
  */
  const jobHeaders = [...gate.matchAll(/\n {2}([A-Za-z0-9_-]+):\n/g)];
  const gateChecksAt = gate.indexOf("\n  gate-checks:\n");
  const nextJobAt = jobHeaders
    .map((match) => match.index!)
    .find((index) => index > gateChecksAt);

  it("the gate-checks job's region is readable at all — the arm below means nothing without this", () => {
    expect(gateChecksAt).toBeGreaterThan(-1);
    expect(nextJobAt).toBeGreaterThan(gateChecksAt);
  });

  it("the gate runs the checker, inside gate-checks — the job the merge tool stops on", () => {
    /*
      `scripts/pr-merge-in-order.mts` stops on a red `gate-checks`,
      `static-shapes` and `bundle-budget` BY NAME, and branch protection requires
      those same jobs. A step in a job nothing reads is a red check nobody is
      stopped by.
    */
    const step = gate.indexOf("scripts/check-dependency-advisories.mts");
    expect(step).toBeGreaterThan(gateChecksAt);
    expect(step).toBeLessThan(nextJobAt!);
  });

  it("⚠ it is the `run:` that invokes it, not a sentence mentioning it", () => {
    /*
      THIS IS THE ARM THAT ALMOST WENT WRONG. Four sabotages survived on PR #1853
      the same day because its arms asked whether a door was MENTIONED in a file
      rather than whether the control CONSULTED it — and this file's own comment
      block names the script twice in prose. Deleting the `run:` line would leave
      both mentions in place and a `toContain` would stay green over a gate that
      no longer reads anything.
    */
    const region = gate.slice(gateChecksAt, nextJobAt!);
    const invocations = [...region.matchAll(/run: npx tsx scripts\/check-dependency-advisories\.mts/g)];
    expect(invocations).toHaveLength(1);
  });

  it("the step is positioned before the expensive checks, where the card says it belongs", () => {
    /* Not taste: a 50-second red instead of an 8-minute one is the stated reason
       the two cheap steps above it run where they do. */
    const region = gate.slice(gateChecksAt, nextJobAt!);
    expect(region.indexOf("check-dependency-advisories.mts"))
      .toBeLessThan(region.indexOf("run: pnpm check"));
  });

  it("the checker calls the JUDGE, and spends no opinion of its own", () => {
    /*
      Working law 4 in the place it would hurt most: a gate-side copy of the
      policy, free to drift from the module the suite drives. The command itself
      is the exported constant, so the step cannot quietly stop reading `--prod`
      or start reading something else than the measurement was taken on.
    */
    const checker = read("scripts/check-dependency-advisories.mts");
    expect(checker).toContain('from "./lib/dependencyAdvisories.mts"');
    expect(checker).toContain("readAuditReport(");
    expect(checker).toContain("judgeAdvisories(");
    expect(checker).toContain('["pnpm", ...AUDIT_ARGUMENTS].join(" ")');
    /* ⚠ `spawnSync(COMMAND, {` UNTIL #2703: the dev-scope reading is the same
       command with a different scope flag, so both go through ONE runner rather
       than growing a second spawn with its own quirks to forget. */
    expect(checker).toContain("spawnSync(command, {");
    expect(checker).toContain("audit(COMMAND)");
    expect(checker).toContain("audit(DEV_COMMAND)");
    expect(checker).toContain('["pnpm", ...DEV_AUDIT_ARGUMENTS].join(" ")');
    /* And it declares no audit arguments of its own, on EITHER scope. */
    expect(checker).not.toContain('"--prod"');
    expect(checker).not.toContain('"--dev"');
    expect(checker).not.toContain('"audit"');
  });

  it("the arguments the step runs are the ones the positive control was taken on", () => {
    expect(AUDIT_ARGUMENTS).toEqual(["audit", "--prod", "--json"]);
  });

  it("⚠ a non-zero exit from pnpm audit is NOT consulted — that is how it reports a find", () => {
    /*
      The trap, and it would be silent: `pnpm audit` exits 1 when it finds
      something. A checker that forwarded that exit code would look correct and a
      checker that treated it as a launch failure would refuse every real find as
      an error. Neither is what runs: the OUTPUT decides.
    */
    const checker = read("scripts/check-dependency-advisories.mts");
    expect(checker).toContain("run.error !== undefined");
    expect(checker).not.toMatch(/run\.status/);
  });
});

/**
 * WHICH TREE THE READING WAS OF — #1899.
 *
 * On 2026-10-07 this step read *"none blocking — 477 production dependencies
 * read"* on CI while the same script refused a CRITICAL `proxy-addr` advisory
 * locally, apparently on the same commit. **Both answers were right, about two
 * different trees**: the gate runs on GitHub's MERGE ref, and the merge's other
 * parent (#1896) had pinned `proxy-addr@^2.0.8` forty seconds earlier.
 *
 * ⚠ **NOTHING ABOUT THE JUDGE WAS WRONG, SO NOTHING ABOUT THE JUDGE CHANGED,
 * and these arms deliberately assert no verdict.** What was missing is that the
 * output named a dependency COUNT and never named the tree the count was of —
 * so the one fact separating the two readings was the one fact a reader had to
 * dig out of a run log. These arms hold the line that says it.
 */
describe("the reading names the tree it was taken from (#1899)", () => {
  it("⚠ parses what git ACTUALLY prints — driven, not assumed", () => {
    /*
      The format is the assumption most likely to be wrong, and it is the whole
      reason the parse is a pure function in the lib rather than four lines
      inside a command script no suite can reach. This drives REAL git in this
      repository: `rev-list --parents -n 1 HEAD` prints the commit then its
      parents, on one line.
    */
    const stdout = execFileSync("git", ["rev-list", "--parents", "-n", "1", "HEAD"], {
      encoding: "utf8",
      cwd: ROOT,
    });
    const tree = readTreeFromRevList(stdout);
    expect(tree, "git's own output parsed to nothing").not.toBeNull();
    expect(tree?.head).toMatch(/^[0-9a-f]{9}$/);
    /* And the head really is this tree's HEAD, not some other sha on the line. */
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: ROOT }).trim();
    expect(head.startsWith(tree!.head)).toBe(true);
  });

  it("⚠ A REAL MERGE COMMIT reads as a merge — the case the whole card is about", () => {
    /*
      A non-merge HEAD proves only half of it. This finds a real merge in this
      repository's own history and drives the same parse over it, so the two
      shapes are both read from git rather than one of them from a fixture.
    */
    const merge = execFileSync("git", ["rev-list", "--merges", "-n", "1", "HEAD"], {
      encoding: "utf8",
      cwd: ROOT,
    }).trim();
    expect(merge, "this repository has no merge commit to drive the merge case with").not.toBe("");
    const tree = readTreeFromRevList(
      execFileSync("git", ["rev-list", "--parents", "-n", "1", merge], {
        encoding: "utf8",
        cwd: ROOT,
      }),
    );
    expect(tree?.parents.length).toBeGreaterThanOrEqual(2);
    const line = advisoryTreeLine(tree);
    expect(line).toContain("the MERGE of");
    /* The sentence that would have saved #1899 half a day. */
    expect(line).toMatch(/NOT your branch head/);
    expect(line).toContain("#1899");
  });

  it("a plain commit says its sha and claims nothing about a merge", () => {
    const line = advisoryTreeLine({ head: "e4001b13b", parents: ["6f5f33f9f"] });
    expect(line).toBe("  tree read: e4001b13b");
    expect(line).not.toContain("MERGE");
  });

  it("⚠ no git is an honest NULL, and it does not withhold the verdict", () => {
    /*
      The one rule about this line: a security verdict must never be held back
      because a LABEL could not be composed. A tarball checkout has no sha to
      name, and inventing one would be worse than the silence it replaces.
    */
    expect(readTreeFromRevList("")).toBeNull();
    expect(readTreeFromRevList("fatal: not a git repository")).toBeNull();
    expect(advisoryTreeLine(null)).toContain("unknown");
    /* And the script prints it OUTSIDE the two exit paths' own composers, so a
       missing tree cannot change an exit code. */
    const checker = read("scripts/check-dependency-advisories.mts");
    expect(checker).toContain("console.log(advisoryTreeLine(tree));");
    expect(
      checker.match(/console\.log\(advisoryTreeLine\(tree\)\);/g)?.length,
      "only one verdict names its tree — a refusal is the reading most likely to be compared",
    ).toBe(2);
  });
});

/*
  ⚠ PART 2 OF #2703 — THE BUILD AND TEST TOOLS ARE READ, AND THE READING CANNOT
  BLOCK A MERGE.

  **His word, 2026-10-27, Crew reply #302, verbatim and entire: *"WARN — tell
  us, never block us"*.**

  # The positive control is a real tree, not a fixture of a belief

  `pnpm-audit-dev-f4d2e5d4.json` is `pnpm audit --dev --json` captured whole and
  unedited against the lockfile and manifest as they stood at `f4d2e5d4` — the
  commit immediately before #2706 raised the three floors, and the very tree
  Warden run 9 took its §A measurement on. It carries **eleven advisories, three
  low, seven moderate and one HIGH**, which is that card's own figure arrived at
  by a reader that did not exist when the card was written.

  Without it this whole block would be green over a tree that has nothing wrong
  with it, and would prove only that a parser parses (working law 2). The clean
  capture beside it is the negative control, and the two were taken the same
  hour with the same command.

  # What is NOT proven here, said rather than left to be assumed

  The step's live exit code on a dev finding is driven out of band, because this
  suite touches no network: run from a checkout of `f4d2e5d4`'s manifest and
  lockfile, `scripts/check-dependency-advisories.mts` printed all eleven
  including the HIGH and **exited 0** (recorded on PR). What this suite can and
  does hold is the thing a future edit would break: that the notice has no
  verdict to refuse on, and that the entrypoint spends no exit code on it.
*/
describe("⚠ the dev-scope reading WARNS and never blocks (#2703, his word)", () => {
  const DEV_PREPATCH = read("server/__fixtures__/pnpm-audit-dev-f4d2e5d4.json");
  const DEV_CLEAN = read("server/__fixtures__/pnpm-audit-dev-clean.json");

  it("POSITIVE CONTROL — the real pre-bump tree really does carry the eleven, one of them HIGH", () => {
    const report = reportOf(DEV_PREPATCH);
    /* The fixture is the subject, so its own shape is asserted before anything
       is concluded from it (law 2 pointed at the fixture). */
    expect(report.advisories).toHaveLength(11);
    expect(report.counts).toMatchObject({ low: 3, moderate: 7, high: 1, critical: 0 });
    const high = report.advisories.filter((advisory) => advisory.severity === "high");
    expect(high).toHaveLength(1);
    expect(high[0]!.ghsa).toBe("GHSA-587h-7wmj-h5pm");
    expect(high[0]!.module).toBe("vite");
  });

  it("and the notice REPORTS all eleven, with the HIGH and its patched range named", () => {
    const text = advisoryDevNotice({ ok: true, report: reportOf(DEV_PREPATCH) });
    expect(text).toContain("11 known vulnerability(ies) in the BUILD AND TEST tools");
    expect(text).toContain("3 low, 7 moderate, 1 high");
    expect(text).toContain("GHSA-587h-7wmj-h5pm");
    expect(text).toContain("HIGH · vite");
    /*
      THE CARD'S HEADLINE, AND THE ONE FACT THAT MAKES THIS LINE ACTIONABLE
      rather than merely alarming: every one of the eleven had a patch inside a
      range `package.json` already declared, so the repair was a floor raise and
      not an upgrade. The notice cannot judge the range — that would want semver
      against the manifest — so it prints the number and says to read it.
    */
    expect(text).toContain("patched in: >=7.3.7");
    expect(text).toContain("patched in: >=4.1.12");
    expect(text).toContain("patched in: >=3.1.9");
    expect(text).toContain("read the `patched in:` line above against the range package.json already declares");
  });

  it("⚠ and it says IN THE SAME BREATH that it blocks nothing — his word, in the output", () => {
    const text = advisoryDevNotice({ ok: true, report: reportOf(DEV_PREPATCH) });
    expect(text).toContain("never blocks a merge");
    expect(text).toContain("WARN — tell us, never block us");
    /* And why nobody should panic: a dev advisory cannot reach a customer. */
    expect(text).toContain("Nothing a customer can reach is affected");
  });

  it("NEGATIVE CONTROL — today's real tree reports none, and does not shout", () => {
    const text = advisoryDevNotice({ ok: true, report: reportOf(DEV_CLEAN) });
    expect(reportOf(DEV_CLEAN).advisories).toHaveLength(0);
    expect(text).toBe("dev-scope advisories: none — 214 build and test dependencies read.");
    expect(text).not.toContain("known vulnerability");
  });

  it("⚠ IT FAILS OPEN, AND SAYS WHICH OF THE TWO HAPPENED — the opposite of the prod half", () => {
    /*
      THE ARM THAT MATTERS MOST, because fail-open is the direction that is
      normally the defect. The production half REFUSES when it cannot look
      (invariant 7). This half must not — an outage must not cost the crew a
      merge over build tooling — so the only protection against it reading as
      "nothing found" is that it says so in words.
    */
    const text = advisoryDevNotice({ ok: false, why: "the registry did not answer" });
    expect(text).toContain("NOT READ");
    expect(text).toContain("the registry did not answer");
    expect(text).toContain("it is NOT a clean reading");
    expect(text).toContain("never blocks a merge");
    /* It must NOT be mistakable for the clean answer. */
    expect(text).not.toContain("dev-scope advisories: none");
  });

  it("an advisory in BOTH trees is counted once — derived from the production report, not a second list", () => {
    /*
      The two scopes overlap: measured on this repository, `--prod` reads 477
      packages and `--dev` reads 214 against a whole tree of 715. A package in
      both would otherwise be refused above AND warned about down here, which
      reads as two problems.
    */
    const dev = reportOf(DEV_PREPATCH);
    const production = reportOf(DEV_PREPATCH); /* the same findings, as if prod carried them */
    const text = advisoryDevNotice({ ok: true, report: dev }, production);
    expect(text).toContain("dev-scope advisories: none");
    expect(text).toContain("11 already named in the production reading");
    expect(text).not.toContain("GHSA-587h-7wmj-h5pm");

    /* POSITIVE CONTROL for the same reader: a production report carrying
       something ELSE hides nothing. */
    const unrelated = reportOf(CLEAN);
    expect(advisoryDevNotice({ ok: true, report: dev }, unrelated))
      .toContain("11 known vulnerability(ies)");
  });

  it("⚠ an acknowledgement cannot silence a warning, and that is on purpose", () => {
    /*
      `ACKNOWLEDGED_ADVISORIES` is signed permission to pass a REFUSAL. A
      warning needs no permission, so the notice never consults that list — and
      the consequence is intended: a dev hole with no patch warns on every merge
      until it has one, which is exactly *"tell us"*. The repair text says so
      rather than leaving somebody to discover it by signing one.
    */
    const text = advisoryDevNotice({ ok: true, report: reportOf(DEV_PREPATCH) });
    expect(text).toContain("Do NOT add it to ACKNOWLEDGED_ADVISORIES");
    expect(text).toContain("permission to pass a");
  });

  it("the arguments are the ones the positive control was taken on, and differ in the scope flag alone", () => {
    expect(DEV_AUDIT_ARGUMENTS).toEqual(["audit", "--dev", "--json"]);
    /* One flag apart from the production reading, so a drift in either is
       visible as a drift rather than as two unrelated commands. */
    expect(DEV_AUDIT_ARGUMENTS.filter((argument) => argument !== "--dev"))
      .toEqual(AUDIT_ARGUMENTS.filter((argument) => argument !== "--prod"));
  });

  it("⚠ THE NOTICE HAS NO VERDICT TO REFUSE ON — the control is the SHAPE, not a promise", () => {
    /*
      `advisoryDevNotice` returns a STRING. There is no `ok`, no count and no
      boolean for a caller to branch an exit code on, so refusing on it later
      takes a deliberate rewrite rather than a one-line slip. That is the
      difference between a control and an intention, and it is why the function
      is shaped this way.
    */
    const text = advisoryDevNotice({ ok: true, report: reportOf(DEV_PREPATCH) });
    expect(typeof text).toBe("string");
    expect(text).not.toContain("REFUSED");
  });

  it("⚠ THE CALL SITE spends no exit code on it — read at the entrypoint's bytes", () => {
    /*
      Invariant 7's other half: the reading exists AND it is wired, and here
      also that the wiring cannot block. The dev reading is printed, and no
      `process.exit` anywhere in the file is reachable from it — the only two
      exits that remain are the production verdict's, which were there before
      this card.
    */
    const checker = read("scripts/check-dependency-advisories.mts");
    expect(checker).toContain("advisoryDevNotice(");
    expect(checker).toContain("const devRun = audit(DEV_COMMAND);");

    /*
      Every exit in the file, and each one accounted for: the spawn that could
      not launch, the report that could not be read, the production verdict's
      refusal — then the pass. FOUR, all three refusals belonging to the
      production half and predating this card.

      ⚠ This arm was written expecting FIVE and was wrong, which is the arm
      doing its job on the shift that wrote it: a count typed from memory rather
      than read. It is kept as a count rather than loosened to "no new exits",
      because the whole claim of this card is that the dev reading added none.
    */
    const exits = [...checker.matchAll(/process\.exit\((\d)\)/g)].map((match) => match[1]);
    expect(exits).toEqual(["1", "1", "1", "0"]);

    /*
      AND NO EXIT SITS INSIDE THE DEV READING'S OWN SLICE. The subject is cut
      out rather than the whole file searched, because a whole-file assertion
      would be satisfied by the production half's exits sitting elsewhere
      (`guard-arm-satisfied-by-a-sibling`).
    */
    const from = checker.indexOf("const devRun = audit(DEV_COMMAND);");
    const to = checker.indexOf("if (!verdict.ok) {", from);
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    const devSlice = checker.slice(from, to);
    expect(devSlice).toContain("advisoryDevNotice(");
    expect(devSlice).not.toContain("process.exit");
    expect(devSlice).not.toContain("throw ");
  });
});
