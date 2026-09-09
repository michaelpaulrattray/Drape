/**
 * DISPOSABLE — the sabotage receipt for #726's repair of
 * `server/security/securityHeaders.test.ts`.
 *
 * #726's bar: *"Proven by sabotage of the product, in the shape
 * `scripts/_697-adminsecurity-sabotage-disposable.mts` uses: the reddened set
 * asserted exactly, with a no-op control."* This is that, and it keeps the two
 * habits from #697 and #725 that have caught a lying driver three times:
 *   · ARM 0 is a NO-OP sabotage and must redden NOTHING.
 *   · Every arm asserts the reddened set EXACTLY, never "at least".
 *
 * ⚠ **THE NEGATIVE CONTROL IS TWO ARMS, NOT ONE, AND THAT IS THE WHOLE CARD.**
 * `THE DEV RELAXATION SHIPS` and `PRODUCTION'S RULES REACH DEV` pin the regime
 * in each direction.
 *
 * ⚠ **AND MY FIRST DESCRIPTION OF THE OLD SUITE HERE WAS WRONG — MEASURED
 * RATHER THAN REASONED, AND KEPT AS THE CORRECTION IT IS.** I wrote that both
 * of those sabotages reddened nothing against the pre-repair file. Driven at
 * `origin/main`'s copy:
 *
 *   · `isDev = true` .................... **2 red** (the X-Frame arm and the count)
 *   · `isDev = false` ................... **0 red**
 *
 * The first caught it by ACCIDENT, and the accident is the point: the old arms
 * branched on `process.env.NODE_ENV`, which was still `"test"`, while the
 * product had been pinned to a literal — so the two disagreed only because the
 * sabotage decoupled them. **The failure that actually threatens the product is
 * the one where they move TOGETHER**, and that was measured too:
 *
 *   · OLD suite, `NODE_ENV=development`, product untouched ....... 9/9 GREEN
 *   · OLD suite, `NODE_ENV=development`, `frame-ancestors *` in
 *     EVERY regime — the production frame policy thrown away ..... 9/9 GREEN
 *   · NEW suite, same machine regime, same sabotage ............... 1 RED
 *
 * A suite that agrees with whichever regime it finds itself in cannot fail; on
 * any machine with `NODE_ENV=development` in its environment, production's
 * frame-ancestors guarantee had no guard at all.
 *
 * Run: npx tsx scripts/_726-securityheaders-sabotage-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "server/security/securityHeaders.test.ts";
const OUT = path.join(ROOT, "_726-sabotage-result.json");
const SRC = "server/security/securityHeaders.ts";

/* Arm titles, named once so a rename cannot leave a prediction pointing at nothing. */
const P_FRAMING = "refuses framing outright — X-Frame-Options DENY";
const P_ANCESTORS = "⚠ and says the same thing in the CSP, which is the directive browsers actually honour";
const P_NO_UNSAFE = "⚠ carries NO 'unsafe-inline' and NO 'unsafe-eval' in script-src — the dev relaxation must not ship";
const P_NO_WS = "opens no WebSocket origin — the HMR allowance is dev-only";
const P_NINE = "sets all NINE headers";
const D_NO_FRAMING = "skips X-Frame-Options entirely";
const D_ANCESTORS = "allows framing in the CSP too";
const D_UNSAFE = "allows the inline and eval scripts Vite's HMR needs";
const D_WS = "allows the HMR WebSocket";
const D_EIGHT = "sets EIGHT headers — one fewer, and it is the framing one";
const R2_PRESENT = "puts the configured origin into img-src";
const R2_SLASH = "strips a trailing slash rather than emitting a broken origin";
const HSTS = "forces HTTPS for a year, including subdomains";

/** The regime-independent block runs once per regime, so its arms redden in pairs. */
const BOTH = (title: string) => [title, title];

