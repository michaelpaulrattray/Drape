/**
 * THE 0050 CEREMONY'S OWN ARM — driven against a real database, because a
 * refusal that has never fired is a refusal nobody has seen (working law 2).
 *
 *   npx tsx scripts/arm-ink-rekey-ceremony-disposable.mts --dev
 *
 * DEV ONLY, and it refuses any other world outright: this script deliberately
 * puts the table into a WRONG state to prove the ceremony notices, and there is
 * no state of production worth doing that to.
 *
 * # What it proves, and why each arm exists
 *
 * The ceremony has one check a `CREATE` ceremony never needs and it is the one
 * that can silently half-happen: **the OLD key is read back ABSENT.** Leave
 * `uq_casting_ink_delivery_crops_design` in place and every words-only delivery
 * still refuses on a NULL-repeating index nobody is looking at — the feature
 * appears to land and keeps failing for the exact lane it was built for.
 *
 * So the arm plants that state: it re-creates the old index beside the new one
 * and asserts the ceremony REFUSES, with a message naming the old key rather
 * than merely failing (`arm-asserts-its-own-reason` — a run that refused for
 * some unrelated reason would print PROVEN over a check that does nothing).
 *
 * The second arm is the negative control and it is not a formality: after the
 * planted index is dropped, the ceremony must pass again. Without it, a
 * ceremony that refused unconditionally would satisfy arm one.
 *
 * # It restores what it planted, and says so
 *
 * The plant is one `CREATE INDEX` and the restore is its `DROP`. Both are
 * printed, and the final state is read back off the database rather than
 * assumed from the fact that a statement did not throw.
 */
import { execFileSync } from "node:child_process";

import { closeCeremony, openCeremonyWorld } from "./lib/ceremony.mts";

const TABLE = "casting_ink_delivery_crops";
const OLD_KEY = "uq_casting_ink_delivery_crops_design";
const CEREMONY = "scripts/ceremony-ink-delivery-rekey.mts";

/** The ceremony as the founder would run it: exit code AND what it printed. */
function runCeremony(): { code: number; output: string } {
  try {
    const output = execFileSync("npx", ["tsx", CEREMONY, "--dev"], {
      cwd: process.cwd(), encoding: "utf8", shell: true,
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

async function indexPresent(
  connection: Awaited<ReturnType<typeof openCeremonyWorld>>["connection"],
  name: string,
): Promise<boolean> {
  const [rows] = await connection.query<any[]>(
    `SHOW INDEX FROM \`${TABLE}\` WHERE Key_name = ?`, [name],
  );
  return rows.length > 0;
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
let planted = false;
try {
  if (world.world !== "dev") {
    throw new Error(`this arm plants a wrong index on purpose and runs on DEV alone — got ${world.world}`);
  }

  /* The state under test is the one the ceremony leaves behind, so it has to
     be there before anything is planted. */
  const before = runCeremony();
  if (before.code !== 0) {
    throw new Error(`the ceremony does not pass on this database to begin with — nothing here would mean anything:\n${before.output}`);
  }
  console.log("baseline    the ceremony passes  PASS");

  /* ---- ARM 1: the old key, planted. ---- */
  await world.connection.query(
    `CREATE UNIQUE INDEX \`${OLD_KEY}\` ON \`${TABLE}\` (\`candidateId\`,\`designId\`,\`slot\`)`,
  );
  planted = true;
  console.log(`planted     ${OLD_KEY} back onto the table`);

  const refused = runCeremony();
  const namesTheKey = refused.output.includes(OLD_KEY);
  const saysWhy = refused.output.includes("words-only");
  const armOne = refused.code !== 0 && namesTheKey && saysWhy;
  console.log(
    `  arm 1     the ceremony REFUSES a surviving old key  ${armOne ? "PASS" : "FAIL"}`
    + `  (exit ${refused.code}, names the key: ${namesTheKey}, says why: ${saysWhy})`,
  );

  /* ---- restore, then ARM 2: the negative control. ---- */
  await world.connection.query(`DROP INDEX \`${OLD_KEY}\` ON \`${TABLE}\``);
  planted = false;
  console.log(`restored    ${OLD_KEY} dropped again`);

  const after = runCeremony();
  const armTwo = after.code === 0;
  console.log(`  arm 2     and PASSES once it is gone — the negative control  ${armTwo ? "PASS" : "FAIL"}`);

  /* The final state, read off the database rather than inferred. */
  const stillThere = await indexPresent(world.connection, OLD_KEY);
  const newKey = await indexPresent(world.connection, "uq_casting_ink_delivery_crops_delivery");
  console.log(`final       old key present: ${stillThere} · new key present: ${newKey}`);

  if (!armOne || !armTwo || stillThere || !newKey) {
    throw new Error("the arm did not prove what it claims — read the lines above");
  }
  console.log("PROVEN — the absent-old-key check fires, and only when it should");
} catch (cause) {
  failure = cause;
  if (planted) {
    /* Never leave the plant behind, even on a failure: the whole point of a
       disposable arm is that the database it ran against is unchanged. */
    await world.connection.query(`DROP INDEX \`${OLD_KEY}\` ON \`${TABLE}\``).catch(() => {});
    console.error(`restored    ${OLD_KEY} dropped after a failure`);
  }
}

process.exit(await closeCeremony(world, failure));
