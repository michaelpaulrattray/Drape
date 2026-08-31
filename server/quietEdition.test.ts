import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRIEFING_PATH,
  generatedFilesFrom,
  judgeQuietEdition,
  QUIET_REFUSAL,
} from "../scripts/lib/quietEdition.mts";

/**
 * The rite's quiet-edition refusal (#159), driven at fixtures AND at the three
 * real editions that bought it. The fixtures redden exactly on the no-news
 * case; every reverse case passes; and the same judge, handed the committed
 * bytes of editions 52 and 53 (the two deploys the founder paid for), says
 * quiet — while a working shift's edition says not.
 *
 * ⚠ **THE FIXTURES LOST THEIR JOURNAL AND THE REAL SPECIMENS KEPT THEIRS
 * (#293).** The founder removed the journal from his page, so a briefing
 * written from now on has no such field and an edition can no longer carry
 * news as prose — the judge's third rule (does the added entry match a quiet
 * pattern) has no population and is gone. The three committed specimens were
 * all written while the field existed, which is exactly why the judge still
 * excludes it: they are its only proof against real bytes, and an instrument
 * that can no longer be run against its own specimens is not verified.
 * `parentBriefing` below therefore models TODAY's briefing, and the specimens
 * model the world the guard was born in; both must pass.
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED = generatedFilesFrom(readFileSync(path.join(ROOT, ".gitattributes"), "utf8"));

const parentBriefing = {
  edition: 52,
  updatedAt: "2026-08-27T09:55:00+10:00",
  shift: "foreman-43",
  program: { mission: "The Midjourney of casting.", focus: { title: "N1" } },
  needsYou: [{ id: "card-1", title: "Pick A or B" }],
  eyeItems: [{ id: "strip-130", title: "the framing strip" }],
  pipeline: [{ id: "n1", step: "his eye" }],
  problems: [],
  acknowledgedReplyIds: [1, 2, 3],
};

/** The next edition: header bumped, and whatever the case under test moves. */
const edition = (mutate: (b: typeof parentBriefing) => void = () => {}) => {
  const next = structuredClone(parentBriefing);
  next.edition = 53;
  next.updatedAt = "2026-08-27T10:30:00+10:00";
  next.shift = "foreman-44";
  mutate(next);
  return JSON.stringify(next, null, 2);
};

const judge = (headBriefing: string, changedFiles: string[] = [BRIEFING_PATH]) =>
  judgeQuietEdition({
    changedFiles,
    generatedFiles: GENERATED,
    parentBriefing: JSON.stringify(parentBriefing, null, 2),
    headBriefing,
  });

describe("the no-news case is refused", () => {
  it("a briefing-only push that bumps the header and moves nothing is QUIET", () => {
    const verdict = judge(edition());
    expect(verdict.quiet).toBe(true);
    expect(verdict.why).toMatch(/changes nothing but its own edition number/);
  });

  it("the generated atlas files riding alongside do not make it a working push", () => {
    expect(GENERATED.length).toBeGreaterThanOrEqual(3);
    expect(judge(edition(), [BRIEFING_PATH, ...GENERATED]).quiet).toBe(true);
  });

  it("the refusal is the card's sentence", () => {
    expect(QUIET_REFUSAL).toBe(
      "a quiet edition does not deploy — the previous edition already says nothing waits on him (standing orders §2)",
    );
  });
});

describe("every reverse case passes", () => {
  it("a NEW acknowledged reply is a working shift", () => {
    const verdict = judge(edition((b) => { b.acknowledgedReplyIds.push(4); }));
    expect(verdict.quiet).toBe(false);
    expect(verdict.why).toContain("acknowledgedReplyIds");
  });

  it("a moved card, step, chip or eye item passes, and names what moved", () => {
    for (const [key, mutate] of [
      ["needsYou", (b: typeof parentBriefing) => { b.needsYou = []; }],
      ["pipeline", (b: typeof parentBriefing) => { b.pipeline[0]!.step = "done"; }],
      ["eyeItems", (b: typeof parentBriefing) => { b.eyeItems.push({ id: "x", title: "a new strip" }); }],
      ["problems", (b: typeof parentBriefing) => { (b.problems as unknown[]).push({ id: "p" }); }],
    ] as const) {
      const verdict = judge(edition(mutate));
      expect(verdict.quiet, key).toBe(false);
      expect(verdict.why, key).toContain(key);
    }
  });

  it("a push that also carries a product file is a working push", () => {
    const verdict = judge(edition(), [BRIEFING_PATH, "scripts/deploy-rite.mts"]);
    expect(verdict.quiet).toBe(false);
    expect(verdict.why).toContain("scripts/deploy-rite.mts");
  });

  it("nothing to push, a push without the briefing, or a briefing new on main — none is quiet", () => {
    expect(judge(edition(), []).quiet).toBe(false);
    expect(judge(edition(), ["docs/architecture/capability-atlas.md"]).quiet).toBe(false);
    expect(judgeQuietEdition({
      changedFiles: [BRIEFING_PATH], generatedFiles: GENERATED, parentBriefing: null, headBriefing: edition(),
    }).quiet).toBe(false);
  });

  it("key order is not a change", () => {
    const reordered = JSON.parse(edition());
    const swapped = Object.fromEntries(Object.entries(reordered).reverse());
    expect(judge(JSON.stringify(swapped)).quiet).toBe(true);
  });

  it("a briefing that does not parse is not called quiet — a different gate owns that", () => {
    expect(judge("{ not json").quiet).toBe(false);
  });
});

