/**
 * THE OVERRIDE-RESOLUTION READING — `pnpm warden:overrides` (#1815).
 *
 * Prints every `pnpm.overrides` entry beside the version the tree actually
 * resolves for it, and names the ones that govern no package at all. The
 * reader, the measurements behind it, the two roads declined and the question
 * it deliberately does not answer are all in
 * `scripts/lib/overrideResolution.mts`; this file is the command.
 *
 *     pnpm warden:overrides
 *     npx tsx scripts/override-resolution-read.mts --package-json <p> --lockfile <p>
 *
 * No database, no network, no install — it reads two committed files, so it is
 * free, offline and runnable on a clean clone.
 *
 * **Exit 0 whatever it finds; exit 1 only when it cannot answer.** A dead
 * override is litter with a hygiene question attached, not a fault (#1815's own
 * words), and whether one is removed is a separate decision with its own
 * receipt. A refusal is the opposite: it means the verdict below is not
 * evidence, and it says which artifact defeated it.
 *
 * Unknown flags are REFUSED rather than ignored — the crew writers' rule, from
 * the shift that appended `--dry-run` to a script that had never heard of it
 * and stamped a running row terminal (#288).
 */
import { readFileSync } from "node:fs";

import {
  OverrideReadingRefusal,
  readOverrideResolution,
} from "./lib/overrideResolution.mts";

type Args = { packageJson: string; lockfile: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { packageJson: "package.json", lockfile: "pnpm-lock.yaml" };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--package-json") {
      if (!value) throw new OverrideReadingRefusal("--package-json needs a path");
      args.packageJson = value;
      i += 1;
    } else if (flag === "--lockfile") {
      if (!value) throw new OverrideReadingRefusal("--lockfile needs a path");
      args.lockfile = value;
      i += 1;
    } else {
      throw new OverrideReadingRefusal(
        `unknown flag "${flag}" — this reader takes --package-json and --lockfile only`,
      );
    }
  }
  return args;
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new OverrideReadingRefusal(
      `cannot read ${path} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function main(argv: string[]): number {
  let reading: ReturnType<typeof readOverrideResolution>;
  let args: Args;
  try {
    args = parseArgs(argv);
    reading = readOverrideResolution(read(args.packageJson), read(args.lockfile));
  } catch (error) {
    if (error instanceof OverrideReadingRefusal) {
      console.error(`override-resolution REFUSES: ${error.message}`);
      console.error(
        "An override that governs nothing looks exactly like a reader that read nothing, so this stops rather than printing a verdict it cannot stand behind.",
      );
      return 1;
    }
    throw error;
  }

  const width = Math.max(...reading.rows.map((row) => row.name.length));
  const ranges = Math.max(...reading.rows.map((row) => row.range.length));

  console.log(
    "PNPM OVERRIDE RESOLUTION — which overrides govern a package that is in the tree",
  );
  console.log(
    `${args.packageJson.replace(/\\/g, "/")} + ${args.lockfile.replace(/\\/g, "/")} · ${reading.packagesRead} packages, ${reading.snapshotsRead} snapshots read\n`,
  );

  for (const row of reading.rows) {
    const verdict = row.governs
      ? `resolves ${row.versions.join(", ")}`
      : "GOVERNS NOTHING";
    console.log(
      `  ${row.name.padEnd(width)}  ${row.range.padEnd(ranges)}  ${verdict}`,
    );
  }

  console.log("");
  if (reading.dead.length === 0) {
    console.log(
      `All ${reading.rows.length} overrides govern a package in this tree. Nothing to report.`,
    );
  } else {
    console.log(
      `${reading.dead.length} of ${reading.rows.length} overrides govern no package in this tree: ${reading.dead.join(", ")}.`,
    );
    console.log(
      "Each holds no floor today and is indistinguishable, inside package.json, from one that does.",
    );
    console.log(
      "This is litter with a hygiene question attached, not a fault — a bounded dead override",
    );
    console.log(
      "becomes a live floor the moment its package returns as a transitive, so removal is its own",
    );
    console.log(
      "decision with its own receipt (#1815) and this reader does not take it.",
    );
    console.log(
      "`pnpm why <name>` is the independent second reader; it shares no resolver with this one.",
    );
  }

  console.log("");
  console.log(
    "It does NOT answer whether a LIVE override has become redundant because its parents caught",
  );
  console.log(
    "up: the lockfile records resolved versions, never the ranges parents declare. That needs a",
  );
  console.log(
    "resolution run with the override removed, which is a separate act.",
  );
  return 0;
}

process.exit(main(process.argv.slice(2)));
