import { describe, expect, it } from "vitest";

import {
  castRoomIsWorking,
  slotIsBeingAsked,
  slotShowsWorking,
  type BusySlotRead,
} from "./roomBusy";

/**
 * THE ROOM'S READING OF BUSY, DRIVEN (#1235).
 *
 * His three reports were one missing fact — a view being asked for again is a
 * view being MADE — and each of the three is an arm here:
 *
 * 1. the tile goes into the casting state rather than showing a verb;
 * 2. asking for one view leaves the others alone;
 * 3. leaving the page and coming back still shows it working, and the room keeps
 *    polling, because the fact is the server's and not this page's memory.
 *
 * It is a unit suite rather than a source-text guard on the page because the
 * interesting case is a COMBINATION — building with a picture, building without
 * one, retrying with a picture — and a guard that greps the page for a class
 * name cannot tell those apart. The page holds no copy of this logic.
 */

const slot = (overrides: Partial<BusySlotRead> = {}): BusySlotRead => ({
  angle: "backFull",
  state: "failed-refunded",
  url: null,
  ...overrides,
});

const NOBODY: ReadonlySet<string> = new Set();

describe("is this view being asked for again", () => {
  it("reads the server's answer, so a reload and a second tab agree", () => {
    // His third report: the fact has to survive the page being closed.
    expect(slotIsBeingAsked(slot({ state: "building", retrying: true }), NOBODY)).toBe(true);
  });

  it("reads our own press, so the tile answers the same frame", () => {
    expect(slotIsBeingAsked(slot(), new Set(["backFull"]))).toBe(true);
  });

  it("is false for a view nobody is asking for", () => {
    expect(slotIsBeingAsked(slot(), NOBODY)).toBe(false);
    /*
      HIS SECOND REPORT: one press must not speak for another tile. The old room
      held a single angle in a single string and disabled every button from it.
    */
    expect(slotIsBeingAsked(slot({ angle: "closeUp" }), new Set(["backFull"]))).toBe(false);
  });
});

describe("does the tile draw the working state", () => {
  it("yes on a view being asked for again, even though it still has a picture", () => {
    const unjudged = slot({ state: "ready", url: "https://cdn/x.png", retrying: true });
    expect(slotShowsWorking(unjudged, NOBODY)).toBe(true);
  });

  it("yes on an empty slot the Sign is still building", () => {
    expect(slotShowsWorking(slot({ state: "building", url: null }), NOBODY)).toBe(true);
  });

  it("NO on the signed face standing in while the package builds", () => {
    /*
      ⚠ THE ARM THAT KEEPS AN OLDER RULING ALIVE. While her package builds, the
      headshot slot shows the face she signed — *"the customer is never looking
      at an empty room"* — so a skeleton over it would take away the only picture
      she has at the only moment she has nothing else. This is why the predicate
      reads `retrying` and not merely `building`.
    */
    const standIn = slot({ angle: "closeUp", state: "building", url: "https://cdn/anchor.png" });
    expect(slotShowsWorking(standIn, NOBODY)).toBe(false);
  });

  it("NO on a finished view at rest", () => {
    expect(slotShowsWorking(slot({ state: "ready", url: "https://cdn/x.png" }), NOBODY)).toBe(false);
    expect(slotShowsWorking(slot({ state: "failed-refunded" }), NOBODY)).toBe(false);
  });
});

describe("does the room keep polling", () => {
  const room = (status: string, states: string[]) => ({
    status,
    slots: states.map((state) => ({ state })),
  });

  it("yes while the package is being signed", () => {
    expect(castRoomIsWorking(room("building", ["building", "building"]))).toBe(true);
  });

  it("yes while ONE view is being asked for again on a finished Cast", () => {
    /*
      HIS THIRD REPORT, and the whole reason this predicate left the page. A Try
      again never puts the Cast back into `building`, so a room watching only the
      Cast's status learned nothing while a view rendered: the new picture
      arrived on a manual reload, which from the outside is exactly what *"it
      looks like it stopped generating"* looks like.
    */
    expect(castRoomIsWorking(room("ready", ["ready", "building", "ready"]))).toBe(true);
  });

  it("no on a finished Cast with nothing in flight", () => {
    // The cost half: a permanent heartbeat on a terminal room has no reader.
    expect(castRoomIsWorking(room("ready", ["ready", "failed-refunded"]))).toBe(false);
  });

  it("no before the first read has landed", () => {
    expect(castRoomIsWorking(undefined)).toBe(false);
  });
});