/**
 * ⚠ **THE LEGACY CLAUSE, DRIVEN BOTH WAYS.** The judge still excludes a
 * `journal` key, and #293 justifies that on the specimens below rather than on
 * taste — so the clause gets its own arm here, at the shape those specimens
 * have, not only at the real commits. A journal-era edition that moves nothing
 * else is quiet however its prose reads; one that also moves a card is not.
 */
describe("a briefing written before #293 still judges correctly", () => {
  const legacyParent = { ...structuredClone(parentBriefing), journal: [
    { at: "2026-08-26T06:50:00+10:00", shift: "foreman-12", text: "Still no word from you on the court strips." },
  ] };
  const legacyEdition = (text: string, mutate: (b: typeof legacyParent) => void = () => {}) => {
    const next = structuredClone(legacyParent);
    next.edition = 53;
    next.updatedAt = "2026-08-27T10:30:00+10:00";
    next.shift = "foreman-44";
    next.journal = [{ at: "2026-08-27T10:30:00+10:00", shift: "foreman-44", text }, next.journal[0]!];
    mutate(next);
    return JSON.stringify(next, null, 2);
  };
  const judgeLegacy = (head: string) => judgeQuietEdition({
    changedFiles: [BRIEFING_PATH],
    generatedFiles: GENERATED,
    parentBriefing: JSON.stringify(legacyParent, null, 2),
    headBriefing: head,
  });

  it("a journal line alone is quiet — whatever it says, because prose is not news", () => {
    expect(judgeLegacy(legacyEdition("Quiet shift — nothing needed doing.")).quiet).toBe(true);
    expect(judgeLegacy(legacyEdition("Merged #159 — the rite now refuses a quiet edition.")).quiet).toBe(true);
  });

  it("a journal line beside a moved card is a working shift", () => {
    const verdict = judgeLegacy(legacyEdition("anything", (b) => { b.needsYou = []; }));
    expect(verdict.quiet).toBe(false);
    expect(verdict.why).toContain("needsYou");
  });
});

describe("the generated-file tolerance is derived from .gitattributes", () => {
  it("reads the merge=atlas paths and nothing else", () => {
    expect(generatedFilesFrom([
      "# a comment",
      "* text=auto eol=lf",
      "docs/architecture/drape-architecture.json merge=atlas",
      "  docs/architecture/capability-atlas.md   merge=atlas  ",
      "server/x.ts merge=other",
    ].join("\n"))).toEqual(["docs/architecture/drape-architecture.json", "docs/architecture/capability-atlas.md"]);
    expect(GENERATED).toContain("docs/architecture/drape-architecture.json");
  });
});

/**
 * THE REAL SPECIMENS. `b053645d` (e52, foreman-43) and `7d027475` (e53,
 * foreman-44) are the two quiet deploys the card was filed on; `c46f5885`
 * (e51, foreman-42) closed #152 and moved its cards. Read at the committed
 * bytes, exactly as the rite reads them.
 */
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const atCommit = (commit: string) => judgeQuietEdition({
  changedFiles: git("diff", "--name-only", `${commit}~1`, commit).split(/\r?\n/),
  generatedFiles: GENERATED,
  parentBriefing: git("show", `${commit}~1:${BRIEFING_PATH}`),
  headBriefing: git("show", `${commit}:${BRIEFING_PATH}`),
});

describe("at the real editions", () => {
  /* ⚠ These are the judge's only proof against bytes nobody wrote for a test,
     and all three predate #293 — so they are also what keeps the legacy
     `journal` exclusion honest work rather than a leftover. Delete the clause
     and both positive controls flip to "the edition changes journal". */
  it("the two quiet deploys of 2026-08-27 morning are QUIET (positive control)", () => {
    for (const commit of ["b053645d", "7d027475"]) {
      const verdict = atCommit(commit);
      expect(verdict.quiet, `${commit}: ${verdict.why}`).toBe(true);
    }
  });

  it("a working shift's edition is NOT (negative control)", () => {
    const verdict = atCommit("c46f5885");
    expect(verdict.quiet, verdict.why).toBe(false);
  });
});