type Sabotage = { name: string; find: string; replace: string; expect: string[] };

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    find: "export function securityHeaders(",
    replace: "/* sabotage no-op */ export function securityHeaders(",
    expect: [],
  },
  {
    /* ⚠ NEGATIVE CONTROL 1 — against the OLD suite this reddened nothing:
       `expectedCount = isDev ? 8 : 9` and the X-Frame arm's own `if` both
       followed the product into dev and agreed with it. */
    name: "THE DEV RELAXATION SHIPS — isDev is always true",
    find: 'const isDev = process.env.NODE_ENV === "development";',
    replace: "const isDev = true;",
    expect: [P_FRAMING, P_ANCESTORS, P_NO_UNSAFE, P_NO_WS, P_NINE].sort(),
  },
  {
    /* ⚠ NEGATIVE CONTROL 2 — the other direction, and the one that proves the
       dev arms are real rather than decoration. */
    name: "PRODUCTION'S RULES REACH DEV — isDev is always false",
    find: 'const isDev = process.env.NODE_ENV === "development";',
    replace: "const isDev = false;",
    expect: [D_NO_FRAMING, D_ANCESTORS, D_UNSAFE, D_WS, D_EIGHT].sort(),
  },
  {
    name: "FRAMING IS ALLOWED IN PRODUCTION — the X-Frame-Options header is skipped",
    find: "  if (!isDev) {\n    res.setHeader(\"X-Frame-Options\", \"DENY\");\n  }",
    replace: "  if (false) {\n    res.setHeader(\"X-Frame-Options\", \"DENY\");\n  }",
    expect: [P_FRAMING, P_NINE].sort(),
  },
  {
    name: "THE CSP STOPS REFUSING ANCESTORS — 'none' becomes * in every regime",
    find: 'isDev ? "frame-ancestors *" : "frame-ancestors \'none\'",',
    replace: '"frame-ancestors *",',
    expect: [P_ANCESTORS],
  },
  {
    name: "'unsafe-inline' REACHES THE PRODUCTION script-src",
    find: "`script-src 'self' '${THEME_BOOT_SCRIPT_HASH}' https://js.stripe.com`",
    replace: "`script-src 'self' 'unsafe-inline' '${THEME_BOOT_SCRIPT_HASH}' https://js.stripe.com`",
    expect: [P_NO_UNSAFE],
  },
  {
    name: "THE HMR WEBSOCKET ORIGIN SHIPS — the dev connect-src is used everywhere",
    find: '  : "connect-src \'self\' https://api.stripe.com";',
    replace: "  : \"connect-src 'self' https://api.stripe.com ws://localhost:*\";",
    expect: [P_NO_WS],
  },
  {
    name: "THE BUCKET LEAVES img-src — persisted image URLs stop rendering",
    find: "`img-src 'self' data: blob: ${r2PublicOrigin} https://*.amazonaws.com",
    replace: "`img-src 'self' data: blob: https://*.amazonaws.com",
    expect: [R2_PRESENT, R2_SLASH].sort(),
  },
  {
    name: "THE TRAILING SLASH SURVIVES — a configured origin ending in / ships broken",
    find: 'const r2PublicOrigin = (process.env.R2_PUBLIC_URL ?? "").replace(/\\/+$/, "");',
    replace: 'const r2PublicOrigin = (process.env.R2_PUBLIC_URL ?? "");',
    expect: [R2_SLASH],
  },
  {
    /* A regime-independent header, to prove that block reddens in BOTH regimes
       rather than in whichever one the machine happened to be in. */
    name: "HSTS IS WEAKENED — one day instead of a year",
    find: '"Strict-Transport-Security", "max-age=31536000; includeSubDomains"',
    replace: '"Strict-Transport-Security", "max-age=86400"',
    expect: BOTH(HSTS),
  },
];

function runSuite(): { failed: string[]; total: number } {
  if (existsSync(OUT)) rmSync(OUT);
  try {
    execFileSync(
      "npx",
      ["vitest", "run", SUITE, "--reporter=json", `--outputFile=${OUT}`],
      { cwd: ROOT, stdio: "pipe", shell: true },
    );
  } catch {
    /* a red suite exits non-zero — that is the point; the JSON is what we read */
  }
  if (!existsSync(OUT)) throw new Error("vitest produced no JSON report");
  const report = JSON.parse(readFileSync(OUT, "utf8")) as {
    testResults: { assertionResults: { title: string; status: string }[] }[];
  };
  const arms = report.testResults.flatMap((file) => file.assertionResults);
  if (arms.length === 0) throw new Error("the report holds no arms at all");
  return {
    failed: arms.filter((arm) => arm.status === "failed").map((arm) => arm.title).sort(),
    total: arms.length,
  };
}

let EXIT_CODE = 0;

function main(): void {
  console.log("=== the suite must be GREEN before any sabotage ===");
  const base = runSuite();
  if (base.failed.length > 0) {
    console.error(`REFUSING — the suite is already red:\n  ${base.failed.join("\n  ")}`);
    rmSync(OUT, { force: true });
    process.exit(1);
  }
  console.log(`  ${base.total} arms, 0 red. Proceeding.\n`);

  let pass = 0;
  const findings: string[] = [];
  const abs = path.join(ROOT, SRC);

  for (const sabotage of SABOTAGES) {
    const original = readFileSync(abs, "utf8");
    const occurrences = original.split(sabotage.find).length - 1;
    try {
      if (occurrences !== 1) {
        findings.push(`${sabotage.name}: anchor matched ${occurrences} times in ${SRC}, expected exactly 1`);
        console.log(`X ${sabotage.name}\n    anchor matched ${occurrences} times — NOT DRIVEN`);
        continue;
      }
      writeFileSync(abs, original.replace(sabotage.find, sabotage.replace), "utf8");
      const got = runSuite().failed;
      const want = [...sabotage.expect].sort();
      const same = want.length === got.length && want.every((entry, index) => entry === got[index]);
      if (same) {
        pass += 1;
        console.log(`OK ${sabotage.name}\n    reddened exactly ${got.length}: ${got.join(" | ") || "(nothing, as required)"}`);
      } else {
        findings.push(
          `${sabotage.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${got.join(" | ") || "(nothing)"}`,
        );
        console.log(`X ${sabotage.name}\n    wanted: ${want.join(" | ") || "(nothing)"}\n    got:    ${got.join(" | ") || "(nothing)"}`);
      }
    } finally {
      writeFileSync(abs, original, "utf8");
    }
  }

  rmSync(OUT, { force: true });
  console.log(`\n=== ${pass}/${SABOTAGES.length} sabotages behaved exactly as claimed ===`);
  if (findings.length > 0) {
    console.log("\nFINDINGS:");
    for (const finding of findings) console.log(`  · ${finding}`);
    EXIT_CODE = 1;
  }
}

main();
process.exit(EXIT_CODE);
