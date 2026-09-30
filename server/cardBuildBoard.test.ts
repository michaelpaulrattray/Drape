import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

import {
  CARD_COMMENT_WINDOW_HOURS,
  NOT_BUILT_LIST_LIMIT,
  buildBoard,
  cardCommentArgs,
  cardCommentsVerdict,
  commentsUnreadableLines,
  factsFromRows,
  notBuiltArgs,
  notBuiltVerdict,
  readCardComments,
  readCardCommentsWith,
  readNotBuiltCardsWith,
  readOpenPullRequestsWith,
} from "../scripts/lib/cardBuildState.mts";
import { CARD_ACTIVITY_BOOT_HOURS, CARD_ACTIVITY_PAGE } from "./crew/cardActivity";

/* ⚠ IN THE #548 POPULATION ONE HOP OUT, AND CORRECTLY SO. Every arm here hands
   the reader a FAKE transport and nothing in this file spawns anything — but the
   module it imports holds `execFileSync` in its real reader, which is the hop the
   deriver resolves, and an arm added later that forgot the fake would spawn for
   real inside vitest's 5 s default. `server/crewQueueCountEmptyRead.test.ts`
   carries the same declaration for the same reason. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE ONE BOARD EVERY QUEUE READER CONSULTS, DRIVEN (#1094 piece 2).
 *
 * # ⚠ THIS SUITE EXISTS BECAUSE A SABOTAGE SURVIVED
 *
 * The first shape of piece 2 shipped `cardCommentsVerdict` — the `null` →
 * UNREADABLE mapping — with arms only on the RENDERERS, which are handed an
 * `{ unreadable }` value directly. So sabotage 7 of the run, *a failed comment
 * read renders as a quiet board*, came back **green**: the mapping that the whole
 * file exists to get right had no arm at all, while its sibling
 * `openPullRequestsVerdict` has had one since #1094 slice 1
 * (`server/crewShiftCardClaim.test.ts`). A judgement moved out of a script so it
 * could be driven, and then not driven, is the shape this repository keeps a
 * memory file about.
 *
 * So: the three outcomes of each read, the board's behaviour when a half is
 * missing, and what is SENT on the wire (working law 5 — asserted on the outgoing
 * arguments, never on a constant near them).
 */

let dir = "";
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), "card-build-board-")); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

function fixture(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, body, "utf8");
  return path;
}

const COMMENT_ROW = {
  issue_url: "https://api.github.com/repos/michaelpaulrattray/Drape/issues/1094",
  user: { login: "michaelpaulrattray" },
  created_at: "2026-09-26T02:15:15Z",
  body: "CLAIMED — seat-desk-2, 2026-09-26T02:15:15Z\n",
};

describe("the three outcomes of the comment read", () => {
  it("⚠ a FAILED read is UNREADABLE and never an empty list", () => {
    const verdict = cardCommentsVerdict(null, true) as { unreadable: string };
    expect(verdict.unreadable).toContain("issues/comments");
    expect(verdict.unreadable).toContain("could not be read");
  });

  it("⚠ `--no-network` is its OWN reason — a read nobody took is not a read that found nothing", () => {
    const skipped = cardCommentsVerdict(null, false) as { unreadable: string };
    expect(skipped.unreadable).toContain("--no-network");
    expect(skipped.unreadable).not.toContain("could not be read");
    /* And a skipped read is not reported as a failed one, which is the whole
       reason the two are kept apart. */
    expect(skipped.unreadable).not.toEqual((cardCommentsVerdict(null, true) as { unreadable: string }).unreadable);
  });

  it("POSITIVE CONTROL — a read that landed comes back as the facts, including an empty one", () => {
    const facts = factsFromRows([COMMENT_ROW]);
    expect(cardCommentsVerdict(facts, true)).toBe(facts);
    expect(cardCommentsVerdict([], true)).toEqual([]);
  });

  it("the fixture road: a readable file is facts, and an unreadable one is `null`", () => {
    const path = fixture("comments.json", JSON.stringify([COMMENT_ROW]));
    expect(readCardComments(path)).toEqual([
      { kind: "claim", card: 1094, seat: "seat-desk-2", at: "2026-09-26T02:15:15Z" },
    ]);
    expect(readCardComments(join(dir, "absent.json"))).toBeNull();
    expect(readCardComments(fixture("bad.json", "{not json"))).toBeNull();
    /* An object where a list belongs is unreadable, not an empty board. */
    expect(readCardComments(fixture("object.json", '{"body":"x"}'))).toBeNull();
  });
});

