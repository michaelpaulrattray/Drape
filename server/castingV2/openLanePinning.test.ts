/**
 * BOUND (b) — THE CLOSED CATALOGUE'S GUARANTEES, PINNED MECHANICALLY.
 *
 * `OPEN_LANE_CARRY_DESIGN.md` §3, executing fable-760 §2's ruling. The open lane
 * synthesizes a slot key (`open:<noun>`) so an uncatalogued kind can ride the
 * library's ordinary lifecycle. That buys the carry, and it puts a key the
 * catalogue has never seen into a code path built entirely on the assumption
 * that every key is one it owns.
 *
 * Bound (b) is the part of the ruling that is easiest to satisfy on paper and
 * worthless if it is, so these are written FIRST — before one `open:` key
 * exists anywhere — and watched failing. A test that has never been seen red is
 * a test that has not been shown able to go red, which is this campaign's
 * oldest and most expensive lesson (invariant 2, and the sabotage that did not
 * land).
 *
 * # Which of these fail today, and why that is the design
 *
 * Two of the five are invariants over the world as it is — no open key in a
 * closed table, the closed grammar unchanged — and they PASS today. On their
 * own they would be vacuous the day the branch lands, so each carries its own
 * negative control here, and each was additionally driven red by a real
 * sabotage of the source before this file was committed (reported in the
 * shift's message).
 *
 * The other three assert something about a branch that does not exist. They are
 * written as a CONJUNCTION — *the branch resolves this key* AND *the door still
 * refuses it* — so they cannot pass by the branch being absent. They fail today
 * on the first half. That is the point: they are the build's own definition of
 * done.
 *
 * # The two hazards this file found while being written
 *
 * Both are recorded here because the pin is where they are load-bearing, and
 * both contradict a decision the design note recorded as *change nothing*:
 *
 *  1. `refineService`'s vacate guard throws when a vacated slot has NO
 *     question. An open kind's question is its own noun — non-null by design
 *     (§2) — so that guard does not catch an open key at all. Design finding 3
 *     read the throw as the backstop; it is a backstop for a different shape.
 *  2. Past it, `departureFloorFor(definition.guardKind)` is handed the open
 *     kind's `guardKind: null` and returns `floor: 0`, so any non-empty mask
 *     reads as *still there* and the removal is disputed on a floor nobody
 *     measured. The unowned-axis class, one layer down from where it was
 *     looked for.
 */
import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { INSTANCES, parseSlot } from "./referenceSlots";
import {
  FACET_SLOTS,
  catalogueSlots,
  facetsOfSlot,
  slotDefinition,
  slotsForFeature,
} from "./referenceSlotCatalogue";
import { accessoryKindOfSlot } from "./slotWordShape";
import { FREE_SUBJECT_KEYS } from "./refineSubjects";
import { FACET_KEYS } from "./facetCards";
import { openKindDeparture, openKindIsPlural, openKindZoneScope } from "./openKindPolicy";
import type { FeatureSlot } from "./recipeAssembler";

/** The one prefix, in one place, so a test cannot pin a different spelling. */
const OPEN = "open:";

/** The key every arm below uses, and the noun the horns court already measured. */
const OPEN_KEY = "open:horns" as FeatureSlot;

const carriesAnOpenKey = (keys: readonly string[]): string[] =>
  keys.filter((key) => key.startsWith(OPEN));

/* ─────────────────────────────────────────────────────────────────────────────
   TEST 1 — no open key enters a closed table.
   ───────────────────────────────────────────────────────────────────────────*/

