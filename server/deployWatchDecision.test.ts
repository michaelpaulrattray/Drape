import { describe, expect, it } from "vitest";

import { decideWatch, newestRow } from "../scripts/lib/deployWatch.mts";

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
 * A watch loop is the hardest thing here to drive by hand, so the decision is
 * a pure function and this drives it directly (law 3: a backstop needs a test
 * the model cannot rescue).
 */
describe("a deployment is mine only if it did not exist before I pushed", () => {
  const prior = "0ea3207c-3302-4c05-90a2-294aa586e925";
  const mine = "60e57a7a-15c0-47e6-af51-1a4b45d808aa";

  it("REFUSES the deployment that was newest before the push — the real incident", () => {
    expect(decideWatch(prior, { id: prior, status: "SUCCESS", at: "2026-08-19 00:56:41 +10:00" }))
      .toEqual({ kind: "not-mine" });
  });

  it("accepts a NEW id that has settled", () => {
    expect(decideWatch(prior, { id: mine, status: "SUCCESS", at: "2026-08-19 01:07:49 +10:00" }))
      .toEqual({ kind: "settled", id: mine, status: "SUCCESS" });
  });

  it("keeps waiting on a new id that is still building", () => {
    expect(decideWatch(prior, { id: mine, status: "BUILDING", at: "…" }))
      .toEqual({ kind: "running", id: mine, status: "BUILDING" });
  });

  it("carries a FAILED deployment through as settled — the rite refuses it, not the watch", () => {
    expect(decideWatch(prior, { id: mine, status: "FAILED", at: "…" }))
      .toEqual({ kind: "settled", id: mine, status: "FAILED" });
  });

  it("treats an empty listing as unreadable rather than as absence", () => {
    expect(decideWatch(prior, null)).toEqual({ kind: "unreadable" });
  });

  it("accepts anything when the project had no prior deployment", () => {
    expect(decideWatch(null, { id: mine, status: "SUCCESS", at: "…" }))
      .toEqual({ kind: "settled", id: mine, status: "SUCCESS" });
  });

  it("reads the newest row out of a real listing, and only a deployment row", () => {
    const listing = [
      "Recent Deployments",
      `  ${mine} | BUILDING | 2026-08-19 01:07:49 +10:00`,
      `  ${prior} | SUCCESS | 2026-08-19 00:56:41 +10:00`,
    ].join("\n");
    expect(newestRow(listing)).toEqual({
      id: mine,
      status: "BUILDING",
      at: "2026-08-19 01:07:49 +10:00",
    });
  });

  it("returns null when the listing carries no deployment row at all", () => {
    expect(newestRow("Recent Deployments\n")).toBeNull();
  });
});