describe("what is SENT on the wire (working law 5)", () => {
  it("the request names the repository through `gh api`'s own placeholders", () => {
    const [verb, path] = cardCommentArgs("2026-09-24T03:00:00Z", 2);
    expect(verb).toBe("api");
    expect(path).toContain("repos/{owner}/{repo}/issues/comments");
    expect(path).toContain("since=2026-09-24T03:00:00Z");
    expect(path).toContain(`per_page=${CARD_ACTIVITY_PAGE}`);
    expect(path).toContain("page=2");
    /* ⚠ NOT A LITERAL REPOSITORY NAME: a script that named one would read the
       wrong board when run against another clone. */
    expect(path).not.toContain("michaelpaulrattray");
  });

  it("the window is DERIVED from his page's reader, never typed twice", () => {
    expect(CARD_COMMENT_WINDOW_HOURS).toBe(CARD_ACTIVITY_BOOT_HOURS);
  });

  it("⚠ it pages until a SHORT page, and stops — the reads are asserted, not assumed", () => {
    const sent: string[][] = [];
    const full = Array.from({ length: CARD_ACTIVITY_PAGE }, () => COMMENT_ROW);
    const facts = readCardCommentsWith((args) => {
      sent.push(args);
      return JSON.stringify(sent.length === 1 ? full : [COMMENT_ROW]);
    });
    expect(sent).toHaveLength(2);
    expect(sent[1]![1]).toContain("page=2");
    /* The rows collapse to one fact per (card, kind) at the judgement, not here —
       this reader hands back what it read. */
    expect(facts).toHaveLength(CARD_ACTIVITY_PAGE + 1);
  });

  it("a transport that throws, or answers with an object, is `null`", () => {
    expect(readCardCommentsWith(() => { throw new Error("gh: not authenticated"); })).toBeNull();
    expect(readCardCommentsWith(() => '{"not":"a list"}')).toBeNull();
    expect(readOpenPullRequestsWith(() => { throw new Error("gh: not authenticated"); })).toBeNull();
    expect(readOpenPullRequestsWith(() => "[]")).toEqual([]);
  });

  it("⚠ the injected pull-request read spends the SHARED field list", () => {
    /* The branch limb of the matcher, the review stage and the verdict clock each
       depend on a field being asked for. A second list typed for the injected
       caller is the mirror that silently answers a weaker question. */
    let sent: string[] = [];
    readOpenPullRequestsWith((args) => { sent = args; return "[]"; });
    const fields = sent[sent.indexOf("--json") + 1] ?? "";
    for (const field of ["number", "title", "body", "headRefName", "labels", "updatedAt"]) {
      expect(fields, `the injected read no longer asks for \`${field}\``).toContain(field);
    }
  });
});

