/**
 * IS THIS THE UNIQUE INDEX SAYING NO — both error shapes, driven directly.
 *
 * # Why this file exists, and it is an incident rather than diligence
 *
 * `isDuplicateKey` shipped reading `error.code` off the TOP-LEVEL error. That
 * is the shape a hand-written test error has and NOT the shape the real path
 * produces: Drizzle wraps the driver's error in a `DrizzleQueryError` and hangs
 * the original off `cause`. So the duplicate escaped as a throw and the mint
 * reported `failed` over a perfectly working index — found by driving a second
 * delivery of one design (variant `486` after `492`) and reading the answer.
 *
 * `candidateRetention.isMissingTable` made exactly this mistake, fixed it, and
 * WROTE IT DOWN in its own docblock. It repeated here because the guard had no
 * arm at all, and the lesson that generalises is the one that file already
 * carries: **a test that invents the error it expects is testing its own
 * invention.** Both shapes below, and the wrapped one is the real one.
 */
import { describe, expect, it } from "vitest";

import { isDuplicateKey } from "./castingV2InkDeliveryCrops";

/** What mysql2 actually throws, as the driver builds it. */
const driverError = () => Object.assign(new Error("Duplicate entry '1-7-ink:neck' for key 'uq_casting_ink_delivery_crops_design'"), {
  code: "ER_DUP_ENTRY",
  errno: 1062,
  sqlState: "23000",
});

describe("the duplicate reader sees the index through drizzle's wrapper", () => {
  it("sees the driver's own error", () => {
    expect(isDuplicateKey(driverError())).toBe(true);
  });

  it("⚠ sees it WRAPPED — the shape the real path produces", () => {
    /* The arm that was missing. Without the chain walk this is `false`, the
       mint answers `failed`, and MINTED ONCE looks broken while it works. */
    const wrapped = Object.assign(new Error("Failed query: insert into `casting_ink_delivery_crops`"), {
      name: "DrizzleQueryError",
      cause: driverError(),
    });
    expect(isDuplicateKey(wrapped)).toBe(true);
  });

  it("sees it through a second layer, and stops before it walks forever", () => {
    const twice = { cause: { cause: driverError() } };
    expect(isDuplicateKey(twice)).toBe(true);
    /* A cycle is a database driver nobody has met yet, and an infinite loop
       inside a catch block is a hung request rather than a failed one. */
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isDuplicateKey(loop)).toBe(false);
  });

  it("NEGATIVE CONTROL: everything else is somebody else's problem", () => {
    /*
      The half that makes the positive mean something. A reader that answered
      `true` to a lost connection would report a crop that does not exist, and
      the carry would silently ride the artwork with nothing in the log.
    */
    expect(isDuplicateKey(new Error("connection lost"))).toBe(false);
    expect(isDuplicateKey(Object.assign(new Error("no such table"), {
      code: "ER_NO_SUCH_TABLE", errno: 1146,
    }))).toBe(false);
    expect(isDuplicateKey(Object.assign(new Error("Failed query"), {
      name: "DrizzleQueryError",
      cause: Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK", errno: 1213 }),
    }))).toBe(false);
    expect(isDuplicateKey(null)).toBe(false);
    expect(isDuplicateKey("ER_DUP_ENTRY")).toBe(false);
  });
});
