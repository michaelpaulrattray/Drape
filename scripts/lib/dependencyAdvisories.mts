/**
 * THE GATE'S OWN READER OF KNOWN VULNERABILITIES (#1805, his word: "add the
 * gate step").
 *
 * # What this closes, measured rather than supposed
 *
 * On 2026-09-30 PR #1599 added `@sentry/bundler-plugins` to the PRODUCTION side
 * of the lockfile, and with it a `brace-expansion` carrying three published
 * advisories — two of them **high**, both published ten hours before the merge.
 * `Socket Security: Pull Request Alerts`, which is one of the seven REQUIRED
 * checks on `main`, **passed it in 7 seconds**. The first reader that spoke was
 * Dependabot, **six seconds after the merge button**, and the two highs then sat
 * in the live product for three days (#1803).
 *
 * The Warden's run-6 finding W6-B is that reading, and its conclusion was not
 * about Socket: **the gate had no reader of its own for known vulnerabilities.**
 * `pnpm audit` ran nowhere in CI. This module is that reader.
 *
 * # Proven able to fail, on the exact instance
 *
 * Working law 2 — verify the instrument before believing its finding. The
 * positive control is not a fixture somebody invented: it is `pnpm audit --prod
 * --json` run against the lockfile **as it stood at `dfdcc3a33`**, the commit
 * #1599 merged, captured whole into
 * `server/__fixtures__/pnpm-audit-prod-dfdcc3a3.json`. It reports the two highs
 * the card names (`GHSA-6j4f-fj2g-mc7p`, `GHSA-qhr7-859c-m2p7`), the moderate
 * beside them, and a fourth in `dompurify` that nothing in this program had
 * noticed. **So the step would have reddened #1599**, which is the one claim
 * worth making about it. On the tree as it stands today the same command is
 * exit 0 with no advisories, so the step lands GREEN rather than stopping every
 * merge on the day it arrives.
 *
 * # The policy, and why it carries no severity threshold
 *
 * **Any unacknowledged advisory blocks.** Not "high and above".
 *
 * He chose the stricter of the two options on the card and accepted its price in
 * the same sentence: *"it will sometimes stop a change over a hole in somebody
 * else's code that we cannot fix the same day."* A threshold would be a number
 * nobody in this program can justify, quietly deciding which holes do not
 * count; `ACKNOWLEDGED_ADVISORIES` below is the same decision taken out loud,
 * one advisory at a time, with a reason a reader can disagree with.
 *
 * ⚠ **AND THE ACKNOWLEDGED LIST ONLY SHRINKS.** An entry for an advisory the
 * report no longer carries is itself a REFUSAL, exactly as the capability
 * atlas's `KNOWN_DEBTS` works — otherwise the day an override closes a hole is
 * the day its exemption becomes a standing permission nobody asked for.
 *
 * # What a green run does NOT mean — the limit, stated rather than discovered
 *
 * ⚠ **`--prod` does not read devDependencies.** The card's instance was a
 * production dependency and `--prod` is what it proposed, so that is what runs;
 * build tooling, test tooling and this repository's own scripts are NOT judged
 * here. Dependabot still sees them, after the fact, which is the gap this module
 * only half closes. **A clean run is a floor, not coverage.**
 *
 * It also reads only what the registry's advisory database knows at the moment
 * it is asked. An advisory published an hour after a merge is invisible to it —
 * #1599's own advisories were ten hours old, which is why this reader would have
 * caught that one, and is not a promise about the next.
 */

/** Exactly what the gate runs. Read by the suite, so the step cannot drift from the measurement. */
export const AUDIT_ARGUMENTS = ["audit", "--prod", "--json"] as const;

/** One advisory, reduced to the fields a verdict turns on. */
export type Advisory = {
  /** The npm advisory id — the report's own key, so it is always present. */
  readonly key: string;
  /** The GHSA id when the report carries one; `null` rather than invented. */
  readonly ghsa: string | null;
  readonly severity: string;
  readonly module: string;
  readonly title: string;
  readonly url: string | null;
  readonly patched: string | null;
  /** The dependency chains the finding sits on, as the report spells them. */
  readonly paths: readonly string[];
};

export type Acknowledgement = {
  readonly ghsa: string;
  readonly module: string;
  readonly why: string;
  readonly since: string;
  readonly card: string;
};