describe("the board itself", () => {
  const pr = {
    number: 1316,
    title: "build(typecheck): the population",
    body: "Opened for card #1231.",
    headRefName: "team/scripts-1231",
    isDraft: false,
  };
  const NOW = Date.parse("2026-09-26T03:00:00Z");
  /** No card is refused — every arm that is not about #1337 says so explicitly. */
  const NONE: ReadonlySet<number> = new Set<number>();

  it("answers the phrase, the state and the offer verdict from one reading", () => {
    const board = buildBoard({ openPullRequests: [pr], comments: [], notBuilt: NONE, nowMs: NOW });
    expect(board.stateFor(1231)).toEqual({ kind: "pull-request", pullRequest: 1316, stage: "gate" });
    expect(board.phraseFor(1231)).toBe("being built — PR #1316");
    expect(board.holdsOffOffer(1231)).toBe(true);
    expect(board.phraseFor(999)).toBeNull();
    expect(board.holdsOffOffer(999)).toBe(false);
    expect(board.partial).toBe(false);
    expect(board.unreadable).toEqual([]);
  });

  it("reads a `gh pr list` label row, which is an object and not a string", () => {
    const board = buildBoard({
      openPullRequests: [{ ...pr, labels: [{ name: "needs-fable" }] }],
      comments: [],
      notBuilt: NONE,
      nowMs: NOW,
    });
    expect(board.phraseFor(1231)).toBe("waiting on review — PR #1316");
  });

  it("and a fresh verdict on the same pull request passes it", () => {
    const board = buildBoard({
      openPullRequests: [{ ...pr, labels: [{ name: "needs-fable" }], updatedAt: "2026-09-26T02:30:00Z" }],
      comments: [{ kind: "verdict", card: 1316, at: "2026-09-26T02:30:00Z" }],
      notBuilt: NONE,
      nowMs: NOW,
    });
    expect(board.phraseFor(1231)).toBe("passed and merging — PR #1316");
  });

  it("⚠ AN UNREADABLE HALF NEVER WITHHOLDS A CARD, and it says why", () => {
    /* A `gh` hiccup must not empty a shift's queue — the opposite failure to the
       escalation gate's, and both are written down in the module's header. */
    const board = buildBoard({
      openPullRequests: { unreadable: "`gh pr list` could not be read" },
      comments: { unreadable: "`gh api` could not be read" },
      notBuilt: { unreadable: "`gh issue list --label not-built` could not be read" },
      nowMs: NOW,
    });
    expect(board.holdsOffOffer(1231)).toBe(false);
    expect(board.phraseFor(1231)).toBeNull();
    expect(board.partial).toBe(true);
    expect(board.unreadable).toHaveLength(3);
    expect(board.unreadable[0]).toContain("the open pull requests:");
    expect(board.unreadable[1]).toContain("the claims and refusals:");
    expect(board.unreadable[2]).toContain("the refused cards:");
  });

  it("one half unreadable still answers from the other", () => {
    const board = buildBoard({
      openPullRequests: { unreadable: "offline" },
      comments: [{ kind: "claim", card: 1231, seat: "seat-x", at: "2026-09-26T02:30:00Z" }],
      notBuilt: NONE,
      nowMs: NOW,
    });
    expect(board.phraseFor(1231)).toBe("claimed by seat-x, under an hour ago");
    expect(board.holdsOffOffer(1231)).toBe(true);
    expect(board.unreadable).toHaveLength(1);
  });

  it("the unreadable sentence is printed only when it is true, and indents as asked", () => {
    expect(commentsUnreadableLines([])).toEqual([]);
    const lines = commentsUnreadableLines({ unreadable: "offline" }, "  ");
    expect(lines[0]).toBe("  ⚠ THE CLAIMS AND REFUSALS COULD NOT BE READ, so a card above may look FREE while a");
    expect(lines.join("\n")).toContain("offline");
    expect(commentsUnreadableLines({ unreadable: "offline" }, "")[0]).not.toMatch(/^ /);
  });

  /**
   * THE REFUSAL LABEL, THROUGH THE BOARD (#1337).
   *
   * The judgement's own arms are in `server/crewCardBuildState.test.ts`; these
   * are about the BOARD carrying the third read — the half that was made
   * REQUIRED so no caller could forget it, and the half whose failure must cost
   * a phrase and nothing else.
   */
  it("⚠ a card carrying `not-built` reads refused with NOTHING else on it", () => {
    const board = buildBoard({
      openPullRequests: [],
      comments: [],
      notBuilt: new Set([1217]),
      nowMs: NOW,
    });
    expect(board.stateFor(1217)).toEqual({ kind: "refused", at: null });
    expect(board.phraseFor(1217)).toBe("not built — the reason is on the card");
    /* HIS RULING WAS A AND NOT B: the card is annotated and still offered. */
    expect(board.holdsOffOffer(1217)).toBe(false);
    expect(board.partial).toBe(false);
    /* The control that matters: a neighbouring card is untouched by it. */
    expect(board.phraseFor(1218)).toBeNull();
  });

  it("⚠ AN UNREADABLE LABEL LIST COSTS A PHRASE AND NEVER A CARD", () => {
    const board = buildBoard({
      openPullRequests: [],
      comments: [],
      notBuilt: { unreadable: "`gh issue list --label not-built` could not be read" },
      nowMs: NOW,
    });
    expect(board.phraseFor(1217)).toBeNull();
    expect(board.holdsOffOffer(1217)).toBe(false);
    expect(board.partial).toBe(true);
    expect(board.unreadable).toEqual([
      "the refused cards: `gh issue list --label not-built` could not be read",
    ]);
  });

  it("the refusal line is its own sentence, and names the label", () => {
    expect(commentsUnreadableLines([], "  ", new Set<number>())).toEqual([]);
    const lines = commentsUnreadableLines([], "", { unreadable: "offline" });
    expect(lines[0])
      .toBe("⚠ THE REFUSED CARDS COULD NOT BE READ, so a card a shift already read and refused");
    expect(lines.join("\n")).toContain("`not-built` label");
    /* Both halves failing prints both, from ONE call — which is why the second
       is a parameter here rather than a sibling function somebody forgets. */
    expect(commentsUnreadableLines({ unreadable: "a" }, "", { unreadable: "b" })).toHaveLength(6);
  });

  it("⚠ THE CALL IS ASSERTED AT THE WIRE, and it asks for the labels it reads", () => {
    /* Working law 5: the contract is the outgoing argument list, never a constant
       near it. `--json number,labels` matters — the read re-derives the set
       through `notBuiltCards` rather than trusting the server-side filter. */
    expect(notBuiltArgs()).toEqual([
      "issue", "list",
      "--label", "not-built",
      "--state", "all",
      "--limit", String(NOT_BUILT_LIST_LIMIT),
      "--json", "number,labels",
    ]);
  });

  it("⚠ A FULL PAGE IS A READ THAT FAILED, not a short list", () => {
    const rows = Array.from({ length: NOT_BUILT_LIST_LIMIT }, (_unused, index) => ({
      number: index + 1,
      labels: [{ name: "not-built" }],
    }));
    expect(readNotBuiltCardsWith(() => JSON.stringify(rows))).toBeNull();
    /* One row under the limit is a real answer — the positive control, without
       which the arm above would pass against a reader that always answers null. */
    expect(readNotBuiltCardsWith(() => JSON.stringify(rows.slice(0, NOT_BUILT_LIST_LIMIT - 1)))?.size)
      .toBe(NOT_BUILT_LIST_LIMIT - 1);
  });

  it("the read answers null on what it cannot parse, and reads the label off the row", () => {
    expect(readNotBuiltCardsWith(() => "not json")).toBeNull();
    expect(readNotBuiltCardsWith(() => "{}")).toBeNull();
    expect(readNotBuiltCardsWith(() => { throw new Error("gh is not on PATH"); })).toBeNull();
    /* A row WITHOUT the label is not counted even though the filter asked for it,
       and a card number of 0 is not a card. */
    expect([...(readNotBuiltCardsWith(() => JSON.stringify([
      { number: 1217, labels: [{ name: "not-built" }, { name: "seat:janitor" }] },
      { number: 1218, labels: [{ name: "seat:janitor" }] },
      { number: 0, labels: [{ name: "not-built" }] },
    ])) ?? [])]).toEqual([1217]);
  });

  it("the three answers stay apart — skipped, failed, and nothing refused", () => {
    expect(notBuiltVerdict(new Set<number>(), false)).toEqual({
      unreadable: "--no-network was passed; the refused cards were NOT read",
    });
    const failed = notBuiltVerdict(null, true);
    expect(failed).toHaveProperty("unreadable");
    expect((failed as { unreadable: string }).unreadable).toContain("not-built");
    expect(notBuiltVerdict(new Set<number>(), true)).toEqual(new Set());
  });
});
