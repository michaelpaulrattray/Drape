/**
 * REFUSE TO MIX TWO WORLDS IN ONE PROCESS.
 *
 * # The mistake this exists to make impossible
 *
 * Shift 3 reported that a live candidate's original image "404s on the public
 * bucket", could not use her own face as the speck counter's baseline because
 * of it, and passed the finding up as a possible product defect. It was not.
 * Her master is present and served, HTTP 200: the script had asked the **dev**
 * bucket for a **production** key.
 *
 * Nothing in the script was careless. It ran under
 * `railway run --service MySQL`, which injects the MySQL service's variables —
 * and the MySQL service has no `R2_PUBLIC_URL`. The script also did
 * `import "dotenv/config"`, which fills anything Railway left empty from the
 * developer's local `.env`. dotenv never overwrites, so the halves the service
 * defines are genuinely production; the halves it does not are silently local.
 * A process holding a production database URL and a dev bucket base looks
 * completely normal and answers every question wrongly in one direction.
 *
 * `.env` is not the culprit either — it is doing exactly what it is for. The
 * culprit is that the substitution is SILENT, and a 404 from the wrong bucket
 * is indistinguishable from a 404 from the right one.
 *
 * # What it checks
 *
 * If the process is inside a Railway run (`RAILWAY_ENVIRONMENT_NAME` is set)
 * and a world-defining variable currently holds **the same value the local
 * `.env` file gives it**, that value did not come from Railway. It refuses.
 *
 * Comparing against the file rather than against load order is deliberate:
 * ESM hoists imports, so a guard that tried to observe "what dotenv added"
 * would depend on which import line came first — exactly the kind of ordering
 * a future script gets wrong once and nobody notices. The file is the same
 * fact from a direction that cannot be reordered.
 *
 * A shared value between the two worlds would refuse a run that was actually
 * fine. That is the safe direction, and it does not currently arise: the
 * bucket, its base URL and the database differ between dev and production.
 *
 *   npx tsx scripts/lib/worldGuard.mts --prove   # drives both controls
 */
import { existsSync, readFileSync } from "node:fs";

/**
 * The variables that decide WHICH WORLD an answer is about.
 *
 * Not every variable — a local `LOG_LEVEL` inside a production run is nobody's
 * problem. These are the ones where a local value turns a true reading into a
 * false one: the database the rows come from, and the bucket the bytes do.
 */
const WORLD_KEYS = [
  "DATABASE_URL",
  "MYSQL_PUBLIC_URL",
  "R2_PUBLIC_URL",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

/** The local `.env`, parsed the way dotenv parses it — enough of it, anyway. */
export function readLocalEnvFile(path = ".env"): Map<string, string> {
  const values = new Map<string, string>();
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    values.set(match[1]!, match[2]!.trim().replace(/^["']|["']$/g, ""));
  }
  return values;
}

export type MixedWorld = { key: string };

/** The finding, separated from the throwing so it can be driven in a control. */
export function findLocalValuesInsideRailway(
  environment: Record<string, string | undefined>,
  localFile: Map<string, string>,
  /**
   * The world-keys this caller actually reads. Default: all of them.
   *
   * A script that only touches the database should not be stopped by a dev
   * bucket base it never looks at — that is the boy who cried wolf, and a
   * guard people learn to work around is a guard that is off. Declaring the
   * dependency is also the honest thing: it says what the answer rests on.
   */
  keys: readonly string[] = WORLD_KEYS,
): MixedWorld[] {
  if (!environment.RAILWAY_ENVIRONMENT_NAME) return [];
  const mixed: MixedWorld[] = [];
  for (const key of keys) {
    const live = environment[key];
    if (live === undefined) continue;
    if (localFile.get(key) === live) mixed.push({ key });
  }
  return mixed;
}

/**
 * Refuse, loudly and by name, rather than answer about a world nobody chose.
 *
 * Call it after the imports in any script that reads production rows or
 * production objects. It is inert outside a Railway run, so a plain
 * `npx tsx` invocation against dev is unaffected.
 */
export function assertOneWorld(keys?: readonly string[]): void {
  const mixed = findLocalValuesInsideRailway(process.env, readLocalEnvFile(), keys);
  if (mixed.length === 0) return;
  const names = mixed.map((entry) => entry.key).join(", ");
  throw new Error(
    `Mixed worlds: ${names} currently hold${mixed.length === 1 ? "s" : ""} the value from your local .env, `
    + `inside a Railway run of "${process.env.RAILWAY_ENVIRONMENT_NAME}" `
    + `(service ${process.env.RAILWAY_SERVICE_NAME ?? "?"}). `
    + `That service does not define ${mixed.length === 1 ? "it" : "them"}, so dotenv filled the gap and this process `
    + `is half production and half dev. Run under a service that defines ${names}, or pass ${names} explicitly.`,
  );
}

/* ---------------------------------------------------------------- controls */

if (process.argv.includes("--prove")) {
  const local = new Map([
    ["R2_PUBLIC_URL", "https://pub-DEV.r2.dev"],
    ["DATABASE_URL", "mysql://dev"],
  ]);

  const cases: {
    name: string;
    environment: Record<string, string | undefined>;
    keys?: readonly string[];
    expect: number;
  }[] = [
    {
      name: "NEGATIVE — outside Railway entirely (plain npx tsx against dev)",
      environment: { R2_PUBLIC_URL: "https://pub-DEV.r2.dev" },
      expect: 0,
    },
    {
      name: "NEGATIVE — inside Railway, the service supplies its own base",
      environment: { RAILWAY_ENVIRONMENT_NAME: "production", R2_PUBLIC_URL: "https://pub-PROD.r2.dev" },
      expect: 0,
    },
    {
      name: "NEGATIVE — inside Railway, key absent everywhere",
      environment: { RAILWAY_ENVIRONMENT_NAME: "production" },
      expect: 0,
    },
    {
      name: "POSITIVE — the real mistake: MySQL service, dev bucket base from .env",
      environment: { RAILWAY_ENVIRONMENT_NAME: "production", R2_PUBLIC_URL: "https://pub-DEV.r2.dev" },
      expect: 1,
    },
    {
      name: "POSITIVE — the nastier sibling: the DATABASE is the local one",
      environment: {
        RAILWAY_ENVIRONMENT_NAME: "production",
        DATABASE_URL: "mysql://dev",
        R2_PUBLIC_URL: "https://pub-DEV.r2.dev",
      },
      expect: 2,
    },
    {
      name: "NEGATIVE — the same mixed env, but the caller declares it reads only the database",
      environment: { RAILWAY_ENVIRONMENT_NAME: "production", R2_PUBLIC_URL: "https://pub-DEV.r2.dev" },
      keys: ["MYSQL_PUBLIC_URL"],
      expect: 0,
    },
  ];

  let failures = 0;
  for (const testCase of cases) {
    const found = findLocalValuesInsideRailway(testCase.environment, local, testCase.keys);
    const pass = found.length === testCase.expect;
    if (!pass) failures += 1;
    console.log(`${pass ? "PASS" : "FAIL"}  ${testCase.name}`
      + `  (found ${found.length}, expected ${testCase.expect}${found.length ? `: ${found.map((f) => f.key).join(",")}` : ""})`);
  }
  console.log(failures === 0
    ? "\nThe guard fires on the mistake that was made, and stays quiet on three ways of being fine."
    : `\n${failures} control(s) failed — the guard is not trustworthy.`);
  process.exit(failures === 0 ? 0 : 1);
}
