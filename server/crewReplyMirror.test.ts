/**
 * THE REPLY MIRROR, DRIVEN — his Desk reply reaching its GitHub card (#1539).
 *
 * Two halves and they fail for different reasons, so they are driven
 * separately: the rules (`shared/crewReplyMirror.ts`) are total functions and
 * take fixtures; the sweep (`scripts/lib/replyMirrorSweep.mts`) takes an
 * INJECTED GitHub, so the arms can be unkind to it in ways a real one cannot
 * be asked to be on demand — a post that throws, a crash between posting and
 * recording, a card that will never accept a comment.
 *
 * # ⚠ THE NEGATIVE CONTROLS ARE THE POINT, AND EACH IS NAMED WHERE IT SITS
 *
 * Working law 2: a checker that cannot fail proves nothing. Three arms here
 * exist only to fail under a plausible wrong implementation and are marked
 * `NEGATIVE CONTROL` at their own line — the prefix-marker arm (a substring
 * reader would call reply 236 mirrored the moment reply 23 was), the
 * verbatim-body arm (a blockquote renders beautifully and edits every line of
 * what he wrote), and the wedge arm (a sweep that retried forever would
 * silence every reply behind one dead card).
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  crewReplyAuthorLabel,
  crewReplyIsMirrored,
  crewReplyMirrorComment,
  crewReplyMirrorMarker,
  crewReplyMirrorTarget,
} from "../shared/crewReplyMirror";
import {
  emptyMirrorState,
  sweepReplyMirror,
  type MirrorState,
  type SweepIo,
  type SweepReply,
} from "../scripts/lib/replyMirrorSweep.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";

/* One arm spawns the real CLI to drive its world gate, so this suite declares
   the child-process class timeout (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/** A spawning suite declares its own ceiling (the contended-timeout guard). */
const CONTENDED_TEST_TIMEOUT_MS = 30_000;

/** The briefing index as the sweep takes it: card slug → its issue, or null. */
const briefing = (entries: Record<string, number | null>): ReadonlyMap<string, number | null> =>
  new Map(Object.entries(entries));

const reply = (over: Partial<SweepReply> = {}): SweepReply => ({
  id: 241,
  cardId: "card-1337",
  body: "A",
  sentAtUtc: "2026-09-30 01:02:03Z",
  author: "Michael",
  ...over,
});

/** A GitHub that remembers what it was told, and can be told to refuse. */
function fakeGitHub(options: { failPost?: (issueNumber: number) => string | null } = {}) {
  const comments = new Map<number, string[]>();
  const posts: { issueNumber: number; body: string }[] = [];
  const io: SweepIo = {
    readComments: async (issueNumber) => comments.get(issueNumber) ?? [],
    postComment: async (issueNumber, body) => {
      const refusal = options.failPost?.(issueNumber) ?? null;
      if (refusal) throw new Error(refusal);
      posts.push({ issueNumber, body });
      comments.set(issueNumber, [...(comments.get(issueNumber) ?? []), body]);
    },
    now: () => "2026-09-30T02:00:00.000Z",
  };
  return { io, posts, comments };
}

describe("which card a reply is addressed to", () => {
  it("reads the number straight off a bare live-desk row, consulting no briefing", () => {
    /* The shape his answers actually arrive on — four for four on the #1539
       specimen — and it must resolve with an EMPTY briefing, because none of
       those four was in one. */
    expect(crewReplyMirrorTarget("card-1337", briefing({}))).toEqual({
      kind: "issue", issueNumber: 1337, via: "bare",
    });
  });

  it("resolves an edition card through the briefing's own issue number", () => {
    expect(crewReplyMirrorTarget("sign-version-1478", briefing({ "sign-version-1478": 1478 }))).toEqual({
      kind: "issue", issueNumber: 1478, via: "briefing",
    });
  });

  it("skips a General note, which names no card by definition", () => {
    const target = crewReplyMirrorTarget(null, briefing({}));
    expect(target.kind).toBe("skip");
    expect(target).toMatchObject({ reason: expect.stringContaining("General note") });
  });

  it("skips a slug the deployed briefing no longer holds rather than guessing a number", () => {
    /* The briefing ROTATES — that is why `cardId` is bounded and validated for
       nothing else. A guess here puts his words on somebody else's card. */
    const target = crewReplyMirrorTarget("retired-card-99", briefing({ "other-card-1": 1 }));
    expect(target.kind).toBe("skip");
    expect(target).toMatchObject({ reason: expect.stringContaining("not in the deployed briefing") });
  });

  it("skips a briefing row whose issue number is null — 10 of edition 580's 143 are", () => {
    const target = crewReplyMirrorTarget("switch-00-how-to-read", briefing({ "switch-00-how-to-read": null }));
    expect(target.kind).toBe("skip");
    expect(target).toMatchObject({ reason: expect.stringContaining("no issue number") });
  });

  it("refuses card-0 and anything after `card-` that is not all digits", () => {
    expect(crewReplyMirrorTarget("card-0", briefing({})).kind).toBe("skip");
    /* Not a bare row at all, so it falls through to the briefing and is absent
       there — never parsed as issue 12. */
    expect(crewReplyMirrorTarget("card-12ab", briefing({})).kind).toBe("skip");
  });
});

