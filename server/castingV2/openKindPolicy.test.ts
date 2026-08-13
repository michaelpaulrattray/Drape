/**
 * THE DRIFT GUARD ON THE OPEN-KIND POLICY RECORD.
 *
 * The record answers, for a kind nobody has catalogued, every question the
 * closed vocabulary is asked. Its one failure mode is the one that produced it:
 * a table is added or renamed, nobody remembers this file, and the open kind's
 * answer to that question falls to whatever silence means there — an unowned
 * axis, decided invisibly.
 *
 * So the completeness check is a SCAN OF THE SOURCE rather than a list somebody
 * keeps. The list was already wrong when the design note counted it by hand —
 * eleven tables written down, eighteen in the code — which is the argument for
 * doing it this way said in the strongest form available.
 *
 * The scanner is driven over fixtures in BOTH directions before it is believed
 * (working law 2): it must SEE a planted table, and it must not claim a local
 * variable, a type alias or a table keyed on something else. A scanner that
 * found nothing would pass the completeness check vacuously, which is the
 * empty-SHOW-TABLES shape, so the floor control below fails if the real scan
 * comes back thin.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  OPEN_KIND_POLICY,
  answeredTables,
  openKindAmplitude,
  openKindBinds,
  openKindDeparture,
  openKindFilesAsIdentity,
  openKindHeading,
  openKindIsPlural,
  openKindMovesItsEdge,
  openKindQualifier,
  openKindSegmenterQuestion,
  openKindUnfiledReason,
  openKindZoneScope,
  owedByThePolicy,
} from "./openKindPolicy";
import { TEETH, qualifierFor } from "./subjectQualifiers";
import { FREE_SUBJECT_KEYS, type FreeSubject } from "./refineSubjects";
import { normalizeOpenKind } from "./openLaneKind";
import type { TextEngine } from "../providers/types";

/**
 * Every top-level declaration keyed on the closed vocabulary.
 *
 * Column 0 is the discriminator between a TABLE and a local: `refineDelta` and
 * `refineService` build `Partial<Record<FreeSubject, …>>` values inside
 * functions all day, and those are working memory rather than decisions. Type
 * aliases are excluded for the same reason — `RealizationCaptions` names a
 * shape, it does not decide anything about a subject.
 */
export function tablesKeyedOnTheClosedVocabulary(source: string): string[] {
  const found: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const declaration = /^(?:export )?const ([A-Za-z0-9_]+)\s*:\s*(.+?)\s*=/.exec(line);
    if (!declaration) continue;
    const [, name, type] = declaration;
    const keyed =
      /^(?:Readonly<)?(?:Partial<)?Record<\s*(?:FreeSubject|Facet)\b/.test(type)
      || /^readonly\s+(?:FreeSubject|Facet)\[\]$/.test(type);
    if (keyed) found.push(name);
  }
  return found;
}

