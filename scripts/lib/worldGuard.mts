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
 * fine. **This DOES arise** — the R2 endpoint and credential are identical in
 * dev and production — which is why callers declare
 * `WORLD_DISCRIMINATING_KEYS` rather than every key they touch. See that
 * constant for the measurement and the rule it produced.
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

/**
 * THE KEYS THE APP'S OWN WRITE PATH READS — for scripts that run app services
 * in-process rather than talking to a running server.
 *
 * # The third bite, and why declaring by hand kept failing
 *
 * The guard protects what a caller TELLS it the answer rests on, and twice now
 * a caller has told it the truth about itself and been wrong about its
 * dependencies:
 *
 *   1. A probe declared nothing and asked the DEV bucket for a PRODUCTION key.
 *   2. `bespectacled-roll-production` declared `MYSQL_PUBLIC_URL`, but called
 *      `getDb()`, which reads `DATABASE_URL` — eight faces cast into the dev
 *      database while every console line said production.
 *   3. The same script, repaired, then declared `DATABASE_URL` too — and cast a
 *      **paid** sheet whose ROWS landed in production and whose **BYTES landed
 *      in the dev bucket**, because `createRoll → storagePut → ENV.r2*` is
 *      three frames below the line anybody was reading. Production 404s all
 *      eight; the dev bucket serves all eight; 160 credits bought a tray of
 *      broken tiles on the founder's own account.
 *
 * Each time the declaration was honest and incomplete, and incomplete in a
 * direction nobody could see from the call site. So the answer is not "declare
 * harder" — it is a NAMED SET a script can point at, maintained beside the
 * guard, so the knowledge lives once instead of in each author's head.
 *
 *   > Declare the variable your DEPENDENCIES read, not the one you read.
 *   > A helper's hidden key is still your reliance.
 *
 * Anything that calls `createRoll`, `refine`, `sign`, `storagePut` or any other
 * app service in-process is writing objects, so it declares these. In practice
 * that means it must run under a service that defines them all — `--service
 * Drape` — because `--service MySQL` defines none of them and dotenv will
 * quietly supply five dev values.
 */
export const APP_WRITE_PATH_KEYS = [
  /* `getDb()` / drizzle. */
  "DATABASE_URL",
  /* `server/storage.ts` via `ENV`, every one of them. */
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

/**
 * THE KEYS THAT ACTUALLY DECIDE WHICH WORLD AN ANSWER IS ABOUT — measured,
 * after this module's header turned out to be two-thirds right.
 *
 * The header claimed "the bucket, its base URL and the database differ between
 * dev and production", and used that to argue the equality test could not
 * produce a false refusal. Driven against the real services, it is wrong:
 *
 *   DATABASE_URL, R2_BUCKET, R2_PUBLIC_URL   differ    → they discriminate
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *                                            IDENTICAL → they cannot
 *
 * Production and dev are the same R2 account with the same credential; only the
 * bucket and its base differ. So the correct invocation
 * (`railway run --service Drape`, which defines all six itself) was refused by
 * the guard for three keys whose value is the same in both worlds.
 *
 * And that false refusal is not merely annoying — it is the shape that teaches
 * people to stop declaring keys, which is how all three bites happened. So the
 * rule is stated as narrowly as the evidence supports:
 *
 *   > A key whose two worlds hold the SAME value cannot carry an answer to the
 *   > wrong world, no matter who supplied it. Only a key that differs can, and
 *   > only those are worth refusing over.
 *
 * If production's credential is ever rotated away from dev's — and it should
 * be — these keys start discriminating and belong in the list below. That is a
 * one-line change, and the sentence above is the test for making it.
 */
export const WORLD_DISCRIMINATING_KEYS = [
  "DATABASE_URL",
  "MYSQL_PUBLIC_URL",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

/**
 * EVERY KEY THIS PROCESS RELIES ON IS ACTUALLY THERE.
 *
 * The companion to the mixture check, and the half with teeth when `.env` is
 * NOT loaded: under `railway run --service MySQL` the five R2 keys are simply
 * absent, and absent is the state that dotenv converts into a silent dev value.
 * Refusing by name on absence is what makes the substitution impossible to miss
 * rather than merely improbable.
 */
export function assertDefinedByService(keys: readonly string[]): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length === 0) return;
  throw new Error(
    `Missing: ${missing.join(", ")} — this process relies on ${missing.length === 1 ? "it" : "them"} and `
    + `the environment does not supply ${missing.length === 1 ? "it" : "them"}. `
    + `Run under a service that defines the whole set (\`railway run --service Drape\`), `
    + `and never let a local .env quietly fill the gap.`,
  );
}

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
    ["R2_BUCKET", "drape-dev"],
    ["DATABASE_URL", "mysql://dev"],
    /* Identical in both worlds — the real shape, so the shared-credential
       control is driven against a fixture that actually shares. */
    ["R2_ACCESS_KEY_ID", "the-one-account"],
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
    {
      /*
        The third bite, driven: rows pointed at production by hand, bucket left
        to dotenv. Declaring only the database is what let this through — the
        set is what catches it.
      */
      name: "POSITIVE — a paid roll: DATABASE_URL pointed at production, R2 left to .env",
      environment: {
        RAILWAY_ENVIRONMENT_NAME: "production",
        DATABASE_URL: "mysql://production",
        R2_PUBLIC_URL: "https://pub-DEV.r2.dev",
        R2_BUCKET: "drape-dev",
      },
      keys: WORLD_DISCRIMINATING_KEYS,
      expect: 2,
    },
    {
      name: "NEGATIVE — the same roll run under a service that defines the whole set",
      environment: {
        RAILWAY_ENVIRONMENT_NAME: "production",
        DATABASE_URL: "mysql://production",
        R2_PUBLIC_URL: "https://pub-PROD.r2.dev",
        R2_BUCKET: "drape-production",
      },
      keys: WORLD_DISCRIMINATING_KEYS,
      expect: 0,
    },
    {
      /*
        THE FALSE REFUSAL THAT SENT ME BACK TO THE HEADER. Production and dev
        share the R2 credential, so a correct `--service Drape` run holds three
        keys equal to `.env` and is entirely fine. Declaring only the
        discriminating keys is what tells the two cases apart.
      */
      name: "NEGATIVE — shared credentials: identical in both worlds, so they cannot mislead",
      environment: {
        RAILWAY_ENVIRONMENT_NAME: "production",
        DATABASE_URL: "mysql://production",
        R2_BUCKET: "drape-production",
        R2_ACCESS_KEY_ID: "the-one-account",
      },
      keys: WORLD_DISCRIMINATING_KEYS,
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
