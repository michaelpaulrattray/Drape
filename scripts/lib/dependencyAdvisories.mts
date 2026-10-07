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

/**
 * THE SENTENCE A READER MEETING AN OUTAGE ON AN UNRELATED PULL REQUEST NEEDS
 * (#1856, the relay's hand verdict on PR #1854: *"The outage refusal never says
 * 'registry unreachable' in words; a reader meeting it on an unrelated PR may
 * not recognise an outage. One sentence would do."*).
 *
 * ⚠ **IT SOFTENS NOTHING.** Every refusal that carries this still exits 1, and
 * the last two lines say why out loud: the card this check was built on is a
 * case of a security reader that *passed in 7 seconds* and let two published
 * high-severity holes ship. This is about the words, not the verdict.
 *
 * It is ONE constant rather than a sentence written out at each refusal, because
 * the moment it had three copies they would drift (working law 4) — and the
 * suite asserts against this export rather than retyping it, for the same
 * reason.
 */
export const OUTAGE_GUIDANCE = [
  "  ⚠ THIS IS WHAT A REGISTRY OUTAGE LOOKS LIKE from here, and your own change is",
  "    probably fine — nothing about the diff was judged either way. It passes again",
  "    as soon as the advisory service answers, so re-run this job.",
  "    It refuses rather than passing on purpose: a security check that waves a change",
  "    through because it could not look is exactly what let two published high-severity",
  "    holes reach the live product on 30 September (#1805).",
].join("\n");

/**
 * WHAT THE REPORT SAYS ABOUT ITS OWN FAILURE, when it says anything.
 *
 * Measured shape (see `readAuditReport`'s header): `{"error":{"code":…,
 * "message":…}}`. `code` is worth printing but is not always worth much — a
 * captive portal's HTML answered with `code: "pnpm"` while the message carried
 * the whole diagnosis — so the message leads and the code rides beside it only
 * when it is not the generic one.
 *
 * Returns `null` when there is no `error` key at all; returns a sentence rather
 * than `null` when the key is present but says nothing, because "it answered
 * with an error" is itself the finding and must never read as "no error".
 */