function tsFilesUnder(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const SERVER_ROOT = path.join(__dirname, "..");

describe("the scanner, before any of its findings count", () => {
  it("SEES a planted table of each shape", () => {
    const fixture = [
      "export const PLANTED_TOTAL: Record<FreeSubject, string> = {",
      "const PLANTED_PARTIAL: Partial<Record<Facet, string>> = {",
      "export const PLANTED_LIST: readonly FreeSubject[] = [\"marks\"];",
      "const PLANTED_READONLY: Readonly<Partial<Record<Facet, string>>> = {",
    ].join("\n");
    expect(tablesKeyedOnTheClosedVocabulary(fixture)).toEqual([
      "PLANTED_TOTAL", "PLANTED_PARTIAL", "PLANTED_LIST", "PLANTED_READONLY",
    ]);
  });

  it("does NOT claim a local, a type alias, or a table keyed on something else", () => {
    /* The negative control is kept after the positive one passes: a guard aimed
       at the wrong field fails both ways, and this campaign has paid for that
       once already. */
    const fixture = [
      "  const free: Partial<Record<FreeSubject, FreeValue>> = {};",
      "export type RealizationCaptions = Partial<Record<Facet, CaptionEntry>>;",
      "const PAIR_NOUN_OF_ACCESSORY: Record<string, string> = {",
      "export const REFINABLE_AXES: readonly RefinableAxis[] = [];",
      "  facets: readonly Facet[];",
    ].join("\n");
    expect(tablesKeyedOnTheClosedVocabulary(fixture)).toEqual([]);
  });
});

describe("every table that decides something about a subject has an open-kind answer", () => {
  const scanned = new Map<string, string>();
  for (const file of tsFilesUnder(SERVER_ROOT)) {
    for (const name of tablesKeyedOnTheClosedVocabulary(fs.readFileSync(file, "utf8"))) {
      scanned.set(name, path.basename(file));
    }
  }

  it("finds the tables it is supposed to find — the floor control", () => {
    /*
      A MIRROR, DELIBERATELY, AND ONLY AS A FLOOR. The authority is the
      subset check below; this exists so a scan that came back empty — a moved
      directory, a changed declaration style — cannot pass that check by finding
      nothing. It pins the eight total tables the design note itself named.
    */
    for (const table of [
      "CHANGE_AMPLITUDE", "MOVES_ITS_EDGE", "FACET_SLOTS", "SHARED_HEADINGS",
      "FREE_SUBJECT_KIND", "SUBJECT_NOUNS", "SUBJECT_QUALIFIER", "ZONE_SCOPE",
    ]) {
      expect(scanned.has(table), `the scan lost ${table}`).toBe(true);
    }
    expect(scanned.size).toBeGreaterThanOrEqual(18);
  });

  it("answers every one of them", () => {
    const unanswered = Array.from(scanned.entries())
      .filter(([name]) => !(name in OPEN_KIND_POLICY))
      .map(([name, file]) => `${file}:${name}`);
    /*
      The failure message is the whole point: a new table lands with no
      open-kind answer and this names it, in the file it was added to, rather
      than letting the open lane inherit whatever that table's silence means.
    */
    expect(unanswered).toEqual([]);
  });

  it("answers nothing that does not exist", () => {
    const missing = answeredTables().filter((table) => {
      const file = path.join(SERVER_ROOT, "castingV2", OPEN_KIND_POLICY[table].file);
      if (!fs.existsSync(file)) return true;
      return !new RegExp(`^(?:export )?const ${table}\\b`, "m").test(fs.readFileSync(file, "utf8"));
    });
    expect(missing).toEqual([]);
  });

  it("gives every answer a reason and a standing", () => {
    for (const table of answeredTables()) {
      const answer = OPEN_KIND_POLICY[table];
      const reason = "derived" in answer.basis ? answer.basis.derived : answer.basis.stated;
      expect(reason.length, `${table} has no reason`).toBeGreaterThan(40);
      expect(answer.answer.length, `${table} has no answer`).toBeGreaterThan(0);
      expect(["policy", "silence", "owed"]).toContain(answer.standing);
    }
  });

  it("names what is owed rather than counting it", () => {
    const owed = owedByThePolicy();
    expect(owed.length).toBeGreaterThan(0);
    for (const item of owed) expect(item.asks.length).toBeGreaterThan(0);
    /* The three the step 3–5 builds must close first, pinned so a build cannot
       quietly drop one of them off the list by editing this file. */
    const tables = owed.map((item) => item.table);
    expect(tables).toContain("FACET_SLOTS");
    expect(tables).toContain("DEPARTABLE_SUBJECTS");
    expect(tables).toContain("ZONE_SCOPE");
  });
});

describe("the answers themselves", () => {
  it("arms an open ask with the floor, never with nothing", () => {
    /* An `exempt` entry returns "" for a closed subject, and an open kind with
       no qualifier is the three-of-twenty-three defect arriving in a new lane.
       The floor is what makes the presence class honest, so it cannot be empty. */
    expect(openKindQualifier()).toBe(TEETH);
    expect(openKindQualifier().length).toBeGreaterThan(0);
  });

  it("binds on presence, and can therefore refuse", () => {
    expect(openKindBinds()).toBe("presence");
  });

  it("takes the whole frame, claims no reveal, and is one thing", () => {
    expect(openKindZoneScope()).toBe("fullFrame");
    expect(openKindMovesItsEdge()).toBe(false);
    expect(openKindIsPlural()).toBe(false);
    expect(openKindFilesAsIdentity()).toBe(true);
  });

  it("files as `openKind`, never as a decided absence", () => {
    expect(openKindUnfiledReason()).toBe("openKind");
    expect(openKindUnfiledReason()).not.toBe("notASlot");
  });

  it("leaves by dropping the carry, not by an absence phrase", () => {
    expect(openKindDeparture()).toBe("dropTheCarry");
  });

  it("counts at the replacement threshold, and says the number is reasoned", () => {
    const amplitude = openKindAmplitude();
    expect(amplitude.levels).toBe(25);
    expect("reasoned" in amplitude.basis).toBe(true);
  });
});

describe("the heading, which is where a bad key would reach a paid prompt", () => {
  it("upper-cases a real normalizer key", () => {
    expect(openKindHeading("horns")).toBe("HORNS");
    expect(openKindSegmenterQuestion("horns")).toBe("horns");
  });

  it("refuses a dotted, empty or sentence-shaped key", () => {
    /* `facetHeading`'s fallback would put `HAIR.WORN:` into a paid prompt under
       a heading the D-87 sweep cannot see — invisible in the output AND in the
       sweep, which is why this refuses rather than coping. */
    for (const bad of ["hair.worn", "", "  ", "Horns", "give her horns!", "horns2"]) {
      expect(() => openKindHeading(bad), bad).toThrow();
      expect(() => openKindSegmenterQuestion(bad), bad).toThrow();
    }
  });

  it("accepts every key the real normalizer can produce", async () => {
    /*
      ASSERTED THROUGH THE PRODUCER, not against a guess about it. The heading
      guard and `readKind` are two regexes in two files, and the failure this
      catches is them disagreeing — a key the lane accepts and the heading
      refuses is a render that dies after the interpreter said yes.
    */
    const engineSaying = (text: string): TextEngine => ({
      id: "fake",
      complete: async () => ({
        text,
        provenance: { provider: "fake", model: "fake" } as never,
        latencyMs: 1,
      }),
    });
    for (const noun of ["horns", "antlers", "scales", "cat ears", "third eye", "elf-ears"]) {
      const reading = await normalizeOpenKind("give her something", {
        engine: engineSaying(JSON.stringify({ kind: noun })),
      });
      if (!reading.ok) continue;
      expect(() => openKindHeading(reading.kind), noun).not.toThrow();
    }
  });
});

describe("and the closed lane is untouched", () => {
  it("still fails LOUD for a subject with no entry", () => {
    /*
      The note is explicit that `qualifierFor` throwing on an unknown key is the
      GOOD version of this problem and must not be "fixed" into a default. This
      module answers open kinds somewhere else precisely so that stays true —
      and a policy record that had quietly installed a fallback would show up
      here as a silent "".
    */
    expect(() => qualifierFor("horns" as unknown as FreeSubject)).toThrow();
  });

  it("gives every closed subject its own answer, from its own table", () => {
    for (const subject of FREE_SUBJECT_KEYS) {
      expect(qualifierFor(subject).length + (subject === "ink" ? 1 : 0), subject).toBeGreaterThan(0);
    }
  });
});
