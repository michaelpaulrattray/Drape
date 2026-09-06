/**
 * THE READING SENTENCE IS READ-ONLY ON THE AUTHOR ROAD (#535 — his ruling,
 * 2026-09-06, verbatim: *"make the top sentence read-only with no pickers at
 * all, and make the prompt box the only place I edit"*).
 *
 * This replaces the §19 guard's question the way the ruling itself does: with
 * no control on the sentence, chips and box cannot disagree because only the
 * box can write. There is no render harness in this client (no jsdom), so the
 * pin is two-layered: the POLICY functions are driven as values, and the
 * component's source is read to prove the read-only branch stands before any
 * picker — a later edit that draws a Popover above that branch reddens here.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { factsHeld, varyOffered } from "./components/BriefEcho";

describe("the policy", () => {
  it("the author road holds every fact — read-only regardless of a follow", () => {
    expect(factsHeld({ authorRoad: true })).toBe(true);
    expect(factsHeld({ authorRoad: true, followHeld: true })).toBe(true);
    /* The house road keeps its pickers — that machinery retires with the road, not with this card. */
    expect(factsHeld({ authorRoad: false })).toBe(false);
    expect(factsHeld(undefined)).toBe(false);
    expect(varyOffered({ authorRoad: true }, "ageBand")).toBe(false);
    expect(varyOffered({ authorRoad: false }, "ageBand")).toBe(true);
  });
});

describe("the component", () => {
  it("the read-only branch stands BEFORE every picker, so no control can precede it", async () => {
    const source = await readFile(new URL("./components/BriefEcho.tsx", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const held = code.indexOf("if (factsHeld(vary))");
    const firstPopover = code.indexOf("<Popover");
    expect(held, "the factsHeld branch must exist").toBeGreaterThan(-1);
    expect(firstPopover, "the pickers must exist for the house road").toBeGreaterThan(-1);
    expect(held, "read-only must be decided before any picker renders").toBeLessThan(firstPopover);
    /* And the held branch renders prose, not a control. */
    const branch = code.slice(held, held + 200);
    expect(branch).toContain("dpc-echo__role");
    expect(branch).not.toContain("<Popover");
    expect(branch).not.toContain("<button");
  });
});
