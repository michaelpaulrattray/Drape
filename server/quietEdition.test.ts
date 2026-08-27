import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRIEFING_PATH,
  generatedFilesFrom,
  judgeQuietEdition,
  QUIET_PATTERN,
  QUIET_REFUSAL,
} from "../scripts/lib/quietEdition.mts";

/**
 * The rite's quiet-edition refusal (#159), driven at fixtures AND at the two
 * real quiet editions that bought it. The fixture pair reddens exactly on the
 * quiet-only case; every reverse case passes; and the same judge, handed the
 * committed bytes of editions 52 and 53 (the two deploys the founder paid
 * for), says quiet — while a working shift's edition says not.
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
  journal: [
    { at: "2026-08-27T09:55:00+10:00", shift: "foreman-43", text: "Quiet shift — nothing needed doing." },
    { at: "2026-08-26T06:50:00+10:00", shift: "foreman-12", text: "Still no word from you on the court strips." },
  ],
  acknowledgedReplyIds: [1, 2, 3],
};

/** The next edition: header bumped, one journal line prepended, the oldest dropped at the cap. */
const edition = (journalText: string, mutate: (b: typeof parentBriefing) => void = () => {}) => {
  const next = structuredClone(parentBriefing);
  next.edition = 53;
  next.updatedAt = "2026-08-27T10:30:00+10:00";
  next.shift = "foreman-44";
  next.journal = [{ at: "2026-08-27T10:30:00+10:00", shift: "foreman-44", text: journalText }, next.journal[0]!];
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

const QUIET_LINE = "Quiet shift — nothing needed doing. Still no new word from you and nothing in N1 is left to build.";

describe("the quiet-only case is refused", () => {
  it("a briefing-only push whose only change is a quiet journal line is QUIET", () => {
    const verdict = judge(edition(QUIET_LINE));
    expect(verdict.quiet).toBe(true);
    expect(verdict.why).toMatch(/adds only 1 quiet journal line/);
  });

  it("a header-only bump that adds nothing is quieter still, and refused the same way", () => {
    const next = structuredClone(parentBriefing);
    next.edition = 53;
    next.updatedAt = "2026-08-27T10:30:00+10:00";
    next.shift = "foreman-44";
    expect(judge(JSON.stringify(next)).quiet).toBe(true);
  });

  it("the generated atlas files riding alongside do not make it a working push", () => {
    expect(GENERATED.length).toBeGreaterThanOrEqual(3);
    expect(judge(edition(QUIET_LINE), [BRIEFING_PATH, ...GENERATED]).quiet).toBe(true);
  });

  it("matches the wrapped report the runner's line reading missed — the belt to that brace", () => {
    expect(QUIET_PATTERN.test("this was a\nquiet   night")).toBe(true);
    expect(judge(edition("Quiet shift — nothing\nneeded doing.")).quiet).toBe(true);
  });

  it("the refusal is the card's sentence", () => {
    expect(QUIET_REFUSAL).toBe(
      "a quiet edition does not deploy — the previous edition already says nothing waits on him (standing orders §2)",
    );
  });
});

describe("every reverse case passes", () => {
  it("a quiet line beside a NEW acknowledged reply is a working shift", () => {
    const verdict = judge(edition(QUIET_LINE, (b) => { b.acknowledgedReplyIds.push(4); }));
    expect(verdict.quiet).toBe(false);
    expect(verdict.why).toContain("acknowledgedReplyIds");
  });

  it("a quiet line beside a moved card, step, chip or eye item passes, and names what moved", () => {
    for (const [key, mutate] of [
      ["needsYou", (b: typeof parentBriefing) => { b.needsYou = []; }],
      ["pipeline", (b: typeof parentBriefing) => { b.pipeline[0]!.step = "done"; }],
      ["eyeItems", (b: typeof parentBriefing) => { b.eyeItems.push({ id: "x", title: "a new strip" }); }],
      ["problems", (b: typeof parentBriefing) => { (b.problems as unknown[]).push({ id: "p" }); }],
    ] as const) {
      const verdict = judge(edition(QUIET_LINE, mutate));
      expect(verdict.quiet, key).toBe(false);
      expect(verdict.why, key).toContain(key);
    }
  });

  it("a journal line with news in it is news", () => {
    const verdict = judge(edition("Merged #159 — the rite now refuses a quiet edition; proven red on e53's own bytes."));
    expect(verdict.quiet).toBe(false);
    expect(verdict.why).toMatch(/news/);
  });

  it("a quiet line whose push also carries a product file is a working push", () => {
    const verdict = judge(edition(QUIET_LINE), [BRIEFING_PATH, "scripts/deploy-rite.mts"]);
    expect(verdict.quiet).toBe(false);
    expect(verdict.why).toContain("scripts/deploy-rite.mts");
  });

  it("nothing to push, a push without the briefing, or a briefing new on main — none is quiet", () => {
    expect(judge(edition(QUIET_LINE), []).quiet).toBe(false);
    expect(judge(edition(QUIET_LINE), ["docs/architecture/capability-atlas.md"]).quiet).toBe(false);
    expect(judgeQuietEdition({
      changedFiles: [BRIEFING_PATH], generatedFiles: GENERATED, parentBriefing: null, headBriefing: edition(QUIET_LINE),
    }).quiet).toBe(false);
  });

  it("key order is not a change", () => {
    const reordered = JSON.parse(edition(QUIET_LINE));
    const swapped = Object.fromEntries(Object.entries(reordered).reverse());
    expect(judge(JSON.stringify(swapped)).quiet).toBe(true);
  });

  it("a briefing that does not parse is not called quiet — a different gate owns that", () => {
    expect(judge("{ not json").quiet).toBe(false);
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