describe("1. no open key enters a closed table", () => {
  it("catches a planted key — the reader, before its findings count", () => {
    /* Positive control first: a predicate that cannot see an open key would
       pass every assertion below by being blind, which is the shape of a
       finding and the shape of a broken instrument at the same time. */
    expect(carriesAnOpenKey(["hair", "open:horns", "eye@left"])).toEqual(["open:horns"]);
    expect(carriesAnOpenKey(["hair", "eye@left"])).toEqual([]);
  });

  it("finds none in any closed vocabulary the code can enumerate", () => {
    const closed: Record<string, readonly string[]> = {
      FREE_SUBJECT_KEYS,
      FACET_KEYS,
      FACET_SLOTS: Object.keys(FACET_SLOTS),
      INSTANCES,
      "catalogueSlots().slot": catalogueSlots().map((one) => one.slot),
      "catalogueSlots().feature": catalogueSlots().map((one) => one.feature),
    };
    for (const [table, keys] of Object.entries(closed)) {
      expect(carriesAnOpenKey(keys), `${table} admitted an open key`).toEqual([]);
    }
  });

  it("finds none in any table the SOURCE SCAN can see either", () => {
    /*
      The enumerable half above misses every table that is not exported as a
      list. This is the same scan `openKindPolicy.test.ts` runs with the
      question inverted: it does not ask whether the policy ANSWERS a table, it
      asks whether any of them has grown an `open:` key of its own.
    */
    const offenders: string[] = [];
    for (const file of tsFilesUnder(path.join(__dirname, ".."))) {
      const source = fs.readFileSync(file, "utf8");
      for (const block of closedTableBlocks(source)) {
        for (const key of quotedKeysIn(block.body)) {
          if (key.startsWith(OPEN)) offenders.push(`${path.basename(file)}:${block.name}:${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("and the same scan REDDENS on a planted table — the negative control", () => {
    /*
      Kept after the positive control passes, because a guard aimed at the wrong
      field fails both ways and this campaign has already paid for one of those.
      A scan that returned `[]` because it parses nothing looks identical to a
      scan that returned `[]` because the code is clean.
    */
    const planted = [
      "export const PLANTED: Record<Facet, string> = {",
      "  hair: \"a\",",
      "  \"open:horns\": \"b\",",
      "};",
    ].join("\n");
    const blocks = closedTableBlocks(planted);
    expect(blocks.map((one) => one.name)).toEqual(["PLANTED"]);
    expect(quotedKeysIn(blocks[0].body)).toContain("open:horns");
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   TEST 2 — the closed grammar is unchanged for every non-open key.
   ───────────────────────────────────────────────────────────────────────────*/

describe("2. the closed grammar is unchanged for every non-open key", () => {
  it("keeps INSTANCES a two-member closed list", () => {
    /*
      This is the assertion the key form exists to protect. `@` is the INSTANCE
      separator and its suffix is checked against this list, so `open@horns`
      could only ever be made to work by widening it — and the day `horns` is an
      instance, `earring@horns` parses too. Widening this array by one member
      reddens this line, which is the whole mechanism.
    */
    expect(INSTANCES).toEqual(["left", "right"]);
  });

  it("refuses `open@…` at the parser, before any branch could see it", () => {
    expect(parseSlot("open@horns")).toBeNull();
    expect(parseSlot("earring@horns")).toBeNull();
    /* And the closed forms still parse exactly as they did. */
    expect(parseSlot("eye@left")).toEqual({ feature: "eye", instance: "left" });
    expect(parseSlot("hair")).toEqual({ feature: "hair" });
    expect(parseSlot("makeup@face skin")).toBeNull();
  });

  it("resolves every catalogued slot byte-identically to itself", () => {
    for (const definition of catalogueSlots()) {
      expect(slotDefinition(definition.slot), definition.slot).toEqual(definition);
    }
  });

  it("resolves the catalogue to the digest committed with this pin", () => {
    /*
      A FROZEN DIGEST, and it is meant to redden on a deliberate catalogue
      change. "Byte-identical to today" is not provable from inside one run —
      the run computes both sides — so the fixed half has to be committed. If
      you added or edited a slot on purpose: read the diff, satisfy yourself
      that the open branch is not what moved it, and update the constant in the
      same commit that moved the catalogue.
    */
    const digest = crypto
      .createHash("sha256")
      .update(JSON.stringify(catalogueSlots()))
      .digest("hex")
      .slice(0, 16);
    expect(catalogueSlots()).toHaveLength(25);
    expect(digest).toBe("036df24c52c83d00");
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   TEST 3 — the branch is entered only by the prefix.
   FAILS TODAY on its first half, by design.
   ───────────────────────────────────────────────────────────────────────────*/

describe("3. the branch is entered ONLY by the prefix", () => {
  it("resolves an open key, with every field the design ruled", () => {
    const open = slotDefinition(OPEN_KEY);
    expect(open, "the open branch does not exist yet — this is the build").not.toBeNull();
    expect(open).toMatchObject({
      slot: "open:horns",
      feature: "horns",
      instance: null,
      tier: "anatomy",
      group: "face",
      noun: "horns",
      question: "horns",
      guardKind: null,
      frame: "wholeFrame",
      remint: "whenEarned",
      display: null,
    });
    expect(open!.panel.row, "a kind nobody has catalogued draws no row").toBe("none");
    expect("pairNoun" in open!, "no instance means no pair noun").toBe(false);
  });

  it("carries the `noSpecimen` reason rather than a silent null (§5, option 3)", () => {
    /*
      The one field where the closed invariant cannot hold: `guardKind` is null
      exactly when `question` is, and an open kind has a question and no
      completeness specimen. fable-766 §2 ratified stating the invariant as
      closed-catalogue-only and carrying an explicit reason — so the reason has
      to BE there, and be readable, or option 3 has silently become option 1.
    */
    const open = slotDefinition(OPEN_KEY) as (Record<string, unknown> | null);
    expect(open).not.toBeNull();
    expect(typeof open?.noSpecimen, "the reason option 3 exists to record").toBe("string");
    expect(String(open?.noSpecimen ?? "").length).toBeGreaterThan(20);
    /* And no closed slot carries one — the carve-out is the open lane's, not a
       new optional field everybody may reach for. */
    for (const definition of catalogueSlots()) {
      expect("noSpecimen" in definition, definition.slot).toBe(false);
    }
  });

  it("refuses every key that is not exactly prefixed", () => {
    /*
      THE NEGATIVE CONTROL FOR THE BRANCH CONDITION, and it is the list a
      loosened condition dies on. `slot.includes("open")` — the obvious wrong
      cut — resolves `reopen:horns` and `open@horns`, so those two members are
      load-bearing rather than decorative.
    */
    for (const key of [
      "open@horns",
      "openhorns",
      "reopen:horns",
      "OPEN:horns",
      "Open:horns",
      " open:horns",
      "open :horns",
      "open:",
      "open::horns",
      /*
        A SPACED KEY, AND IT IS THE ONE THE LIBRARY WOULD REFUSE AFTER THE
        RENDER WAS PAID FOR.

        `parseSlot` has no space in its grammar, so `open:cat ears` is
        `slotNotAFeatureSlot` at the database door — painted, charged, never
        filed, re-rolled on every later render, which is the defect fable-775 §3
        closed by kebabbing the key. The resolver held a LOOSER grammar than the
        door for a day: it accepted a space, so it would have answered for a key
        the library refuses, and the gap would have re-opened one module along.
        Both now say the same thing (opus-570 §2).
      */
      "open:cat ears",
    ]) {
      expect(slotDefinition(key as FeatureSlot), key).toBeNull();
    }
  });

  it("and STILL resolves the kebab form the normalizer actually mints", () => {
    /*
      The half that must not go red with it. A grammar tightened by one
      character too many would pass every arm above and silently refuse every
      multi-word kind the lane exists to carry — the same tightening-versus-
      widening pair that the misaimed-guard finding was made of.
    */
    const open = slotDefinition("open:cat-ears" as FeatureSlot);
    expect(open).not.toBeNull();
    expect(open!.slot).toBe("open:cat-ears");
  });

  it("does not hand an open key the closed catalogue's answer for the same noun", () => {
    /*
      `open:hair` is a routing bug upstream (`closedSubjectFor` sends a
      colliding noun to the closed lane and it never reaches here). At THIS
      layer the only requirement is confinement: the branch must answer for the
      key it was given and never fall through to the closed row that happens to
      share the noun.
    */
    const open = slotDefinition("open:hair" as FeatureSlot);
    expect(open).not.toBeNull();
    expect(open!.slot).toBe("open:hair");
    expect(open!.panel.row, "the closed `hair` row is `own`; an open kind draws none").toBe("none");
  });

  it("leaves the other slot-keyed readers refusing rather than guessing", () => {
    /*
      The call-site walk's tolerate-or-answer decisions, at the three readers
      that are not `slotDefinition`. Each must answer for an open key the way it
      answers for a key it does not know — `facetsOfSlot` empty rather than
      throwing (refineService:4127 spreads it), `slotsForFeature` null, and no
      accessory kind, because an open kind is not a worn thing.
    */
    expect(facetsOfSlot(OPEN_KEY) ?? []).toEqual([]);
    expect(slotsForFeature("open:horns")).toBeNull();
    expect(accessoryKindOfSlot(OPEN_KEY)).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   TEST 4 — an open kind is never scopable.
   ───────────────────────────────────────────────────────────────────────────*/

describe("4. an open kind is never scopable", () => {
  it("holds the policy that says so", () => {
    expect(openKindZoneScope()).toBe("fullFrame");
    expect(openKindIsPlural()).toBe(false);
  });

  it("has no instances for a scope to name", () => {
    /*
      The scope door's refusal is asserted at the wire, in `refineService`'s own
      suite, because that is where the door is. What belongs HERE is the reason
      the door must keep refusing: scopability arrives as a SIDE EFFECT of the
      key resolving, and the thing that makes "her left one, longer" sayable is
      a per-instance slot existing. None does.
    */
    const open = slotDefinition(OPEN_KEY);
    expect(open, "the open branch does not exist yet — this is the build").not.toBeNull();
    expect(open!.instance).toBeNull();
    expect(slotDefinition("open:horns@left" as FeatureSlot)).toBeNull();
    expect(slotDefinition("open:horns@right" as FeatureSlot)).toBeNull();
    /* `slotsForFeature` is how a caller finds the sibling instances of a
       feature (refineService:4167). An open kind has none to find. */
    expect(slotsForFeature("open:horns")).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   TEST 5 — an open kind never reaches the vacate path.
   ───────────────────────────────────────────────────────────────────────────*/

describe("5. an open kind never reaches the vacate path", () => {
  it("departs by dropping the carry, named as a value", () => {
    /* Named as a value rather than a boolean precisely so the step-4 build
       cannot satisfy it by reaching for the closed lane's vacate machinery,
       which would write an absence phrase about a thing her master never had. */
    expect(openKindDeparture()).toBe("dropTheCarry");
  });

  it("cannot be caught by the guard the design read as its backstop", () => {
    /*
      HAZARD 1, PINNED AS THE FACT IT IS rather than as a hope.
      `refineService:4815` throws when a vacated slot has `question == null`.
      An open kind's question is its own noun, so this asserts the guard does
      NOT fire — which is why the vacate refusal has to be its own door, driven
      at the wire in `refineService`'s suite.
    */
    const open = slotDefinition(OPEN_KEY);
    expect(open, "the open branch does not exist yet — this is the build").not.toBeNull();
    expect(open!.question, "non-null, so the `question == null` guard is silent here").not.toBeNull();
    expect(open!.guardKind, "and null, which is what hazard 2 turns into a floor of zero").toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   The scanners. Small, local, and driven over fixtures above before believed.
   ───────────────────────────────────────────────────────────────────────────*/

function tsFilesUnder(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/**
 * Every table keyed on the closed vocabulary, with its literal body.
 *
 * Same declaration test as `openKindPolicy.test.ts` — column 0, so a
 * `Partial<Record<Facet, …>>` built as working memory inside a function is not
 * mistaken for a decision — and then the block is taken to the first line that
 * closes at column 0. Crude on purpose: a table whose body this over-reads
 * makes the scan MORE likely to find a planted key, never less.
 */
function closedTableBlocks(source: string): Array<{ name: string; body: string }> {
  const lines = source.split(/\r?\n/);
  const blocks: Array<{ name: string; body: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const declaration = /^(?:export )?const ([A-Za-z0-9_]+)\s*:\s*(.+?)\s*=/.exec(lines[index]);
    if (!declaration) continue;
    const [, name, type] = declaration;
    const keyed =
      /^(?:Readonly<)?(?:Partial<)?Record<\s*(?:FreeSubject|Facet)\b/.test(type)
      || /^readonly\s+(?:FreeSubject|Facet)\[\]$/.test(type);
    if (!keyed) continue;
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      body.push(lines[cursor]);
      if (/^(?:\}|\])/.test(lines[cursor])) break;
    }
    blocks.push({ name, body: body.join("\n") });
  }
  return blocks;
}

/** The quoted keys in a table body — `"open:horns": …` and `"open:horns",`. */
function quotedKeysIn(body: string): string[] {
  const keys: string[] = [];
  for (const match of body.matchAll(/["'`]([^"'`]+)["'`]\s*(?::|,|\])/g)) keys.push(match[1]);
  return keys;
}