describe("the marker, which is the real idempotency guard", () => {
  it("finds its own reply", () => {
    expect(crewReplyIsMirrored(["noise", crewReplyMirrorMarker(236)], 236)).toBe(true);
  });

  it("NEGATIVE CONTROL — reply 23's marker does not satisfy reply 236", () => {
    /* `:23` is a prefix of `:236`. A reader that matched prefixes would skip
       reply 236 forever the moment reply 23 was mirrored, and his answer would
       simply never appear. The marker's trailing ` -->` is what closes it. */
    expect(crewReplyIsMirrored([crewReplyMirrorMarker(23)], 236)).toBe(false);
    expect(crewReplyIsMirrored([crewReplyMirrorMarker(2360)], 236)).toBe(false);
  });

  it("is an HTML comment, so it renders to nothing on the card", () => {
    expect(crewReplyMirrorMarker(1)).toMatch(/^<!--.*-->$/);
  });
});

describe("the comment", () => {
  const body = "yes.\n\n- do the first one\n- not the second\n\n> and quote this back to me";

  it("NEGATIVE CONTROL — his body is byte-identical, so no blockquote or re-wrap can hide here", () => {
    /* The card: *the body verbatim and entire, nothing added*. Prefixing every
       line with `> ` reads beautifully on GitHub and breaks this assertion,
       which is the whole reason it is written as a substring of the raw body
       rather than as a rendering check. */
    const comment = crewReplyMirrorComment({ id: 236, body, sentAtUtc: "2026-09-29 10:24:11Z", author: "Michael" });
    expect(comment).toContain(body);
  });

  it("is a header, his words and the marker — in that order and nothing else", () => {
    const comment = crewReplyMirrorComment({ id: 236, body, sentAtUtc: "2026-09-29 10:24:11Z", author: "Michael" });
    expect(comment).toBe(
      `**Michael — Desk reply #236 (2026-09-29 10:24:11Z):**\n\n${body}\n\n${crewReplyMirrorMarker(236)}`,
    );
  });

  it("names him, then his account name, then the crew — and treats blank as absent", () => {
    expect(crewReplyAuthorLabel({ displayName: "Michael", name: "mpr" })).toBe("Michael");
    expect(crewReplyAuthorLabel({ displayName: "   ", name: "mpr" })).toBe("mpr");
    expect(crewReplyAuthorLabel({ displayName: null, name: null })).toBe("a member of the crew");
  });
});

