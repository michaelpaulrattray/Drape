import { describe, expect, it } from "vitest";

import { decideWatch, foreignServiceContext, listedRows } from "../scripts/lib/deployWatch.mts";

/**
 * THE RECEIPT THAT BELONGED TO SOMEBODY ELSE.
 *
 * On 2026-08-19 the ceremony printed `deployment 0ea3207c → SUCCESS after 2s`
 * for a commit Railway had not started building. The push had landed; the
 * newest row was the PREVIOUS deploy, already terminal; the watch accepted it
 * on its first look. Health, uptime and flags were then read off the old
 * process and were all true of it — which is why nothing in the receipt looked
 * wrong.
 *
 * AND THE TEN MINUTES THAT BELONGED TO ANOTHER SERVICE (#148, 2026-08-26): the
 * rite ran inside `railway run --service MySQL`, whose injected
 * `RAILWAY_SERVICE_ID` pointed an unscoped `deployment list` at MySQL's single
 * July row. "Same id as before the push" was true forever; the watch waited
 * out the tool limit while Drape's deployment sat SUCCESS on the pushed sha.
 *
 * A watch loop is the hardest thing here to drive by hand, so the decision is
 * a pure function and this drives it directly (law 3: a backstop needs a test
 * the model cannot rescue).
 */
describe("a deployment is mine only if it is new since the push AND built from the pushed commit", () => {
  const prior = "0ea3207c-3302-4c05-90a2-294aa586e925";
  const mine = "60e57a7a-15c0-47e6-af51-1a4b45d808aa";
  const his = "7800797d-2967-4f32-ad5a-d9f9c034c9d7";
  const sha = "52019454a4a8c079375684ee13c14f57eab6f7d7";
  const other = "e2ec829f7d5a0b7d3b1a4f0c6e2d9a8b7c6d5e4f";
  const row = (id: string, status: string, commitHash: string | null = sha) =>
    ({ id, status, at: "2026-08-26T13:20:00.061Z", commitHash });

  it("REFUSES the deployment that was newest before the push — the 2026-08-19 incident", () => {
    expect(decideWatch(prior, [row(prior, "SUCCESS")], sha)).toEqual({ kind: "not-mine" });
  });

  it("REFUSES a row that never changes — MySQL's one deployment, read on every tick of the #148 rite", () => {
    const mysql = { id: "bb33f2f7-87d2-4a50-8dfd-ad3addcb015b", status: "SUCCESS", at: "2026-07-10", commitHash: null };
    // Before the push the rite read this row as `prior`; after it, the same row.
    expect(decideWatch(mysql.id, [mysql], sha)).toEqual({ kind: "not-mine" });
  });

  it("accepts a NEW id on the pushed commit that has settled", () => {
    expect(decideWatch(prior, [row(mine, "SUCCESS"), row(prior, "REMOVED", other)], sha))
      .toEqual({ kind: "settled", id: mine, status: "SUCCESS" });
  });

  it("keeps waiting on a new id on the pushed commit that is still building", () => {
    expect(decideWatch(prior, [row(mine, "BUILDING"), row(prior, "SUCCESS", other)], sha))
      .toEqual({ kind: "running", id: mine, status: "BUILDING" });
  });

  it("does NOT adopt a new id built from ANOTHER commit — his dashboard redeploy is foreign", () => {
    expect(decideWatch(prior, [row(his, "SUCCESS", other), row(prior, "REMOVED", other)], sha))
      .toEqual({ kind: "foreign", id: his, commitHash: other });
  });

  it("FINDS its own settled row UNDER a foreign one created after it — review of #149", () => {
    // His flag-flip redeploy landed two minutes into the watch: index 0 is his,
    // index 1 is mine and SUCCESS. Reading only the top row would wait out the
    // timeout and die "no build of it was seen" of a listing that held it.
    expect(decideWatch(prior, [row(his, "BUILDING", other), row(mine, "SUCCESS"), row(prior, "REMOVED", other)], sha))
      .toEqual({ kind: "settled", id: mine, status: "SUCCESS" });
  });

  it("finds its own row still building under an unattributed one", () => {
    expect(decideWatch(prior, [row(his, "SUCCESS", null), row(mine, "DEPLOYING")], sha))
      .toEqual({ kind: "running", id: mine, status: "DEPLOYING" });
  });

  it("does NOT adopt a new id whose commit cannot be read — unattributed is not mine", () => {
    expect(decideWatch(prior, [row(his, "SUCCESS", null), row(prior, "REMOVED", other)], sha))
      .toEqual({ kind: "unattributed", id: his });
  });

  it("does NOT count the PRIOR row as mine even when it carries the pushed sha — a push of an already-deployed commit", () => {
    expect(decideWatch(prior, [row(prior, "SUCCESS", sha)], sha)).toEqual({ kind: "not-mine" });
  });

  it("carries a FAILED deployment through as settled — the rite refuses it, not the watch", () => {
    expect(decideWatch(prior, [row(mine, "FAILED")], sha))
      .toEqual({ kind: "settled", id: mine, status: "FAILED" });
  });

  it("treats an empty listing as unreadable rather than as absence", () => {
    expect(decideWatch(prior, [], sha)).toEqual({ kind: "unreadable" });
  });

  it("accepts anything on the pushed commit when the project had no prior deployment", () => {
    expect(decideWatch(null, [row(mine, "SUCCESS")], sha))
      .toEqual({ kind: "settled", id: mine, status: "SUCCESS" });
  });

  it("reads every row out of the real `--json` listing, newest first, commit hash included", () => {
    // The shape `railway deployment list --json --limit 2` printed on 2026-08-26, trimmed.
    const listing = JSON.stringify([
      { id: mine, status: "SUCCESS", createdAt: "2026-08-26T13:20:00.061Z",
        meta: { branch: "local-migration", commitHash: sha, reason: "deploy" } },
      { id: prior, status: "REMOVED", createdAt: "2026-08-26T12:45:42.000Z",
        meta: { branch: "local-migration", commitHash: other, reason: "deploy" } },
    ]);
    expect(listedRows(listing)).toEqual([
      { id: mine, status: "SUCCESS", at: "2026-08-26T13:20:00.061Z", commitHash: sha },
      { id: prior, status: "REMOVED", at: "2026-08-26T12:45:42.000Z", commitHash: other },
    ]);
  });

  it("reads a row with no meta as commitHash null, never as a guess; drops a row with no id", () => {
    expect(listedRows(JSON.stringify([{ id: mine, status: "BUILDING", createdAt: "x" }, { status: "SUCCESS" }])))
      .toEqual([{ id: mine, status: "BUILDING", at: "x", commitHash: null }]);
  });

  it("returns an empty listing on an empty array, on non-JSON, and on the old text table", () => {
    expect(listedRows("[]")).toEqual([]);
    expect(listedRows("Recent Deployments\n")).toEqual([]);
    expect(listedRows(`Recent Deployments\n  ${mine} | SUCCESS | 2026-08-26 23:20:00 +10:00`)).toEqual([]);
  });
});

