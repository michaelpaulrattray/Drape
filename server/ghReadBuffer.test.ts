/**
 * THE `gh` READ BUFFER, DRIVEN AT A REAL PAYLOAD (#1870).
 *
 * Four readings capture a page of CARD BODIES and had no `maxBuffer`, so they
 * sat on `execFileSync`'s 1 MiB default. An exceeded buffer is a **THROW**, and
 * every one of the four wraps its call in a `catch` that returns `null` or
 * `[]` — so the failure is not a short answer, it is an **unread board**
 * reported as an empty one, in the machinery that decides what gets built and
 * what reaches his Desk. `#1867` is what that looks like from outside: the
 * briefing crossed the same 1 MiB line and three nights were spent diagnosing
 * a git clone that was never the problem.
 *
 * # Why a real child process and not a fixture
 *
 * The defect is a NUMBER against a SIZE, and `server/briefingAtCommit.test.ts`
 * is the precedent this follows: a fixture proves whatever size it was written
 * at, and would have been green on the night the real payload crossed the line.
 * So the negative arm REPRODUCES the throw against a process emitting the
 * measured worst-case page, and the positive arm reads the same bytes through
 * the shipped figure.
 *
 * ⚠ **WHAT WAS DECLINED, named rather than left to be discovered.** The card
 * offered a second shape — *"a payload-size arm over the real board"* — and it
 * is NOT taken: it needs an authenticated `gh`, a network and GitHub's own
 * budget, which every seat and the crew share off ONE account, and a guard that
 * polls the board is a guard that reddens on a rate limit. The measured figures
 * are carried here as constants instead, and the arm that keeps them honest
 * asserts the shipped buffer clears them — so lowering the constant below the
 * board's own projection reddens, while nothing here ever calls GitHub.
 *
 * # The spawning arms are the ones that can fail
 *
 * Delete `maxBuffer` from the subject and POSITIVE throws; raise node's default
 * past the payload and NEGATIVE stops throwing. Working law 2: the negative
 * control is what makes the positive one worth anything.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  GH_READ_MAX_BUFFER,
  type GhExec,
  ghReadMaxBuffer,
  makeGhTransport,
} from "../scripts/lib/ghQueueTransport.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* This suite spawns real node processes AND reads tracked source off the tree,
   so it is in both #548's and #741's populations. Either constant lifts the
   file off vitest's 5 s default, which is the property both guards are about. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = resolve(import.meta.dirname, "..");

/** What `execFileSync` gives a caller that passes nothing. The whole defect. */
const NODE_DEFAULT_MAX_BUFFER = 1024 * 1024;

/*
  THE MEASURED EXPOSURE, 2026-10-04, from the card's own reading of the live
  board — projected at the LARGEST row observed rather than the mean, because a
  mean is not what breaks a bounded page.

    mean 3,452 bytes a card,  largest 10,936, page cap 200
    mean 6,891 bytes a PR,    largest 13,972, page cap 100
*/
const WORST_CASE_CARD_PAGE_BYTES = 200 * 10_936;
const WORST_CASE_PR_PAGE_BYTES = 100 * 13_972;

/** A real process emitting real bytes down a real pipe. */
function readChildOutput(bytes: number, maxBuffer: number): string {
  return execFileSync(
    process.execPath,
    ["-e", `process.stdout.write("x".repeat(${bytes}))`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer },
  );
}

describe("the measured exposure is real today — otherwise every arm below proves nothing", () => {
  it("both worst-case pages are already past the default that was in place", () => {
    /* Verify the instrument before believing its finding (working law 2). If
       either of these ever drops under the default, the card's premise has
       changed and the negative arm would pass for the wrong reason. */
    expect(WORST_CASE_CARD_PAGE_BYTES).toBeGreaterThan(NODE_DEFAULT_MAX_BUFFER);
    expect(WORST_CASE_PR_PAGE_BYTES).toBeGreaterThan(NODE_DEFAULT_MAX_BUFFER);
  });

  it("the shipped figure clears both, so it is a decision and not a guess", () => {
    expect(
      GH_READ_MAX_BUFFER,
      "GH_READ_MAX_BUFFER no longer clears the largest page the live board can "
        + "produce. Raise it where it is declared rather than adding a number at "
        + "a call site — the four readings that capture card bodies swallow an "
        + "overflow into an empty board.",
    ).toBeGreaterThan(WORST_CASE_CARD_PAGE_BYTES);
    expect(GH_READ_MAX_BUFFER).toBeGreaterThan(WORST_CASE_PR_PAGE_BYTES);
  });
});