describe("one sweep", () => {
  it("posts a new reply once and moves the waterline to it", async () => {
    const gh = fakeGitHub();
    const result = await sweepReplyMirror([reply({ id: 241 })], briefing({}), emptyMirrorState(), gh.io);

    expect(gh.posts).toHaveLength(1);
    expect(gh.posts[0].issueNumber).toBe(1337);
    expect(gh.posts[0].body).toContain(crewReplyMirrorMarker(241));
    expect(result.state.lastMirroredId).toBe(241);
    expect(result.outcomes.map((o) => o.kind)).toEqual(["posted"]);
  });

  it("posts once under retry — the waterline stops the second pass", async () => {
    const gh = fakeGitHub();
    const rows = [reply({ id: 241 })];
    const first = await sweepReplyMirror(rows, briefing({}), emptyMirrorState(), gh.io);
    await sweepReplyMirror(rows, briefing({}), first.state, gh.io);
    expect(gh.posts).toHaveLength(1);
  });

  it("posts once under retry even when the state was LOST — the marker catches it", async () => {
    /* The crash-between-post-and-record case, which is the only one the state
       file cannot answer and the only reason the comment read is worth its
       API call. Same rows, same empty state, twice. */
    const gh = fakeGitHub();
    const rows = [reply({ id: 241 })];
    await sweepReplyMirror(rows, briefing({}), emptyMirrorState(), gh.io);
    const second = await sweepReplyMirror(rows, briefing({}), emptyMirrorState(), gh.io);

    expect(gh.posts).toHaveLength(1);
    expect(second.outcomes.map((o) => o.kind)).toEqual(["already"]);
    expect(second.state.lastMirroredId).toBe(241);
  });

  it("stops at a failing reply and leaves the waterline behind it, so order is kept", async () => {
    const gh = fakeGitHub({ failPost: (issue) => (issue === 1337 ? "gh: 503" : null) });
    const result = await sweepReplyMirror(
      [reply({ id: 241, cardId: "card-1337" }), reply({ id: 242, cardId: "card-1400" })],
      briefing({}),
      emptyMirrorState(),
      gh.io,
    );

    expect(gh.posts).toHaveLength(0);
    expect(result.stoppedAt).toBe(241);
    expect(result.state.lastMirroredId).toBe(0);
    expect(result.state.attempts["241"]).toBe(1);
    expect(result.outcomes.map((o) => o.kind)).toEqual(["retry"]);
  });

  it("NEGATIVE CONTROL — a dead card is abandoned rather than allowed to wedge the queue", async () => {
    /* A sweep that retried forever would be simpler and would silence every
       reply behind one deleted issue. Two attempts here, so the second is the
       last; the later reply must get through on that same pass. */
    const gh = fakeGitHub({ failPost: (issue) => (issue === 1337 ? "gh: Could not resolve to an Issue" : null) });
    const rows = [reply({ id: 241, cardId: "card-1337" }), reply({ id: 242, cardId: "card-1400" })];

    const first = await sweepReplyMirror(rows, briefing({}), emptyMirrorState(), gh.io, 2);
    expect(first.state.lastMirroredId).toBe(0);

    const second = await sweepReplyMirror(rows, briefing({}), first.state, gh.io, 2);
    expect(second.outcomes.map((o) => o.kind)).toEqual(["abandoned", "posted"]);
    expect(second.state.abandoned).toHaveLength(1);
    expect(second.state.abandoned[0]).toMatchObject({ replyId: 241, issueNumber: 1337, attempts: 2 });
    expect(second.state.lastMirroredId).toBe(242);
    expect(gh.posts.map((p) => p.issueNumber)).toEqual([1400]);
  });

  it("advances past a reply it will never mirror, and never posts it anywhere", async () => {
    const gh = fakeGitHub();
    const result = await sweepReplyMirror(
      [reply({ id: 241, cardId: null }), reply({ id: 242, cardId: "gone-99" })],
      briefing({}),
      emptyMirrorState(),
      gh.io,
    );
    expect(gh.posts).toHaveLength(0);
    expect(result.state.lastMirroredId).toBe(242);
    expect(result.outcomes.map((o) => o.kind)).toEqual(["skipped", "skipped"]);
  });

  it("sorts what it is given and ignores anything already below the waterline", async () => {
    /* The waterline is only correct if the walk is ordered, and a caller's
       ORDER BY is one edit away from being the bug. */
    const gh = fakeGitHub();
    const state: MirrorState = { ...emptyMirrorState(), lastMirroredId: 241 };
    const result = await sweepReplyMirror(
      [reply({ id: 243, cardId: "card-3" }), reply({ id: 241, cardId: "card-1" }), reply({ id: 242, cardId: "card-2" })],
      briefing({}),
      state,
      gh.io,
    );
    expect(gh.posts.map((p) => p.issueNumber)).toEqual([2, 3]);
    expect(result.state.lastMirroredId).toBe(243);
  });

  it("drops failure counters for replies that have since settled", async () => {
    const gh = fakeGitHub();
    const state: MirrorState = { ...emptyMirrorState(), attempts: { "241": 4, "999": 1 } };
    const result = await sweepReplyMirror([reply({ id: 241 })], briefing({}), state, gh.io);
    expect(result.state.attempts).toEqual({ "999": 1 });
  });
});

