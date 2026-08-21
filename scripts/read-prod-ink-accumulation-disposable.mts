/**
 * DISPOSABLE, READ-ONLY — does his tattooed cast's BRANCH still know about both
 * tattoos, or has the known `free.ink` restatement limit (fable-1167 §2e) taken
 * the first one off the record?
 *
 * Why it matters TODAY rather than as a filed limit: the sign-view wire
 * (`a6550e6a`) carries the tattoos a branch WEARS into the six package views,
 * and what it reads is the composed `inkDelivered`. If a second tattoo restated
 * the pointer set instead of joining it, the anchor frame visibly shows two
 * tattoos while the record names one — and the Sign would carry a picture of
 * one of them.
 *
 * Reads production. Writes nothing, prints no credential and no prompt text.
 */
import { spawnSync } from "node:child_process";
import { openDatabase } from "./lib/dbConnection.mts";

const railway = (...args: string[]): string => {
  const result = spawnSync("railway.cmd", args, { encoding: "utf8", shell: true });
  if (result.status !== 0) throw new Error(`railway ${args[0]} failed`);
  return result.stdout ?? "";
};

const url = railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
  ?.slice("MYSQL_PUBLIC_URL=".length);
if (!url) { console.log("UNREAD — no MYSQL_PUBLIC_URL"); process.exit(1); }

const connection = await openDatabase(url);
try {
  const [rows] = await connection.execute(
    `SELECT v.id, v.publicId, v.candidateId, v.parentVariantId, v.deltas
       FROM casting_candidate_variants v
      WHERE v.candidateId IN (
              SELECT DISTINCT candidateId FROM casting_ink_delivery_crops)
      ORDER BY v.candidateId, v.id`,
  ) as unknown as [Array<Record<string, unknown>>];

  for (const row of rows) {
    const deltas = typeof row.deltas === "string" ? JSON.parse(row.deltas) : row.deltas;
    const delivered = deltas?.inkDelivered ?? null;
    const applied = deltas?.inkApplied ?? null;
    const words = deltas?.free?.ink ?? null;
    /* Slots only — her words are creative content and do not print. */
    const slots = delivered ? Object.keys(delivered as Record<string, string>) : [];
    const wordCount = Array.isArray(words) ? words.length : (words == null ? "-" : "?");
    console.log(
      `cand ${String(row.candidateId).padEnd(5)} v${String(row.id).padEnd(4)}`
      + ` parent ${String(row.parentVariantId ?? "master").padEnd(7)}`
      + ` inkDelivered[${slots.length}] ${slots.join(",").padEnd(28)}`
      + ` inkApplied[${applied ? Object.keys(applied as Record<string, string>).length : 0}]`
      + ` free.ink items ${wordCount}`,
    );
  }
} finally {
  await connection.end();
}

/* A SCRIPT ENDS BY ENDING THE PROCESS. */
process.exit(0);
