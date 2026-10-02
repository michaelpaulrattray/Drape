/**
 * WHICH `pnpm.overrides` ENTRIES GOVERN A PACKAGE THAT IS ACTUALLY IN THE TREE
 * — the reading #1815 asked for, and the other direction from #1808's guard.
 *
 * `server/dependencyOverrideBounds.test.ts` refuses an override whose range is
 * UNBOUNDED above. Nothing read the opposite question — whether an override is
 * still **needed** — so the block could only ever grow: an override that
 * governs nothing is indistinguishable, from inside `package.json`, from one
 * holding a real floor.
 *
 * # The measurement that filed it, re-read here before this was written
 *
 * Three of the nine entries govern a package that is not installed anywhere
 * (`tar`, `lodash-es`, `mdast-util-to-hast` — scaffold-era, added together by
 * `cf764795a` in 2026-02 against advisories in a tree since largely replaced;
 * `tar`'s place is now taken by `modern-tar`). Confirmed at the artifact on
 * 2026-10-03 against `pnpm-lock.yaml` at `98b5b318e`: the six live entries
 * resolve `brace-expansion@5.0.12`, `dompurify@3.4.16`, `esbuild@0.28.2`,
 * `fast-uri@3.1.8`, `lodash@4.18.1` and `qs@6.16.0`, and the other three appear
 * nowhere but their own override declaration.
 *
 * # THE LOCKFILE IS THE READER, AND `pnpm why` IS NOT — both measured
 *
 * `pnpm why <pkg>` is pnpm's own answer and was the card's first suggestion.
 * Two things rule it out as the instrument, and neither is a preference:
 *
 *   1. **Its only signal is an EMPTY STDOUT.** Driven on this tree the same
 *      day: `pnpm why tar`, `pnpm why lodash-es` and `pnpm why
 *      mdast-util-to-hast` each printed nothing and **exited 0**, exactly as
 *      `pnpm why lodash` exited 0 after printing its dependents. A reader whose
 *      verdict is "no output" cannot tell an absent package from a command that
 *      failed to run — the shape this repository has been bitten by before
 *      (`check-cleanup-dispositions`'s `unreadable` arm).
 *   2. **It reads `node_modules`, which in a shift worktree is a JUNCTION to
 *      another tree's install.** So in the place a seat actually works it
 *      answers about a different tree than the one it is standing in.
 *
 * `pnpm-lock.yaml` is the committed artifact of THIS tree: it needs no install,
 * no network and no store, it is what the gate installs from, and it is what
 * moves when an override starts or stops governing something. `pnpm why` stays
 * useful as the **independent second reader** — it agreed with this one on all
 * four names above, sharing no resolver with it — and that is how it is used.
 *
 * # IT REFUSES RATHER THAN REPORTING A SHORT LIST
 *
 * ⚠ **A parse that came up empty would report every override as dead**, which
 * is the loudest false finding available here and would read as nine pieces of
 * litter rather than as a broken reader. So: an absent or empty `pnpm.overrides`
 * refuses, an absent or empty `packages:`/`snapshots:` block refuses, and a key
 * line that does not parse refuses NAMING THE LINE. (CLAUDE.md's collector
 * class: every collector that can come up empty throws rather than returning a
 * short list.) Finding a dead override is a finding for the shift and not a
 * failure of the reader — the doctrine `scripts/patrol-clocks.mts` runs on —
 * which is why the command exits 0 on a finding and 1 only on a refusal.
 *
 * # IT IS A READING AND DELIBERATELY NOT A GUARD
 *
 * #1815 put both shapes up and ruled against the guard in its own body: a gate
 * arm refusing an override that governs nothing *"would redden the gate for
 * litter, and it would force a removal decision at exactly the moment nobody
 * has context for it"*, and an allowlist-with-a-reason-per-line is most of the
 * cost of the reading with none of the safety. Removal is also the one act a
 * gate cannot give back, and a **bounded** dead override becomes a live floor
 * the moment the package returns as a transitive. So nothing here deletes
 * anything and nothing here fails anything.
 *
 * # WHAT IT DOES NOT ANSWER, STATED SO THE READING IS NOT READ AS ANSWERING IT
 *
 * The card quotes two shapes of "stopped being needed". This answers the first
 * (the package is not in the tree). It does **not** answer the second — an
 * override whose **parents have caught up**, so the floor would be met without
 * it. The lockfile records each dependency's RESOLVED version and never the
 * range its parent declared, so that question needs a resolution run with the
 * override removed (`pnpm install --lockfile-only`) and a lockfile diff — a
 * separate act with its own receipt, not something a static read of the
 * committed artifact can claim. What this reader hands over instead is the
 * input a person needs in order to ask it: the declared range beside the
 * version actually resolved.
 *
 * # NO YAML LIBRARY, ON #1808's OWN PRECEDENT
 *
 * `yaml@2.4.5` resolves in this tree and is **not a declared dependency** — it
 * exists only as an undeclared transitive, exactly as `semver` did when
 * `dependencyOverrideBounds` declined it: *"importing it here would bind a
 * guard to a package the tree never promised to keep."* So the two blocks this
 * reader needs are read explicitly, by line and indentation, and every shape it
 * does not positively recognise is refused rather than guessed at.
 */

