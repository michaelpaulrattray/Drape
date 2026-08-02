import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * §G.6's kept-sibling exemption — the one retention law that had never been
 * exercised by a real sweep.
 *
 * The promise: **the kept siblings of a signed Cast survive their sheet's
 * expiry for as long as she lives**, specifically so the room's Siblings card
 * can show real faces rather than tiles that vanish after seven days. The card
 * now depends on it, which turns a documented intention into a thing that can
 * silently break someone's Cast.
 *
 * Two halves have to hold, and they live in different statements:
 *
 *   1. `expireSessionCandidates` must NOT mark kept rows expired when the
 *      session holds a signed candidate;
 *   2. `listPurgeableCandidates` must never hand a kept or signed row to the
 *      object sweep, whatever its status.
 *
 * Verified empirically against the dev database on 2026-08-02 — for the signed
 * Cast KI-9E2X, the sweep's own predicate matched six rows and none of them was
 * her kept sibling — and pinned here so the predicate cannot quietly change.
 */

const CASTING_DB = new URL("../db/castingV2.ts", import.meta.url);

describe("a signed Cast's kept siblings survive their sheet", () => {
  it("arms the kept exemption only when the session actually signed something", async () => {
    const source = await readFile(CASTING_DB, "utf8");
    const expire = source.slice(source.indexOf("export async function expireSessionCandidates"));

    /*
      The conditional spread IS the exemption. A session that never signed
      protects nothing — its kept candidates expire with it, which is correct:
      there is no Cast for them to be siblings of.
    */
    expect(expire).toContain("...(signed ? [isNull(castingCandidates.keptAt)] : [])");

    // And the question is asked of the database, not inferred from the caller.
    expect(expire).toContain("isNotNull(castingCandidates.signedCastId)");
  });

  it("never offers a kept or signed candidate's object to the purge", async () => {
    const source = await readFile(CASTING_DB, "utf8");
    const purge = source.slice(source.indexOf("export async function listPurgeableCandidates"));
    expect(purge).toContain("isNull(castingCandidates.keptAt)");
    expect(purge).toContain("isNull(castingCandidates.signedCastId)");
  });

  it("keeps the signed candidate herself out of the sheet's tray", async () => {
    /*
      §F's Shortlist law: signing removes the signed candidate from the tray and
      nothing else. Her row stays — it is the Cast's lineage, and it is what
      keeps her siblings protected — but the sheet stops treating her as
      something still being decided.
    */
    const source = await readFile(CASTING_DB, "utf8");
    const tray = source.slice(source.indexOf("export async function listKeptCandidates"));
    expect(tray).toContain('eq(castingCandidates.status, "ready")');
    expect(tray).not.toContain('["ready", "signed"]');
  });
});