describe("the buffer against a real payload (#1870)", () => {
  it("NEGATIVE — the default that broke it still throws, and says so by the BUFFER", () => {
    let thrown: NodeJS.ErrnoException | null = null;
    try {
      readChildOutput(WORST_CASE_CARD_PAGE_BYTES, NODE_DEFAULT_MAX_BUFFER);
    } catch (error) {
      thrown = error as NodeJS.ErrnoException;
    }
    expect(
      thrown,
      "A worst-case card page read at node's 1 MiB default did NOT throw. That "
        + "is the defect's own premise failing, so the positive arm below proves "
        + "nothing: re-measure before trusting either.",
    ).not.toBeNull();
    /* `ENOBUFS` is the stable fact and the code `#1867`'s reader keys on too.
       The MESSAGE is platform-worded — Windows answers `spawnSync <exe>
       ENOBUFS` and says nothing about a buffer size — which is itself why an
       overflow reads as some other failure to whatever catches it. */
    expect(thrown?.code).toBe("ENOBUFS");
  });

  it("POSITIVE — the shipped figure reads the same bytes whole", () => {
    const out = readChildOutput(WORST_CASE_CARD_PAGE_BYTES, GH_READ_MAX_BUFFER);
    expect(out.length).toBe(WORST_CASE_CARD_PAGE_BYTES);
  });

  it("a page of PR bodies reads whole too — the fourth reading's own size", () => {
    const out = readChildOutput(WORST_CASE_PR_PAGE_BYTES, GH_READ_MAX_BUFFER);
    expect(out.length).toBe(WORST_CASE_PR_PAGE_BYTES);
  });
});

describe("ghReadMaxBuffer — one owner for the decision, and the option still wins", () => {
  it("nothing passed → the declared figure, so no call site can forget it", () => {
    expect(ghReadMaxBuffer()).toBe(GH_READ_MAX_BUFFER);
    expect(ghReadMaxBuffer({})).toBe(GH_READ_MAX_BUFFER);
    expect(ghReadMaxBuffer(undefined)).toBe(GH_READ_MAX_BUFFER);
  });

  it("⚠ an explicit figure WINS — `crewQueueCount.mts` already passes a larger one", () => {
    /* If the default ever swallowed the option, the reading at
       `crewQueueCount.mts:318` would silently drop from 64 MiB to the default.
       That is the half of this card that a one-token fix would have missed. */
    expect(ghReadMaxBuffer({ maxBuffer: 64 * 1024 * 1024 })).toBe(64 * 1024 * 1024);
    expect(ghReadMaxBuffer({ maxBuffer: NODE_DEFAULT_MAX_BUFFER })).toBe(NODE_DEFAULT_MAX_BUFFER);
  });
});

/** A fake `gh` recording the options it was handed, so no road needs a network. */
function recordingGh(replies: Array<string | Error>): {
  exec: GhExec;
  seen: Array<{ readonly maxBuffer?: number } | undefined>;
} {
  const seen: Array<{ readonly maxBuffer?: number } | undefined> = [];
  let index = 0;
  const exec: GhExec = (_args, options) => {
    seen.push(options);
    const reply = replies[index];
    index += 1;
    if (reply instanceof Error) throw reply;
    if (reply === undefined) throw new Error("fake gh: no reply queued");
    return reply;
  };
  return { exec, seen };
}

const OPEN_BAND_WITH_BODIES = [
  "issue", "list",
  "--label", "founder-ordered",
  "--state", "open",
  "--limit", "200",
  "--json", "number,title,labels,body,createdAt",
];

describe("the transport forwards the option it declares — on BOTH roads", () => {
  it("the REST road hands the caller's buffer to the exec beneath it", () => {
    const { exec, seen } = recordingGh([JSON.stringify({ number: 1, title: "x", body: "y" })]);
    const transport = makeGhTransport({ exec, note: () => {} });
    transport.run(OPEN_BAND_WITH_BODIES, { maxBuffer: GH_READ_MAX_BUFFER });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.maxBuffer).toBe(GH_READ_MAX_BUFFER);
  });

  it("⚠ the GraphQL FALLBACK forwards it too — the road a rate limit forces", () => {
    /* #1399's road. A buffer honoured on the fast path and dropped on the
       fallback is a defect that only appears while GitHub's burst limiter is
       refusing, which is the worst possible moment to discover it. */
    const { exec, seen } = recordingGh([
      new Error("gh: API rate limit exceeded"),
      JSON.stringify([{ number: 1, title: "x", body: "y" }]),
    ]);
    const transport = makeGhTransport({ exec, note: () => {} });
    transport.run(OPEN_BAND_WITH_BODIES, { maxBuffer: GH_READ_MAX_BUFFER });
    expect(seen).toHaveLength(2);
    expect(seen[1]?.maxBuffer).toBe(GH_READ_MAX_BUFFER);
  });

  it("a command it does not translate passes the buffer straight through", () => {
    const { exec, seen } = recordingGh([JSON.stringify({ state: "OPEN" })]);
    const transport = makeGhTransport({ exec, note: () => {} });
    transport.run(["issue", "view", "1870", "--json", "state"], { maxBuffer: GH_READ_MAX_BUFFER });
    expect(seen[0]?.maxBuffer).toBe(GH_READ_MAX_BUFFER);
  });
});