/** A refusal: the reader could not answer, and says which artifact defeated it. */
export class OverrideReadingRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverrideReadingRefusal";
  }
}

export type OverrideRow = {
  /** The package the override governs. */
  name: string;
  /** The range declared in `pnpm.overrides`, verbatim. */
  range: string;
  /** Every version of that package the lockfile resolves, ascending by string. */
  versions: string[];
  /** False when the lockfile holds no version of it: the finding. */
  governs: boolean;
};

export type OverrideResolutionReading = {
  rows: OverrideRow[];
  /** The names that govern nothing, in the order they are printed. */
  dead: string[];
  /** Entry counts, so a caller can say what population the verdict rests on. */
  packagesRead: number;
  snapshotsRead: number;
};

/**
 * The `pnpm.overrides` block, refusing an absent or empty one.
 *
 * An empty read must not pass as "nothing to report": with no overrides the
 * only honest answers are "this repository has no override block" and "the file
 * you pointed me at is not the one that has it", and both are refusals.
 */
export function readDeclaredOverrides(
  packageJsonText: string,
): Record<string, string> {
  let parsed: { pnpm?: { overrides?: Record<string, string> } };
  try {
    parsed = JSON.parse(packageJsonText) as typeof parsed;
  } catch (error) {
    throw new OverrideReadingRefusal(
      `package.json is not readable JSON (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
  const overrides = parsed.pnpm?.overrides;
  if (!overrides || Object.keys(overrides).length === 0) {
    throw new OverrideReadingRefusal(
      "package.json declares no `pnpm.overrides` — an empty read cannot pass as a clean reading",
    );
  }
  for (const [name, range] of Object.entries(overrides)) {
    if (typeof range !== "string") {
      throw new OverrideReadingRefusal(
        `override "${name}" declares ${JSON.stringify(range)}, which is not a range`,
      );
    }
  }
  return overrides;
}

/**
 * THE ENTRY KEYS OF ONE TOP-LEVEL LOCKFILE BLOCK.
 *
 * Lockfile v9 writes `packages:` and `snapshots:` as top-level maps whose keys
 * sit at exactly two spaces and are optionally single-quoted:
 *
 *     packages:
 *       tar@7.5.18:
 *       '@aws-sdk/client-s3@3.1135.0':
 *     snapshots:
 *       fast-uri@3.1.8: {}
 *       '@babel/core@7.29.7(supports-color@8.1.1)':
 *       wouter@3.7.1(patch_hash=4e16e6ff…)(react@19.3.0):
 *
 * ⚠ **THE `: {}` FORM IS WHY THIS IS NOT A ONE-LINE REGEX, AND IT WAS MEASURED
 * RATHER THAN FORESEEN.** The first probe written for #1815 matched
 * `/^ {2}(\S+?):$/` and read **457 of the 715 snapshot entries** — the 258 it
 * dropped were the ones with no dependencies, which pnpm writes inline as
 * `name@version: {}`. Among them were `lodash` and `fast-uri`, two of the LIVE
 * overrides, so that reader would have reported five dead where there are
 * three. A regex standing in for something the file states is the class
 * CLAUDE.md names, and the repair is to read the two shapes the format actually
 * has and refuse a third.
 */
export function lockfileBlockKeys(
  lockfileText: string,
  section: string,
): string[] {
  const lines = lockfileText.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.replace(/\s+$/, "") === `${section}:`,
  );
  if (start === -1) {
    throw new OverrideReadingRefusal(
      `pnpm-lock.yaml has no \`${section}:\` block — this reader was written against lockfile v9 and cannot answer without it`,
    );
  }

  const keys: string[] = [];
  for (const raw of lines.slice(start + 1)) {
    const line = raw.replace(/\s+$/, "");
    if (line === "") continue;
    /* A non-indented line is the next top-level key: the block has ended. */
    if (!line.startsWith("  ")) break;
    /* Deeper than two spaces is an entry's body (`resolution:`, `dependencies:`). */
    if (line.startsWith("   ")) continue;

    const body = line.slice(2);
    let key: string;
    let rest: string;
    if (body.startsWith("'")) {
      const close = body.indexOf("'", 1);
      if (close === -1) {
        throw new OverrideReadingRefusal(
          `pnpm-lock.yaml \`${section}:\` has an unterminated quoted key — "${line}"`,
        );
      }
      key = body.slice(1, close);
      rest = body.slice(close + 1);
    } else {
      const colon = body.lastIndexOf(":");
      if (colon === -1) {
        throw new OverrideReadingRefusal(
          `pnpm-lock.yaml \`${section}:\` has an entry this reader cannot parse — "${line}"`,
        );
      }
      key = body.slice(0, colon);
      rest = body.slice(colon);
    }
    /* The two forms the format writes, and nothing else. An unrecognised tail
       means the lockfile's shape has moved and the reader is stale — which is
       worth being told loudly rather than worked around. */
    if (rest !== ":" && rest !== ": {}") {
      throw new OverrideReadingRefusal(
        `pnpm-lock.yaml \`${section}:\` has an entry this reader cannot parse — "${line}"`,
      );
    }
    if (key === "") {
      throw new OverrideReadingRefusal(
        `pnpm-lock.yaml \`${section}:\` has an empty key — "${line}"`,
      );
    }
    keys.push(key);
  }

  if (keys.length === 0) {
    throw new OverrideReadingRefusal(
      `pnpm-lock.yaml \`${section}:\` is empty — a reader that came up empty here would report every override as dead`,
    );
  }
  return keys;
}