describe("the rite refuses to start inside another service's `railway run`", () => {
  it("REFUSES the #148 invocation — RAILWAY_SERVICE_NAME=MySQL while deploying Drape — naming the plain command", () => {
    const why = foreignServiceContext({ RAILWAY_SERVICE_NAME: "MySQL", RAILWAY_SERVICE_ID: "72e761be" }, "Drape");
    expect(why).toContain("railway run --service MySQL");
    expect(why).toContain("npx tsx scripts/deploy-rite.mts");
    expect(why).toContain("#148");
  });

  it("REFUSES an injected id with NO name — the id is the variable the listing honours (review of #149)", () => {
    const why = foreignServiceContext({ RAILWAY_SERVICE_ID: "72e761be" }, "Drape");
    expect(why).toContain("RAILWAY_SERVICE_ID=72e761be");
    expect(why).toContain("npx tsx scripts/deploy-rite.mts");
  });

  it("allows the plain invocation (neither variable set)", () => {
    expect(foreignServiceContext({ PATH: "x" }, "Drape")).toBeNull();
  });

  it("allows a wrapper naming the SAME service", () => {
    expect(foreignServiceContext({ RAILWAY_SERVICE_NAME: "Drape", RAILWAY_SERVICE_ID: "f613b5f2" }, "Drape")).toBeNull();
  });
});
