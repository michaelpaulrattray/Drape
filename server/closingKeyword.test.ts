import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLOSING_KEYWORDS,
  closingKeywordHits,
  closingKeywordRefusal,
} from "../scripts/lib/closingKeyword.mts";

/**
 * #376 — THE CLOSING KEYWORD, AND THE ONLY FIXTURES THAT MATTER ARE THE REAL ONES.
 *
 * Eight instances in five grammatical frames are recorded on the card, and five
 * of them have their PR body still readable. **Those bodies are the corpus
 * here**, quoted verbatim rather than paraphrased into something tidier — the
 * whole class is that a frame nobody expected to parse, parsed. An invented
 * fixture is a test of my imagination; instance 7 is a sentence that says *"Not
 * a closing keyword anywhere in this body"* and contains one.
 *
 * The negative corpus matters exactly as much (working law 2): the phrases this
 * team writes constantly — *"#368 stays open"*, *"this closes the gap"* — must
 * pass, or the check is edited out of the gate inside a week.
 */

/** Instance 3, PR #371 — the negation that was the defect. */
const INSTANCE_3 =
  "Closes #368 is deliberately NOT written here — the card keeps its second half open " +
  "for the founder's word on the reviewer's manual road.";

/** Instance 4, PR #583 — the keyword with the receipt promised after it. */
const INSTANCE_4 = "Closes #391 — after merge, deploy, and the card's close-by-hand with this receipt.";

/** Instance 5, PR #598 — mid-sentence, lower case, and denied in the same line. */
const INSTANCE_5 = "- His eye closes #535 and #534 — this PR closes neither.";

/** Instance 7, PR #601 — the body that says it contains no closing keyword. */
const INSTANCE_7 =
  "**#535 decision 12 — the generated chips, and the tap that writes one in.** The last piece " +
  "of the Re-imagine build before his eye closes the card. Not a closing keyword anywhere in " +
  "this body: his eye closes #535 (#376's class, twice on the last PR).";

/** Instance 8, PR #619 — the plain one, after three shifts had written the rule down. */
const INSTANCE_8 = "Closes #404";

describe("#376 — every recorded instance is caught", () => {
  it.each([
    ["instance 3 (PR #371) — the negation", INSTANCE_3, "#368"],
    ["instance 4 (PR #583) — the promised receipt", INSTANCE_4, "#391"],
    ["instance 5 (PR #598) — mid-sentence, denied in the same line", INSTANCE_5, "#535"],
    ["instance 7 (PR #601) — the body claiming to contain no keyword", INSTANCE_7, "#535"],
    ["instance 8 (PR #619) — the plain one", INSTANCE_8, "#404"],
  ])("%s", (_name, body, reference) => {
    const hits = closingKeywordHits(body);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.reference)).toContain(reference);
  });

  it("instance 6's road: a commit SUBJECT closes from main, and the subject is just text", () => {
    /* The real subject of `c2a8fb7c`, which closed #535 from an edition commit
       four minutes after instance 5 closed it from a PR body. */
    const subject = "docs(crew): edition 245 — his eye closes #535/#534 (#535)";
    expect(closingKeywordHits(subject)).toHaveLength(1);
    expect(closingKeywordHits(subject)[0].reference).toBe("#535");
  });
});

describe("#376 — what it must NOT refuse, or it gets edited out of the gate", () => {
  it.each([
    ["the prescribed replacement", "#368 stays open for his word."],
    ["a card named without a verb", "Card: #663 — the switch panel's number."],
    ["the keyword with no reference at all", "This closes the gap the last PR left."],
    ["a reference with the keyword AFTER it", "#535 is closed by his eye, not by this PR."],
    ["a bare number beside prose", "Fixed the thing. See #12 for the measurement."],
    ["a version-ish number that is not a reference", "resolves 3 of the 4 findings"],
  ])("%s", (_name, body) => {
    expect(closingKeywordHits(body)).toHaveLength(0);
  });

  it("this very suite's own prose is quotable — the file that describes the token is not the token", () => {
    /* The rule ships in the standing orders, in CLAUDE.md and in card bodies,
       and a check that cannot be written about is one nobody documents. What
       makes those safe is that they never put the keyword IMMEDIATELY before a
       number, which is the only shape GitHub reads. */
    expect(closingKeywordHits("Never write Closes / Fixes / Resolves before a card number.")).toHaveLength(0);
  });
});

