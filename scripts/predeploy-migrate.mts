/**
 * THE PRE-DEPLOY MIGRATION — the #322 applier on the merge road (#508 D3).
 *
 * Runs as the Drape service's pre-deploy command (`node dist/predeploy.js`,
 * bundled by `pnpm build`), inside Railway's own environment, between the
 * build and the moment the new build takes traffic. Railway's contract: a
 * non-zero exit ABORTS the deploy and the old build keeps serving.
 *
 * Why it exists: until #508, migrations applied only when the deploy rite ran
 * — which the merge road never does, and which ran AFTER the deploy was live
 * even on its own road, so new code could boot ahead of its table. This is
 * the same applier (`scripts/lib/ceremonyAutoApply.mts` — additive statements
 * applied, destructive statements refused and NAMED for the founder's own
 * hand), moved to before the cutover, on every road.
 *
 * What blocks and what does not is `scripts/lib/predeployVerdict.mts`'s one
 * decision — a failed WRITE refuses the deploy; a WAITING ceremony is printed
 * and lets the deploy proceed. See its header for the reasoning.
 *
 * # It refuses to run outside Railway
 *
 * On the platform, `DATABASE_URL` is production by construction. On a laptop
 * it is whatever `.env` names — usually dev — and a "successful" local run
 * would be false confidence about a world it never touched. The rehearsal
 * road for this file's logic is the rite (same lib, every push) and the
 * driven arms in `server/ceremonyAutoApply.test.ts` / `server/
 * predeployVerdict.test.ts`.
 *
 * # No driver error text in the refusal
 *
 * Same rule as the rite's database reads: a connection error can carry the
 * DSN it was handed. `error.code` (ECONNREFUSED, ER_ACCESS_DENIED_ERROR…) is
 * printed instead — enough to diagnose, never a credential.
 */
import { readFileSync, readdirSync } from "node:fs";

import {
  autoApplyMigrations,
  migrationFilesFrom,
  readSchemaGap,
  type MissingObjects,
} from "./lib/ceremonyAutoApply.mts";
import { predeployVerdict } from "./lib/predeployVerdict.mts";
import { closeLine, closeWithin } from "./lib/boundedClose.mts";
import { openDatabase, worldOf } from "./lib/dbConnection.mts";

const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT);
const url = process.env.DATABASE_URL;

const code = await (async (): Promise<number> => {
  if (!onRailway) {
    console.log("predeploy: REFUSED — not running inside Railway (neither RAILWAY_ENVIRONMENT_NAME nor RAILWAY_ENVIRONMENT is set).");
    console.log("  This command migrates the environment it runs in; a laptop run would touch whatever .env names.");
    return 1;
  }
  if (!url) {
    console.log("predeploy: REFUSED — DATABASE_URL is not set, so nothing about the schema can be read.");
    return 1;
  }
  console.log(`predeploy: ${worldOf(url)}`);

  let connection: Awaited<ReturnType<typeof openDatabase>> | null = null;
  try {
    connection = await openDatabase(url);
    const schemaSource = readFileSync("drizzle/schema.ts", "utf8");

    /* The reading is the LIB's (`readSchemaGap`) — the same closure the rite
       plans against, with only the query runner injected, so the two deploy
       roads cannot drift apart on what "missing" means (review of #584,
       finding 1; working law 4). */
    const read = async (): Promise<MissingObjects> =>
      (await readSchemaGap(schemaSource, async (sql) => (await connection!.query<any[]>(sql))[0] as any[])).missing;

    const report = await autoApplyMigrations({
      missing: await read(),
      readBack: read,
      execute: async (sql) => { await connection!.query(sql); },
      listMigrations: () => migrationFilesFrom(readdirSync, (file) => readFileSync(file, "utf8")),
      dry: false,
    });
    const verdict = predeployVerdict(report);
    for (const line of verdict.lines) console.log(`  ${line}`);
    return verdict.exitCode;
  } catch (error: any) {
    console.log("predeploy: REFUSED — the schema could not be read or the applier could not run,");
    console.log("  so nothing proves the new build's tables exist. The old build keeps serving.");
    console.log(`  (${error?.constructor?.name ?? "Error"}${error?.code ? ` · ${error.code}` : ""})`);
    return 1;
  } finally {
    /*
      ⚠ A BOUNDED CLOSE, AND THE OLD ONE COST A DEPLOY (#1745).

      This was `try { await connection?.end(); } catch {}` — and a MySQL
      `end()` waits for the server to acknowledge its quit packet, which on a
      half-dead socket never comes. On 2026-10-02 this line printed its verdict
      at 00:49:44 and then held the pre-deploy container for TEN MINUTES;
      Railway killed it and failed the deployment of a green, healthy build.
      `await` has no clock, so there was nothing to see and nothing to time out.

      The comment that was here — *"the verdict is already decided"* — was the
      argument for bounding it, written beside the code that did not.
      `closeWithin` races the close against two seconds and destroys the socket
      instead; `process.exit` below is the next statement either way, and the
      exit code is the only thing the platform reads.
    */
    const line = closeLine(await closeWithin(connection));
    if (line) console.log(`  ${line}`);
  }
})();

process.exit(code);
