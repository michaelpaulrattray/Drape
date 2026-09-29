/**
 * THE CLIENT NO LONGER ASKS WHICH ROAD THIS ACCOUNT IS ON — slice 3 of the
 * old-lane retirement (#1444, parent #180, his word on #1398: *"Delete it"*).
 *
 * # Why this guard exists at all, and why it is the whole of slice 3's proof
 *
 * `authorRoadEnabled` is still SENT by the config route and will be for one
 * more deploy: the client compares `=== true`, so a bundle that outlives this
 * deploy and read a missing field would take the FALSE arm and draw the
 * retired house-road controls. Removing the field is therefore the unsafe
 * direction and is its own commit (the same discipline the billing input rule
 * states in `CLAUDE.md`).
 *
 * So there is a deploy in which the field exists and nothing reads it, and the
 * only thing that can hold that state honest is a guard on the READER side.
 * Slice 2 left a matching note: the arm it added holds the field's VALUE to the
 * Re-imagine door's own answer, and that arm goes when the field does — so the
 * commit that deletes the field cannot lean on a guard it is deleting, and this
 * is what it leans on instead.
 *
 * # ⚠ THE SPLIT THIS FEATURE'S OWN CARD GOT WRONG, AND IT IS WHY THE POSITIVE
 * CONTROLS ARE HALF THIS FILE
 *
 * `authorRoad` names TWO different facts in one feature, in the same two
 * files:
 *
 *   · **THE FLAG** — `config.authorRoadEnabled`, "is this ACCOUNT on the
 *     author road". Retired here.
 *   · **THE ROW** — `RollProjection.authorRoad`, "was THIS ROLL composed on
 *     the author road", read off `compiledBrief.register.kind`. **220 of 306
 *     production sheets read through it and it is permanent.**
 *
 * #1444's own body listed `briefEcho.ts`'s `options.authorRoad` under the
 * flag-derived sites that were to collapse. Read at the code, it is fed from
 * `BriefEcho`'s `authorRoad` prop, which `CastingSheet.tsx` feeds from
 * `roll.data.authorRoad` — **the ROW.** Collapsing it would have silently
 * re-read every old house-road sheet as an authored one, in the grammar the
 * sheet's own sentence is built from, with no test naming the word. The arms
 * below pin BOTH halves, because a guard that only asserted the flag's absence
 * would go green on exactly that mistake.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "../testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const CLIENT_SRC = path.join(process.cwd(), "client", "src");

/** Prose quotes the retired field by name on purpose — strip it before asking. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

type Source = { relative: string; code: string };

/**
 * Every TypeScript source under `client/src`.
 *
 * `statSync` takes `throwIfNoEntry: false` and the read goes through
 * `readListedSource` because this working tree is shared: a listed entry can be
 * gone before it is classified or opened, and skipping it is the correct answer
 * rather than a tolerated failure (`server/testing/listedSource.ts`).
 */
function clientSources(): Source[] {
  const found: Source[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      found.push({ relative: path.relative(CLIENT_SRC, full).replace(/\\/g, "/"), code: code(source) });
    }
  };
  walk(CLIENT_SRC);
  return found;
}

describe("the account-level author-road flag has left the client", () => {
  it("found the population at all — the floor, before any absence is believed", () => {
    const sources = clientSources();
    /*
      An absence assertion over an empty list passes. This is the arm that
      reddens when the walk goes blind, and it names the two files the slice is
      actually about rather than only counting.
    */
    expect(sources.length, "the walk must find the client's sources").toBeGreaterThan(200);
    const named = sources.map((source) => source.relative);
    expect(named).toContain("pages/CastingSheet.tsx");
    expect(named).toContain("pages/CastingV2.tsx");
    expect(named).toContain("features/castingV2/components/BriefEcho.tsx");
  });

  it("no client source reads config.authorRoadEnabled", () => {
    /*
      Test files are excluded and the reason is narrow: one of them asserts
      about the ROUTE's projection rather than reading the field
      (`features/castingV2/wardrobeEditCopy.test.ts` uses it as a positive
      control that the config object still stands). A test naming the field is
      the record of a contract; a component naming it is a reader.
    */
    const readers = clientSources()
      .filter((source) => !/\.test\.tsx?$/.test(source.relative))
      .filter((source) => source.code.includes("authorRoadEnabled"))
      .map((source) => source.relative);
    expect(
      readers,
      "the client stopped reading this field in slice 3; the field itself leaves one deploy later",
    ).toEqual([]);
  });

  it("the ROW-derived authorRoad is untouched — the half that is permanent", () => {
    const sources = new Map(clientSources().map((source) => [source.relative, source.code]));
    const sheet = sources.get("pages/CastingSheet.tsx") ?? "";
    /*
      ⚠ THE ARM THAT WOULD HAVE CAUGHT THE CARD'S OWN MISTAKE. A by-the-name
      collapse of `authorRoad` reads every pre-register sheet as an authored
      one — 86 of 306 production sheets — and no test named the word before
      this one did.
    */
    expect(sheet, "the sheet's notice reads the roll's own road").toContain(
      "authorRoad: roll.data?.authorRoad === true",
    );
    expect(sheet, "the echo is told which road THIS sheet was cast on").toContain(
      "authorRoad={roll.data.authorRoad}",
    );
    const echo = sources.get("features/castingV2/components/BriefEcho.tsx") ?? "";
    expect(echo, "the echo still takes the row as a prop").toContain("authorRoad?: boolean");
    const notice = sources.get("features/castingV2/sheetNotice.ts") ?? "";
    expect(notice, "the notice still keys its stated-outfit rung on the row").toContain(
      "authorRoad: boolean",
    );
  });
});