describe("#376 — the shape of the reader", () => {
  it("every one of GitHub's nine keywords is matched, in either case, with or without the colon", () => {
    for (const keyword of CLOSING_KEYWORDS) {
      expect(closingKeywordHits(`${keyword} #7`), keyword).toHaveLength(1);
      expect(closingKeywordHits(`${keyword.toUpperCase()}: #7`), keyword).toHaveLength(1);
    }
    /* Nine, and the count is asserted so a keyword deleted from the list is a
       red rather than a silently narrower checker. */
    expect(CLOSING_KEYWORDS).toHaveLength(9);
  });

  it("the cross-repository and URL reference forms count too", () => {
    expect(closingKeywordHits("Fixes michaelpaulrattray/Drape#12")).toHaveLength(1);
    expect(closingKeywordHits("Resolves https://github.com/michaelpaulrattray/Drape/issues/12")).toHaveLength(1);
  });

  it("a second hit on the SAME line is found, and every hit knows its line", () => {
    /* ⚠ WHAT THIS ARM ACTUALLY CATCHES, stated after driving it rather than
       before: a reader that stops at the first match per line (or per text).
       It does NOT catch removing the `lastIndex` reset in the reader — that
       sabotage was driven and stayed green, because `exec` resets the cursor
       itself when it returns null. The reset is insurance and the module says
       so; this arm claims only what it proved. */
    expect(closingKeywordHits("Closes #1 and closes #2")).toHaveLength(2);
    const twoLines = closingKeywordHits("Closes #1\nCloses #2");
    expect(twoLines.map((h) => h.line)).toEqual([1, 2]);
  });

  it("the refusal names the line, the frame and what to do instead", () => {
    const refusal = closingKeywordRefusal("the PR body", closingKeywordHits(`x\n${INSTANCE_3}`));
    expect(refusal).toContain("line 2");
    expect(refusal).toContain("#368");
    /* The frame is quoted back, because "you wrote a closing keyword" over a
       sentence whose purpose was to avoid one reads as a broken checker. */
    expect(refusal).toContain("deliberately NOT written here");
    expect(refusal).toContain("gh issue close");
  });
});

/*
  ⚠ THE THREE CALL SITES — A READER NOTHING CALLS IS THE DEFECT THIS REPOSITORY
  FILES MOST OFTEN (invariant 7, and #286/#295 are two instances from one week).

  These are source reads and they are the weak half; what they prove is that the
  wiring exists at all. The behaviour of each road was driven by hand and the
  receipts are on the PR: the checker run against the five real instance PRs
  (all five refused) and against a clean one (passed).
*/
describe("#376 — all three roads call it", () => {
  const root = path.resolve(__dirname, "..");
  const read = (p: string) => readFileSync(path.join(root, p), "utf8");

  it("road 1 — the PR gate reads the pull request's title and body", () => {
    const workflow = read(".github/workflows/gate.yml");
    expect(workflow).toContain("scripts/check-closing-keyword.mts --pr");
    /* Inside gate-checks, which is a REQUIRED check and therefore blocks;
       founder-gate only labels. */
    const inGateChecks = workflow.indexOf("scripts/check-closing-keyword.mts");
    expect(inGateChecks).toBeGreaterThan(workflow.indexOf("gate-checks:"));
    expect(inGateChecks).toBeLessThan(workflow.indexOf("founder-gate:"));
    /* Before the expensive steps: the repair is one edit to a description, and
       learning that at 30s rather than 8m is the point. */
    expect(inGateChecks).toBeLessThan(workflow.indexOf("pnpm check"));
  });

  it("road 2 — the merge helper checks again at the squash, and reads the COMMITS too", () => {
    const merge = read("scripts/pr-merge-in-order.mts");
    /* ⚠ THE CALL, NOT THE NAME. The first shape of this arm looked for
       `refuseAccidentalClose` and would have stayed green with the function
       declared and never invoked — which is invariant 7 written INTO the guard
       that exists to prevent it. */
    expect(merge).toContain("refuseAccidentalClose(pr);");
    /* The commit list is the half the gate cannot see: GitHub writes the squash
       body from the branch's own messages. */
    expect(merge).toContain('"title,body,commits"');
  });

  it("road 3 — the rite refuses a commit reaching main", () => {
    const rite = read("scripts/deploy-rite.mts");
    expect(rite).toContain("closingKeywordHits");
    /* It reads the push range, not just HEAD: instance 6 rode in on an edition
       commit and the rite pushes several at a time. */
    expect(rite).toContain('git("log", "-1", "--format=%B", sha)');
  });

  it("no road re-spells the pattern — one declaration, three importers", () => {
    for (const file of [
      "scripts/check-closing-keyword.mts",
      "scripts/pr-merge-in-order.mts",
      "scripts/deploy-rite.mts",
    ]) {
      expect(read(file), file).toContain('from "./lib/closingKeyword.mts"');
    }
    /* Working law 4: the nine keywords are declared once. A second spelling
       anywhere is drift that fails in the direction that lets a card close. */
    const others = ["scripts/check-closing-keyword.mts", "scripts/pr-merge-in-order.mts", "scripts/deploy-rite.mts"]
      .filter((file) => /\bresolve[sd]?\b\s*\|\s*/.test(read(file)));
    expect(others).toEqual([]);
  });
});
