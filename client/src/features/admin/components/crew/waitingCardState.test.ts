import { readFile, readdir } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CREW_CARD_STATES, crewCardNeedsHim } from "../../../../../../shared/crewCardState";
import { nextUpRows, replyFallsToGeneral } from "./crewTypes";

const base = (rel: string) => basename(rel);

/**
 * THE ONE ACCEPTED LITERAL ON THE DESK'S SURFACE, AND IT IS A DIFFERENT
 * QUESTION (#649 finding 1).
 *
 * `staleOpenHosts` asks *has he replied to something the page still calls
 * open* — the shift-96 incident. It is not asking *does this still need him*,
 * so `crewCardNeedsHim` is the wrong predicate there: widening it would name
 * every `waiting` card at its FIRST reply, and the reply that moved it to
 * `waiting` is exactly that first reply. The instrument would report its own
 * successes.
 *
 * ⚠ **The gap it leaves is real and is written down rather than closed**: a
 * reply landing on an ALREADY-`waiting` card — *"I've run the command, close
 * it"* — is watched by nothing, and it self-heals only when the issue closes.
 * The clean repair the card proposed (*an acknowledged reply newer than the
 * card's state change*) **is not buildable today**: read at
 * `server/crew/crewBriefing.ts`, a `needsYou` row carries `filedAt` and no
 * record of when its state last moved, so "newer than its state change" has
 * nothing to compare against. The nearest buildable version — flagging a
 * `waiting` card carrying a SECOND acknowledged reply — carries a live false
 * positive (two replies landing between editions, both handled correctly),
 * and a reconciliation instrument whose flags are wrong is one nobody reads.
 *
 * Closing it properly means recording `stateChangedAt` on a host row, which is
 * a change to what his page stores; that is a card, not a line.
 *
 * ⚠ **ONE OCCURRENCE, NOT ONE SPELLING** (PR #656 review, finding 1). The
 * register is keyed on file-plus-expression, so a SECOND identical literal
 * added to the same file would collapse onto the same key and inherit an
 * exemption written for a line it is not — a genuine new offender, silently
 * cleared by the guard built to catch it. Each entry therefore earns exactly
 * one match: the first is exempt, a second is an offender by name.
 */
const ACCEPTED = new Set([
  'lib/replyHosts.mts: host.state !== "open"',
]);

/**
 * A CARD HE HAS ANSWERED THAT STILL NEEDS AN ACT OF HIS STAYS ON HIS DESK
 * (#354 — his ruling, Crew reply #159: *"The first. Keep it on my desk until
 * the act is done."*).
 *
 * The card's own bar: *"the one arm worth having is a POSITIVE CONTROL — a
 * `waiting` card must appear in What needs you and must NOT appear in
 * history."* Both halves are here, plus the thing the card did not ask for and
 * needed most: the three consumers that used to ask `state === "open"`
 * separately are held to ONE answer, so a fourth state cannot be added to two
 * of them and forgotten in the third.
 */