/**
 * The package name and version out of one lockfile entry key.
 *
 * The peer and patch suffixes come off first (`name@1.0.0(peer@2.0.0)`), then
 * the LAST `@` separates name from version so a scoped name keeps its own
 * leading one: `@aws-sdk/client-s3@3.1135.0` is `@aws-sdk/client-s3` at
 * `3.1135.0`.
 *
 * The version is NOT validated beyond being non-empty. Every one of the 1,430
 * keys in this tree carries a semver, but pnpm writes a URL or a git reference
 * there for a dependency resolved that way, and refusing those would be a
 * reader inventing a rule the format does not have.
 */
export function packageNameAndVersion(key: string): {
  name: string;
  version: string;
} {
  const base = key.split("(")[0]!;
  const at = base.lastIndexOf("@");
  if (at <= 0 || at === base.length - 1) {
    throw new OverrideReadingRefusal(
      `pnpm-lock.yaml holds the entry key "${key}", which is not a name@version`,
    );
  }
  return { name: base.slice(0, at), version: base.slice(at + 1) };
}

/**
 * Every package version the lockfile resolves, as name -> versions.
 *
 * BOTH blocks are read and unioned, and both must be non-empty. `packages:` is
 * the catalogue of resolutions and `snapshots:` is the graph; they record the
 * same population by different routes, so reading both cannot under-report, and
 * requiring both to be populated is a stricter floor than requiring either.
 */
export function resolvedVersions(lockfileText: string): {
  versions: Map<string, Set<string>>;
  packagesRead: number;
  snapshotsRead: number;
} {
  const versions = new Map<string, Set<string>>();
  const packageKeys = lockfileBlockKeys(lockfileText, "packages");
  const snapshotKeys = lockfileBlockKeys(lockfileText, "snapshots");
  for (const key of [...packageKeys, ...snapshotKeys]) {
    const { name, version } = packageNameAndVersion(key);
    const seen = versions.get(name) ?? new Set<string>();
    seen.add(version);
    versions.set(name, seen);
  }
  return {
    versions,
    packagesRead: packageKeys.length,
    snapshotsRead: snapshotKeys.length,
  };
}

/**
 * The reading: every declared override beside the versions the tree resolves
 * for it, governing entries first and the finding last, so the dead names sit
 * next to the verdict that names them.
 */
export function readOverrideResolution(
  packageJsonText: string,
  lockfileText: string,
): OverrideResolutionReading {
  const declared = readDeclaredOverrides(packageJsonText);
  const { versions, packagesRead, snapshotsRead } =
    resolvedVersions(lockfileText);

  const rows: OverrideRow[] = Object.entries(declared)
    .map(([name, range]) => {
      const resolved = [...(versions.get(name) ?? [])].sort();
      return { name, range, versions: resolved, governs: resolved.length > 0 };
    })
    /* Governing first, the finding last, so the dead names sit immediately
       above the verdict line that names them. */
    .sort(
      (a, b) => Number(b.governs) - Number(a.governs) || a.name.localeCompare(b.name),
    );

  return {
    rows,
    dead: rows.filter((row) => !row.governs).map((row) => row.name),
    packagesRead,
    snapshotsRead,
  };
}