const statedFailure = (body: { error?: unknown }): string | null => {
  if (!("error" in body)) return null;

  const direct = asString(body.error);
  if (direct !== null) return direct;

  if (body.error === null || typeof body.error !== "object" || Array.isArray(body.error)) {
    return "it did not say what went wrong";
  }

  const shaped = body.error as { code?: unknown; message?: unknown };
  const message = asString(shaped.message);
  const code = asString(shaped.code);

  if (message !== null) return code === null || code === "pnpm" ? message : `${code}: ${message}`;
  if (code !== null) return code;
  return "it did not say what went wrong";
};

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
 * (invariant 7).
 *
 * ⚠ **HOW AN OUTAGE ACTUALLY ARRIVES WAS DRIVEN, AND IT IS NOT WHAT THIS
 * DOCBLOCK SAID (#1856).** It read *"`pnpm audit` prints a plain-text error and
 * no JSON when the registry is unreachable, so "not JSON" is also how a network
 * failure arrives here"* — reasoned, not measured, and false of this tree.
 * Driven on pnpm 10.28.2 / Node 24.18.0 against a dead port and a local stand-in
 * endpoint, **five failure shapes out of five** — `ECONNREFUSED`, a captive
 * portal's HTML, a 503, a 429 and a 500 — answered with **valid JSON on stdout
 * carrying an `error` object**, and **stderr was empty in all five**. With
 * `--json`, `ERR_PNPM_AUDIT_BAD_RESPONSE` is a *field value* inside that object,
 * never loose prose. So every real outage landed on the `advisories`-is-missing
 * refusal below, and the reason the report stated about itself was read by
 * nothing.
 *
 * **That reason is read now**, which is the disappearing-technology law's clause
 * 4 pointed at our own tooling: a signal bought and unread is the cheapest
 * finding available. The non-JSON branch stays exactly as fail-closed as it was
 * — a reader must not depend on which shape arrives — it simply is not the one
 * an outage uses today.
 *
 * An advisory missing its `github_advisory_id` is still COUNTED, keyed by the
 * report's own id. A finding dropped for a gap in its shape is the silence this
 * repository has paid for in four separate Atlas collectors.
 */
export const readAuditReport = (stdout: string): ReadResult => {
  const text = stdout.trim();
  if (text === "") {
    /*
      Not one of the five driven shapes — every one of those printed JSON — but
      it is the same class and gets the same sentence: a process killed, starved
      or cut off by a proxy mid-answer is an outage wearing a quieter coat, and
      withholding the explanation from the refusal most likely to be met on a
      broken runner would be the very defect this card is about.
    */
    return {
      ok: false,
      why: `pnpm audit printed nothing — the advisory database was never read.\n${OUTAGE_GUIDANCE}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const firstLine = text.split("\n", 1)[0] ?? "";
    return {
      ok: false,
      why:
        `pnpm audit did not answer with JSON (${(error as Error).message}). Its first line was: ${firstLine}`
        + `\n${OUTAGE_GUIDANCE}`,
    };
  }

  /*
    ⚠ THIS REFUSAL AND THE PER-ADVISORY ONE BELOW DELIBERATELY DO NOT CARRY
    `OUTAGE_GUIDANCE`, and the omission is a decision rather than an oversight.
    No driven failure produced either shape: an endpoint that is down answers
    with an `error` object, never with a bare array or a string, and never with
    an advisory entry that is not an object. Telling a reader "this looks like an
    outage" over a document an outage cannot produce would point the repair at
    the wrong place — and a sentence printed over everything stops being
    information. These two mean exactly what they say: this is not the document
    we think we are reading. Both still refuse.
  */
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      why: "pnpm audit answered with JSON that is not an object — this is not the report we think we are reading.",
    };
  }

  const body = parsed as { advisories?: unknown; metadata?: unknown; error?: unknown };

  /*
    ⚠ THE STATED FAILURE IS READ BEFORE ANYTHING ELSE — both because it is the
    measured shape of every real outage, and because that is the fail-closed
    ordering. A document carrying an `error` key AND a usable `advisories` object
    has never been observed; if one ever arrives it must REFUSE rather than be
    judged on the advisories it happens to list, because a report that announced
    a failure and then read as a clean verdict is "passing by being unable to
    look" with extra steps.
  */
  const stated = statedFailure(body);
  if (stated !== null) {
    return {
      ok: false,
      why:
        `pnpm audit could not read the advisory registry — it answered with an error instead of a report: ${stated}`
        + `\n${OUTAGE_GUIDANCE}`,
    };
  }

  /*
    BOTH keys are required before this is called a report, and the reason is the
    null-versus-empty distinction: `advisories: {}` is a real answer meaning
    nothing was found, while a MISSING `advisories` is a different document.
    Treating the second as the first is how a reader comes up empty and calls it
    clean.

    ⚠ This is where all five driven outages used to land, saying nothing about
    why — the refusal this card was filed on. An outage names itself above now,
    so what reaches here is a JSON object that is neither a report nor a stated
    failure. It keeps the sentence anyway: the shape is unknown by definition, so
    the likeliest cause is still the thing on the other end of the network.
  */
  if (body.advisories === null || typeof body.advisories !== "object" || Array.isArray(body.advisories)) {
    return {
      ok: false,
      why: "pnpm audit's answer carries no `advisories` object — nothing has been checked."
        + `\n${OUTAGE_GUIDANCE}`,
    };
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
/**
 * WHICH TREE THE READING WAS TAKEN FROM — one line, printed beside every
 * verdict (#1899).
 *
 * ⚠ **IT EXISTS BECAUSE THIS STEP'S TWO HONEST ANSWERS LOOKED LIKE A DEFECT
 * FOR HALF A DAY, AND THE CARD IT COST WAS FILED IN GOOD FAITH.** On
 * 2026-10-07 the step read *"none blocking — 477 production dependencies read"*
 * on CI while the same script refused a CRITICAL `proxy-addr` advisory locally,
 * apparently on the same commit. The card (#1899) recorded both readings and
 * explicitly declined to guess a cause, which was the right call. **The relay
 * found it by reading the run's checkout line**: `HEAD is now at cb005f4 Merge
 * e4001b13b… into 6f5f33f9f…`, and `6f5f33f9` had pinned `proxy-addr@^2.0.8`
 * forty seconds earlier. **The gate runs on GitHub's MERGE ref, not the branch
 * head. Both answers were right, about two different trees.**
 *
 * Nothing about the judge was wrong, so nothing about the judge changed. What
 * was missing is that the output named a dependency COUNT and never named the
 * tree the count was of — so the one fact that separates the two readings was
 * the one fact a reader had to go digging in a run log for.
 *
 * **The merge parents are what make it readable**: on a pull request the sha
 * means nothing to anybody, and *"the merge of <your head> into <main>"* is the
 * whole explanation.
 *
 * `null` is an honest answer and says so — a tarball checkout or a tree with no
 * git has no sha to name, and inventing one would be worse than the silence
 * this replaces.
 */
export type TreeRead = { readonly head: string; readonly parents: readonly string[] };

/**
 * `git rev-list --parents -n 1 HEAD`'s one line, read: the commit, then its
 * parents. Pure, so the FORMAT ASSUMPTION — the thing most likely to be wrong —
 * can be driven against real git output rather than against a belief about it
 * (`server/dependencyAdvisoryGate.test.ts`).
 *
 * Anything that is not a hex sha is dropped rather than trusted, and an empty
 * result is `null`: a line this cannot read must produce no claim about which
 * tree was read, never a half one.
 */
export const readTreeFromRevList = (stdout: string): TreeRead | null => {
  const shas = stdout
    .trim()
    .split(/\s+/)
    .filter((sha) => /^[0-9a-f]{7,40}$/.test(sha))
    .map((sha) => sha.slice(0, 9));
  if (shas.length === 0) return null;
  return { head: shas[0], parents: shas.slice(1) };
};

export const advisoryTreeLine = (tree: TreeRead | null): string => {
  if (tree === null) {
    return "  tree read: unknown — no git here, so this reading names no commit.";
  }
  if (tree.parents.length < 2) return `  tree read: ${tree.head}`;
  const [base, head] = tree.parents;
  return (
    `  tree read: ${tree.head} — the MERGE of ${head} into ${base}.`
    + "\n  ⚠ On a pull request that is what CI checks out, NOT your branch head:"
    + " a reading here can differ from the same reading on your own commit, and both be right (#1899)."
  );
};

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
