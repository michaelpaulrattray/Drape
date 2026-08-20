/**
 * WHAT verify-bot's CAST IS HOLDING RIGHT NOW — designs and attachments, read
 * off the DEV database before a drive rather than assumed.
 *
 * The shown-cut driver's own scar: its first run reported the cut as absent
 * while the panel was saying something clear two elements away — the Cast was
 * already at its eight-picture cap, so the attach refused and the ask never
 * carried a reference. A drive that does not read the caps first spends house
 * money to discover them.
 *
 *   npx tsx scripts/read-ink-studio-state-disposable.mts
 */
import "dotenv/config";

import { and, eq } from "drizzle-orm";

import {
  castingCandidates,
  castingInkDesigns,
  castingReferenceAttachments,
} from "../drizzle/schema";
import { getDb } from "../server/db/connection";

const db = (await getDb())!;

/* The dev world, named rather than guessed — and the port is printed so the
   two-databases confusion cannot happen silently (`two-databases-compare-the-port`). */
const url = process.env.DATABASE_URL ?? "";
console.log(`database: ${url.replace(/\/\/[^@]*@/, "//<redacted>@")}`);

const candidates = await db
  .select({
    id: castingCandidates.id,
    publicId: castingCandidates.publicId,
    userId: castingCandidates.userId,
    status: castingCandidates.status,
  })
  .from(castingCandidates)
  .where(eq(castingCandidates.userId, 1))
  .limit(40);

console.log(`\ncandidates for user 1: ${candidates.length}`);

for (const candidate of candidates) {
  const designs = await db
    .select({
      publicId: castingInkDesigns.publicId,
      placement: castingInkDesigns.placement,
      side: castingInkDesigns.side,
      cutRoute: castingInkDesigns.cutRoute,
      sourceDigest: castingInkDesigns.sourceDigest,
    })
    .from(castingInkDesigns)
    .where(and(
      eq(castingInkDesigns.candidateId, candidate.id),
      eq(castingInkDesigns.userId, 1),
    ));
  const attachments = await db
    .select({ publicId: castingReferenceAttachments.publicId })
    .from(castingReferenceAttachments)
    .where(and(
      eq(castingReferenceAttachments.candidateId, candidate.id),
      eq(castingReferenceAttachments.userId, 1),
    ));
  if (designs.length === 0 && attachments.length === 0) continue;
  console.log(`\n  ${candidate.publicId}  status=${candidate.status}`);
  console.log(`    designs     ${designs.length}/8`);
  for (const design of designs) {
    console.log(
      `      ${design.publicId}  ${design.placement}@${design.side}`
      + `  cutRoute=${design.cutRoute ?? "null"}`
      + `  source=${design.sourceDigest ? `${design.sourceDigest.slice(0, 8)}…` : "null"}`,
    );
  }
  console.log(`    attachments ${attachments.length}/8`);
}

process.exit(0);