describe("the command's world gate", () => {
  it(
    "REFUSES to post from the dev world, before it opens any connection",
    () => {
      /* Driven at the real script rather than reasoned about: he types on
         production, and `.env`'s DATABASE_URL is dev. The two differ only by
         port, which has produced a wrong reading in this repository before.
         The child gets a state file so the refusal cannot be the missing-state
         one instead. */
      const dir = mkdtempSync(join(tmpdir(), "reply-mirror-"));
      try {
        const env = { ...process.env };
        delete env.MYSQL_PUBLIC_URL;
        delete env.PUBLIC_DATABASE_URL;
        env.DATABASE_URL = "mysql://u:p@127.0.0.1:52008/railway";

        /* Through `runHook`, not a bare `execFileSync` — its own guard walks
           `server/` for suites that read a child's `.status` directly, and it
           is right to: a non-start would otherwise read as a verdict. `shell`
           is what Windows needs for `npx`, and that road's stated caveat is
           satisfied here because the assertion below is an EXACT code. */
        const run = runHook(
          "npx",
          ["tsx", "scripts/crew-mirror-replies.mts", "--state", join(dir, "state.json")],
          { env, shell: true, timeout: 60_000 },
        );

        expect(run.status).toBe(1);
        expect(run.stderr).toContain("REFUSING to post from the dev world");
        /* And it never reached the database: `openDatabase` writes `[db] …` to
           stderr on every connection it opens, so its absence is the proof
           that the gate sits in front of the connection rather than after it. */
        expect(run.stderr).not.toContain("[db] ");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    CONTENDED_TEST_TIMEOUT_MS,
  );
});

describe("the schedule recipe, which is the only road back after a rebuild", () => {
  /* ⚠ THIS IS A GUARD ON A DOCBLOCK, AND IT IS HERE BECAUSE THE DOCBLOCK IS
     LOAD-BEARING RATHER THAN DECORATIVE. The launcher the live task runs lives
     at `.agents/crew-reply-mirror-hidden.vbs`, and `.agents/` is gitignored
     (`.gitignore:161`) — so after a machine rebuild the recipe in
     `crew-mirror-replies.mts` is the ONLY surviving road back.

     It was wrong for a day. His word, 2026-09-30: *"please make the mirror run
     silently its really annoying having a cmd terminal popup on my screen every
     minute"*. The live task was moved onto the hidden launcher by hand that
     night; the written recipe was not, so the one road that survives a rebuild
     still said `-Execute 'cmd.exe'` and would have re-created the popup he had
     just asked to be rid of.

     NO SUITE CAN READ A MACHINE-LOCAL SCHEDULED TASK, so what is held here is
     the half that is in tracked bytes: what the recipe TELLS you to register.
     Read it back at the task itself, which the docblock now says in as many
     words. */
  const source = readFileSync(join(process.cwd(), "scripts/crew-mirror-replies.mts"), "utf8");

  it("registers the task against the hidden launcher, never cmd.exe as the action", () => {
    expect(source).toContain("-Execute 'wscript.exe'");
    /* ⚠ ANCHORED ON THE ACTION, and that is not fussiness: this file contains
       `cmd.exe` twice legitimately — inside the launcher body below, and at
       `process.env.COMSPEC ?? "cmd.exe"` in the code — so a bare
       `not.toContain("cmd.exe")` would be red on a correct file and would have
       been "fixed" by loosening it into something that proves nothing. What is
       forbidden is cmd.exe as the TASK ACTION, because the action is what owns
       the console window. */
    expect(source).not.toMatch(/New-ScheduledTaskAction\s+-Execute\s+'cmd\.exe'/);
  });

  it("carries the launcher's own body, because a gitignored file is lost on rebuild", () => {
    /* Window style 0 is the whole point of the launcher — the recipe is useless
       if it names the file without saying what goes in it. */
    expect(source).toContain('rc = sh.Run("cmd.exe /c cd /d');
    expect(source).toMatch(/--quiet",\s*0,\s*True\)/);
    expect(source).toContain("WScript.Quit rc");
  });
});