/**
 * AN ADVISORY THAT STANDS, AND THE REASON IT STANDS.
 *
 * ⚠ **EMPTY TODAY, AND THAT IS THE MEASURED STATE** — `pnpm audit --prod` is
 * exit 0 on this tree (read 2026-10-03). A line is added here only when an
 * advisory genuinely cannot be closed, and adding one is a PULL REQUEST like any
 * other: it goes through the gate and the relay's hand, which is the whole point
 * of putting the exemption in the tree instead of hiding it in a threshold.
 *
 * `ghsa` is matched against the report's `github_advisory_id`. `why` is read by
 * a person, so write it for one: what the hole is, why it cannot be closed
 * today, and what would close it.
 */
export const ACKNOWLEDGED_ADVISORIES: readonly Acknowledgement[] = [];

export type AdvisoryReport = {
  readonly advisories: readonly Advisory[];
  /** The report's own severity tally, kept for the summary line. */
  readonly counts: Readonly<Record<string, number>>;
  readonly dependencies: number | null;
};

export type ReadResult =
  | { readonly ok: true; readonly report: AdvisoryReport }
  | { readonly ok: false; readonly why: string };

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const pathsOf = (findings: unknown): readonly string[] => {
  if (!Array.isArray(findings)) return [];
  const out: string[] = [];
  for (const finding of findings) {
    const paths = (finding as { paths?: unknown } | null)?.paths;
    if (!Array.isArray(paths)) continue;
    for (const path of paths) {
      const named = asString(path);
      if (named !== null) out.push(named);
    }
  }
  return out;
};

/**
 * READ THE REPORT, OR REFUSE — never a short list.
 *
 * Every shape this cannot positively recognise is a REFUSAL, because the one
 * outcome a gate step must never have is passing by being unable to look
 * (invariant 7). `pnpm audit` prints a plain-text error and no JSON when the
 * registry is unreachable, so "not JSON" is also how a network failure arrives
 * here — and it fails closed.
 *
 * An advisory missing its `github_advisory_id` is still COUNTED, keyed by the
 * report's own id. A finding dropped for a gap in its shape is the silence this
 * repository has paid for in four separate Atlas collectors.
 */
export const readAuditReport = (stdout: string): ReadResult => {
  const text = stdout.trim();
  if (text === "") {
    return { ok: false, why: "pnpm audit printed nothing — the advisory database was never read." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const firstLine = text.split("\n", 1)[0] ?? "";
    return {
      ok: false,
      why: `pnpm audit did not answer with JSON (${(error as Error).message}). Its first line was: ${firstLine}`,
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      why: "pnpm audit answered with JSON that is not an object — this is not the report we think we are reading.",
    };
  }

  const body = parsed as { advisories?: unknown; metadata?: unknown };
  /*
    BOTH keys are required before this is called a report, and the reason is the
    null-versus-empty distinction: `advisories: {}` is a real answer meaning
    nothing was found, while a MISSING `advisories` is a different document.
    Treating the second as the first is how a reader comes up empty and calls it
    clean.
  */
  if (body.advisories === null || typeof body.advisories !== "object" || Array.isArray(body.advisories)) {
    return { ok: false, why: "pnpm audit's answer carries no `advisories` object — nothing has been checked." };
  }
  if (body.metadata === null || typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
    return { ok: false, why: "pnpm audit's answer carries no `metadata` — nothing has been checked." };
  }

  const advisories: Advisory[] = [];
  for (const [key, raw] of Object.entries(body.advisories as Record<string, unknown>)) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, why: `advisory ${key} is not an object — the report cannot be judged.` };
    }
    const entry = raw as Record<string, unknown>;
    advisories.push({
      key,
      ghsa: asString(entry.github_advisory_id),
      severity: asString(entry.severity) ?? "unknown",
      module: asString(entry.module_name) ?? "unknown",
      title: asString(entry.title) ?? "(no title in the report)",
      url: asString(entry.url),
      patched: asString(entry.patched_versions),
      paths: pathsOf(entry.findings),
    });
  }

  const metadata = body.metadata as { vulnerabilities?: unknown; totalDependencies?: unknown };
  const counts: Record<string, number> = {};
  const tally = metadata.vulnerabilities;
  if (tally !== null && typeof tally === "object" && !Array.isArray(tally)) {
    for (const [severity, count] of Object.entries(tally as Record<string, unknown>)) {
      if (typeof count === "number") counts[severity] = count;
    }
  }

  return {
    ok: true,
    report: {
      advisories,
      counts,
      dependencies: typeof metadata.totalDependencies === "number" ? metadata.totalDependencies : null,
    },
  };
};