/*
  THE FIVE READINGS, HELD AT THE BYTES.

  ⚠ **EACH ARM IS SLICED TO ITS OWN SUBJECT AND THE ANCHOR'S UNIQUENESS IS
  ASSERTED.** A whole-file `toContain` is satisfied by an identical line in a
  neighbouring function, and three of these files now carry several `maxBuffer`
  spellings — so a file-wide read would have gone green on the wrong one.
  Comments are stripped first, because this card's own docblocks say the word
  `maxBuffer` repeatedly and a guard that reads its own prose proves nothing.
*/
const READINGS: ReadonlyArray<{
  readonly what: string;
  readonly file: string;
  readonly anchor: string;
  readonly window: number;
}> = [
  {
    what: "the desk sweep's gh reader",
    file: "scripts/crew-desk-sweep.mts",
    anchor: "const RAW_GH",
    window: 260,
  },
  {
    what: "the escalation gate's gh reader",
    file: "scripts/next-up-escalation.mts",
    anchor: "const RAW_GH",
    window: 260,
  },
  {
    what: "the switch panel's gh reader",
    file: "scripts/lib/crewQueueCount.mts",
    anchor: "const RAW_GH",
    window: 300,
  },
  {
    what: "the seat cut's open-card page",
    file: "scripts/cut-seat-batches.mts",
    anchor: "number,title,body,labels,createdAt",
    window: 400,
  },
  {
    what: "the claim warning's open-PR page",
    file: "scripts/lib/cardClaimWarning.mts",
    anchor: "[...OPEN_PR_LIST_ARGS]",
    window: 400,
  },
];

describe("every reading that captures a page of bodies carries a buffer (#1870)", () => {
  for (const reading of READINGS) {
    it(`${reading.what} — ${reading.file}`, () => {
      const raw = readListedSource(resolve(ROOT, reading.file));
      expect(raw, `${reading.file} is gone. It is this card's subject.`).not.toBeNull();
      const code = withoutComments(raw as string);

      const first = code.indexOf(reading.anchor);
      expect(
        first,
        `The anchor is not in ${reading.file} any more, so this arm is reading `
          + "nothing. Re-anchor it on the reading rather than deleting it.",
      ).toBeGreaterThanOrEqual(0);
      expect(
        code.indexOf(reading.anchor, first + 1),
        `The anchor appears more than once in ${reading.file}, so the slice below `
          + "could be satisfied by a neighbouring call. Pick a unique anchor.",
      ).toBe(-1);

      const slice = code.slice(first, first + reading.window);
      expect(
        /maxBuffer/.test(slice),
        `This reading captures a page of bodies with no maxBuffer, so an overflow `
          + "throws into its catch and reads as an empty board rather than an "
          + "unread one. Pass ghReadMaxBuffer(options) or GH_READ_MAX_BUFFER.",
      ).toBe(true);
    });
  }

  it("⚠ the figure is imported, never retyped — one declared number (working law 4)", () => {
    /* `32 * 1024 * 1024` already appears at 54 call sites in this tree. The
       point of the card's item 2 is that these five do not add a 55th. */
    for (const reading of READINGS) {
      const raw = readListedSource(resolve(ROOT, reading.file));
      const code = withoutComments(raw as string);
      const first = code.indexOf(reading.anchor);
      const slice = code.slice(first, first + reading.window);
      expect(
        /ghReadMaxBuffer|GH_READ_MAX_BUFFER/.test(slice),
        `${reading.file} carries a buffer that is not the declared one. The `
          + "figure lives in scripts/lib/ghQueueTransport.mts so that raising it "
          + "is one edit rather than five.",
      ).toBe(true);
    }
  });
});
