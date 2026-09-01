/**
 * THE REVIEWER'S MANUAL BUTTON WORKS ONCE, AND THE TREE MUST SAY SO (#368).
 *
 * The Fable reviewer has one manual road: `gh pr edit <n> --add-label
 * needs-fable`, which review.yml picks up through its `labeled` event. It
 * is real and it works — the card that filed this said the reviewer had no
 * manual re-trigger, and that was true of `workflow_dispatch` and false of
 * the capability.
 *
 * Its defect is quieter than an absence. GitHub delivers no `labeled` event
 * when the label is ALREADY on the pull request, so pressing the button a
 * second time starts nothing — and `gh` exits 0 while doing it, so the
 * operator is told it worked. Measured at the issue timeline on 2026-09-01,
 * both directions:
 *
 *   press one (label absent)          -> 1 `labeled` event
 *   press two (label already present) -> still 1, `gh` exit 0
 *   remove, then add                  -> 2
 *
 * The founder ruled the repair himself (Crew reply #77, verbatim and
 * entire): *"A. The road already exists; what it needs is one honest
 * sentence, not a second road nobody can test yet."* So nothing new was
 * built — the sentences describing the button were corrected, and this
 * guard is what stops them rotting back into the confident version.
 *
 * THE POPULATION IS DERIVED, NOT LISTED (working law 4, and the
 * list-stops-being-the-list class). Arm 1 does not know which files ought
 * to describe the button. It finds every tracked file that hands out the
 * command and requires each one to hand out the remedy beside it, so a
 * third file documenting the button next year is covered on the day it is
 * written, with no edit here. It refuses an empty population rather than
 * passing green over a broken search — a collector that can come up empty
 * must throw.
 *
 * Arm 2 points the other way. The caveat is only true while review.yml
 * actually works by the `labeled` event: if the trigger were ever changed
 * to fire some other way, these sentences would become wrong in the
 * OPPOSITE direction — telling an operator to remove a label for no
 * reason — and nothing else in the suite would notice.
 *
 * What this deliberately does NOT do: assert the GitHub behaviour itself.
 * That is a fact about GitHub's webhook delivery, measured above at the
 * artifact and recorded here; a test cannot re-measure it without spending
 * a real label event on a real pull request every run.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The command that presses the button. */
const PRESS = "--add-label needs-fable";
/** The command that makes a second press possible. */
const REMEDY = "--remove-label needs-fable";

/** Tracked text files, from git — never a hand-kept list of paths. */
function trackedTextFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "*.md", "*.yml", "*.yaml", "*.ts", "*.mts", "*.sh"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return out.split("\0").filter(Boolean);
}

/**
 * This file, which must be excluded from its own population.
 *
 * ⚠ Found by the negative control, and it is the specimen-joins-the-
 * vocabulary class: the guard quotes both commands as string constants, so
 * without this exclusion it MATCHED ITSELF — carrying both the press and
 * the remedy, it satisfied arm 2 on its own and made arm 1's "population is
 * not empty" true no matter what the rest of the tree said. Renaming the
 * command everywhere else then reddened nothing. A guard is not
 * documentation handing out a command; it is the thing checking the
 * documentation, and it does not get to be its own evidence.
 */
const SELF = "server/reviewerManualRoad.test.ts";

/** Every tracked file that tells a reader to press the button. */
function filesHandingOutThePress(): string[] {
  const hits: string[] = [];
  for (const rel of trackedTextFiles()) {
    if (rel.replace(/\\/g, "/") === SELF) continue;
    let body: string;
    try {
      body = readFileSync(path.join(repoRoot, rel), "utf8");
    } catch {
      continue; // a path in the index but not on disk is not this guard's business
    }
    if (body.includes(PRESS)) hits.push(rel);
  }
  return hits;
}

describe("the reviewer's manual road says what it really does (#368)", () => {
  it("something OTHER THAN THIS FILE still hands out the button — an empty sweep is a broken sweep, not a pass", () => {
    const files = filesHandingOutThePress();
    // Working law 2: the collector must be unable to pass by finding nothing.
    // If the command is ever renamed, this reddens and asks for PRESS to be
    // re-pointed, rather than quietly certifying a tree it never read.
    expect(files.length).toBeGreaterThan(0);
  });

  it("every file that hands out the press also hands out the remove-then-add remedy", () => {
    const offenders = filesHandingOutThePress().filter(
      (rel) => !readFileSync(path.join(repoRoot, rel), "utf8").includes(REMEDY),
    );
    // The failure this exists for: a sentence saying `--add-label needs-fable`
    // "re-runs the review", with nothing beside it warning that the second
    // press is silent. That sentence was in gate.yml until #368.
    expect(offenders).toEqual([]);
  });

  it("review.yml still works by the `labeled` event, which is the only reason the caveat is true", () => {
    const review = readFileSync(
      path.join(repoRoot, ".github/workflows/review.yml"),
      "utf8",
    );
    // The trigger list must still contain `labeled` ...
    const triggerTypes = /types:\s*\[([^\]]*)\]/.exec(review)?.[1] ?? "";
    expect(triggerTypes).toContain("labeled");
    // ... and triage must still admit exactly this one label, so that the
    // button is a button and not any label at all.
    expect(review).toContain("github.event.label.name == 'needs-fable'");
  });
});