export type Verdict = {
  readonly ok: boolean;
  /** Advisories the gate refuses on. */
  readonly blocking: readonly Advisory[];
  /** Advisories a line in `ACKNOWLEDGED_ADVISORIES` covers. */
  readonly acknowledged: readonly Advisory[];
  /** Acknowledgements the report no longer carries — a refusal of their own. */
  readonly stale: readonly Acknowledgement[];
};

/**
 * THE VERDICT. Pure, so the suite drives it rather than the network.
 *
 * An acknowledgement matches on the GHSA id alone and NOT on the module: the
 * module is recorded in the list so a reader can see what the exemption is
 * about, and matching on it as well would let a renamed package silently
 * re-open a hole somebody signed for.
 */
export const judgeAdvisories = (
  report: AdvisoryReport,
  acknowledged: readonly Acknowledgement[] = ACKNOWLEDGED_ADVISORIES,
): Verdict => {
  const signed = new Set(acknowledged.map((entry) => entry.ghsa));
  const blocking: Advisory[] = [];
  const covered: Advisory[] = [];

  for (const advisory of report.advisories) {
    if (advisory.ghsa !== null && signed.has(advisory.ghsa)) covered.push(advisory);
    else blocking.push(advisory);
  }

  const reported = new Set(
    report.advisories
      .map((advisory) => advisory.ghsa)
      .filter((ghsa): ghsa is string => ghsa !== null),
  );
  const stale = acknowledged.filter((entry) => !reported.has(entry.ghsa));

  return { ok: blocking.length === 0 && stale.length === 0, blocking, acknowledged: covered, stale };
};

const describeAdvisory = (advisory: Advisory): string => {
  const lines = [
    `    ${advisory.severity.toUpperCase()} · ${advisory.module} — ${advisory.title}`,
    `      ${advisory.ghsa ?? `npm advisory ${advisory.key}`}${advisory.url === null ? "" : ` · ${advisory.url}`}`,
  ];
  if (advisory.patched !== null) lines.push(`      patched in: ${advisory.patched}`);
  for (const path of advisory.paths) lines.push(`      via: ${path}`);
  return lines.join("\n");
};

/** The refusal a reader has to act on, so it says what to DO and not only what is wrong. */
export const advisoryRefusal = (verdict: Verdict): string => {
  const parts: string[] = [];

  if (verdict.blocking.length > 0) {
    parts.push(
      `REFUSED: ${verdict.blocking.length} known vulnerability(ies) in what ships to customers (#1805).`,
    );
    for (const advisory of verdict.blocking) parts.push(describeAdvisory(advisory));
    parts.push(
      [
        "  repair, in the order worth trying:",
        "    1. bump the direct dependency that pulls it in, if a fixed version exists;",
        "    2. pin the fixed transitive version in package.json's `pnpm.overrides` — the road",
        "       brace-expansion, dompurify and seven others already take in this tree;",
        "    3. if neither can be done today, add the advisory to ACKNOWLEDGED_ADVISORIES in",
        "       scripts/lib/dependencyAdvisories.mts with the reason it stands. That is a pull",
        "       request like any other, and it is read by a person on purpose.",
      ].join("\n"),
    );
  }

  if (verdict.stale.length > 0) {
    parts.push(
      `REFUSED: ${verdict.stale.length} acknowledgement(s) cover an advisory this report no longer carries.`,
    );
    for (const entry of verdict.stale) {
      parts.push(`    ${entry.ghsa} (${entry.module}) — signed ${entry.since}, ${entry.card}`);
    }
    parts.push(
      [
        "  repair: delete those lines from ACKNOWLEDGED_ADVISORIES. The hole is closed, so the",
        "    exemption is now a standing permission nobody asked for — the list only shrinks.",
      ].join("\n"),
    );
  }

  return parts.join("\n");
};

/** The green line, which says what was actually read rather than only "ok". */
export const advisoryPass = (report: AdvisoryReport, verdict: Verdict): string => {
  const scope =
    report.dependencies === null
      ? "the production tree"
      : `${report.dependencies} production dependencies`;
  const signed =
    verdict.acknowledged.length === 0 ? "" : ` · ${verdict.acknowledged.length} acknowledged and standing`;
  return [
    `dependency advisories: none blocking — ${scope} read${signed}.`,
    "  ⚠ devDependencies are NOT read here (--prod). A green line is a floor, not coverage.",
  ].join("\n");
};