describe("the waiting state", () => {
  it("still needs him, and history does not claim him", () => {
    /* The positive control, stated as the two facts the render depends on. */
    expect(crewCardNeedsHim("waiting")).toBe(true);
    expect(crewCardNeedsHim("open")).toBe(true);
    /* And the negative one — without this the predicate could be `() => true`. */
    expect(crewCardNeedsHim("answered")).toBe(false);
    expect(crewCardNeedsHim("done")).toBe(false);
  });

  it("keeps his reply under the card instead of dropping it in the General box", () => {
    /*
      The silent failure a literal would have caused: the card renders on his
      desk with a thread, and the thread's replies fall past it into General.
      Two views of one question, disagreeing.
    */
    const cards = [
      { id: "still-his", state: "waiting" },
      { id: "finished", state: "answered" },
      { id: "fresh", state: "open" },
    ] as never;
    expect(replyFallsToGeneral("still-his", cards)).toBe(false);
    expect(replyFallsToGeneral("fresh", cards)).toBe(false);
    expect(replyFallsToGeneral("finished", cards)).toBe(true);
    expect(replyFallsToGeneral(null, cards)).toBe(true);
  });

  it("still marks its NEXT UP row as blocked on him", () => {
    /*
      The second silent failure: a card moved to `waiting` is MORE plainly his
      than an open one, so a NEXT UP row it holds must keep saying so.
    */
    const nextUp = {
      readAt: "2026-09-07T12:00:00.000Z",
      items: [{ issueNumber: 999, title: "A card he is holding", urgent: false }],
    } as never;
    const rows = nextUpRows(nextUp, [
      { id: "holding", state: "waiting", issueNumber: 999 },
    ] as never);
    expect(rows[0]?.blockedOnYou).toBe(true);
    expect(rows[0]?.holdingCardId).toBe("holding");
  });

  it("a card that no longer needs him releases the row — the control on the arm above", () => {
    const nextUp = {
      readAt: "2026-09-07T12:00:00.000Z",
      items: [{ issueNumber: 999, title: "A card he is holding", urgent: false }],
    } as never;
    const rows = nextUpRows(nextUp, [
      { id: "holding", state: "answered", issueNumber: 999 },
    ] as never);
    expect(rows[0]?.blockedOnYou).toBe(false);
  });

  it("NOBODY asks the question with a literal — the population is derived, not listed", async () => {
    /*
      ⚠ THIS ARM REPLACES ONE THAT NAMED THREE FILES, AND THE REVIEW OF PR #648
      IS WHY.

      The first version scanned `CrewNeedsYou.tsx` and `crewTypes.ts` — the two
      the fix had touched — so it pinned the consumers that were ALREADY right
      and could not see the ones that were not. There were six more: the desk
      sweep's hold label (the severe one: the escalation gate reads labels only,
      so a `waiting` card would have looked takeable while this page said
      otherwise), the sweep's waiting-founder report, BOTH briefing refinements,
      the eye gallery, and two in the resolution planner.

      A guard whose population is the set of files you already fixed stops
      watching the moment you fix one. So the population is derived: every
      source file on the desk's surface, and the arm fails on the literal
      wherever it appears.
    */
    /*
      ⚠ AND THE POPULATION WAS STILL NARROWER THAN THE SENTENCE ABOVE — #649
      finding 2, from this suite's own round-two review.

      "Every source file on the desk's surface" was true of four DIRECTORIES
      and the `readdir` above was NOT recursive, so `scripts/lib/` — where
      `replyHosts.mts` and `liveBriefing.mts` live, the desk reader's own
      helpers — was invisible to it. Which is this arm's own lesson arriving
      one level down: the population was the shape of the fix, not the shape
      of the question.

      The walk is recursive now and the roots declare what they admit, so a
      new desk file in a subdirectory is scanned the day it is written rather
      than the day somebody remembers this list.
    */
    const roots = [
      { url: new URL("./", import.meta.url), admits: () => true },
      { url: new URL("../../../../../../server/crew/", import.meta.url), admits: () => true },
      { url: new URL("../../../../../../shared/", import.meta.url), admits: (rel: string) => base(rel).startsWith("crew") },
      {
        url: new URL("../../../../../../scripts/", import.meta.url),
        /* `crew-*` AT THE ROOT, as before — the depth is part of the rule and
           the predicate says so (PR #656 review, finding 2: `startsWith` alone
           admitted a `crew-*` basename at any depth while this sentence said
           root, and prose drifting from its predicate is the class this
           repository keeps being bitten by). Plus ALL of `scripts/lib/` — the
           helpers the desk tools read him through. `scripts/calibration/` is a
           paid bench with no notion of his desk and is admitted by neither. */
        admits: (rel: string) => (!rel.includes("/") && base(rel).startsWith("crew-")) || rel.startsWith("lib/"),
      },
    ];
    const offenders: string[] = [];
    const scanned: string[] = [];
    const acceptedSeen = new Map<string, number>();
    for (const root of roots) {
      const dir = fileURLToPath(root.url);
      for (const entry of await readdir(dir, { recursive: true })) {
        const rel = entry.split(sep).join("/");
        const name = base(rel);
        if (!/\.(ts|tsx|mts)$/.test(name)) continue;
        /* `.mts` is in the extension list above, so it is in the test-file
           exclusion too — none exists today and the cost of the omission
           would only ever be a loud false red, but a list that admits an
           extension and forgets it one line later is how they drift. */
        if (/\.test\.(ts|tsx|mts)$/.test(name)) continue;
        if (!root.admits(rel)) continue;
        const src = await readFile(join(dir, rel), "utf8");
        scanned.push(rel);
        /* CODE ONLY — a docblock may quote the retired literal, and several
           deliberately do to explain what changed. Comments are stripped first
           so quoting the defect is never mistaken for committing it. */
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        for (const m of code.matchAll(/(\w+)\.state\s*[!=]==\s*"open"/g)) {
          /* `problem.state` is a different field with three states of its own
             and no notion of him — it is not this question. */
          if (m[1] === "problem") continue;
          const found = `${rel}: ${m[0]}`;
          if (ACCEPTED.has(found)) {
            const nth = (acceptedSeen.get(found) ?? 0) + 1;
            acceptedSeen.set(found, nth);
            /* The exemption is for ONE line. A second occurrence of the same
               text in the same file is a different line wearing it. */
            if (nth === 1) continue;
            offenders.push(`${found}  [occurrence ${nth} — the exemption covers one]`);
            continue;
          }
          offenders.push(found);
        }
      }
    }
    expect(offenders, "these ask 'does this still need him' with a literal").toEqual([]);

    /* ⚠ THE WIDENING PROVES ITSELF, OR IT REVERTS IN SILENCE. A wrong `admits`
       predicate empties the new half of the population and leaves this arm
       green — which is the exact failure the recursive walk was written to
       end. So the file the widening exists for is named. */
    expect(scanned, "the walk reaches scripts/lib — the reason it became recursive")
      .toContain("lib/replyHosts.mts");
    expect(scanned.length).toBeGreaterThan(10);

    /* An accepted literal that no longer exists is a hole kept open for a line
       that has gone, and one matching TWICE is an exemption covering a line it
       was never written for. Each must be met EXACTLY ONCE on this run. */
    expect(
      Object.fromEntries([...acceptedSeen].sort()),
      "each accepted literal earns its exemption by being found exactly once",
    ).toEqual(Object.fromEntries([...ACCEPTED].sort().map((entry) => [entry, 1])));

    /* ⚠ TWO POSITIVE CONTROLS, because an empty `offenders` is a claim about a
       checker (working law 2, and the review of this PR asked for the second).

       The first proves the scanner READ something. The second proves the
       PATTERN can still match an offender — a lost escape or a stray `=` in a
       future edit would empty `offenders` forever and leave this arm green,
       which is the checker that cannot fail. */
    const needsYou = await readFile(new URL("./CrewNeedsYou.tsx", import.meta.url), "utf8");
    expect(needsYou).toContain("crewCardNeedsHim(card.state)");
    expect('const x = card.state === "open";'.match(/(\w+)\.state\s*[!=]==\s*"open"/))
      .not.toBeNull();
    expect('if (item.state !== "open") return;'.match(/(\w+)\.state\s*[!=]==\s*"open"/))
      .not.toBeNull();
  });

  it("the render says which kind it is, in his words rather than the field's", async () => {
    const needsYou = await readFile(new URL("./CrewNeedsYou.tsx", import.meta.url), "utf8");
    expect(needsYou).toContain('card.state === "waiting"');
    expect(needsYou).toContain("Answered · still yours to do");
    expect(needsYou).toContain("dp-crew__waitchip");

    const css = await readFile(new URL("./crew.css", import.meta.url), "utf8");
    const at = css.indexOf(".dp-crew__waitchip {");
    expect(at, "the chip's rule must exist to be read").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    /* Monochrome and quiet: a chore he already agreed to must not outrank a
       fresh question sitting beside it. */
    expect(rule).toContain("var(--faint)");
    expect(rule).not.toMatch(/background:/);
  });

  it("names every state once, in page order", () => {
    expect([...CREW_CARD_STATES]).toEqual(["open", "waiting", "answered", "done"]);
    expect(new Set(CREW_CARD_STATES).size).toBe(CREW_CARD_STATES.length);
  });
});
