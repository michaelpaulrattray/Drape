/**
 * THE OTHER HALF OF INVARIANT 5 — THE PUBLIC tRPC ALLOWLIST, TIED TO THE CODE.
 *
 * `server/architectureExpressSurfaces.test.ts` does this for the EXPRESS half.
 * It was written on 2026-08-20 because a route existed for weeks that the
 * sentence did not name, and corrected on 2026-08-23 because the guard itself
 * had fallen one route behind the list it keeps. Working law 7 asks what else
 * shares the shape, and the answer was sitting in the same paragraph:
 *
 *   CLAUDE.md, access-control invariant 5:
 *     "The current list (mechanically verified by the Atlas, 2026-07-30 …):
 *      tRPC `system.health`, `auth.me`/`logout`, … — twelve, matching this
 *      list exactly."
 *
 * ⚠ "MECHANICALLY VERIFIED" WAS TRUE OF THE FINDING AND NOT OF THE SENTENCE.
 * The Atlas really does extract every public procedure and emit one
 * `public-endpoint` finding per procedure — that half is mechanical and it is
 * correct. But **nothing consumed those findings**: the only other reference to
 * the string `public-endpoint` in the whole tree was a docblock in
 * `d246VerificationBar.test.ts` citing the allowlist as an idiom. Their severity
 * is `info`, so `pnpm architecture:check` does not fail on them. A thirteenth
 * public procedure would therefore have appeared as one new line in a generated
 * JSON file and reddened nothing at all, while the document went on saying
 * twelve — which is the Express half's incident with the more dangerous
 * category, since a public endpoint is reachable with no session at all.
 *
 * DERIVED ON BOTH SIDES, so neither can move alone (working law 4):
 *
 *   the document   parsed out of CLAUDE.md's own sentence — the names AND the
 *                  count word, which are two independent ways for it to drift
 *   the code       the Atlas's `public-endpoint` findings, regenerated from
 *                  source by `pnpm architecture:generate` and held fresh by
 *                  `architecture:check`, which runs inside `pnpm test`
 *
 * ⚠ AND A THIRD SIDE, WHICH IS THE COUPLING THE EXPRESS ARM DOES NOT HAVE.
 * If the two sides above were all, this arm would inherit the Atlas extractor's
 * blind spots exactly the way the Express list inherited them before 2026-08-20:
 * a procedure shape the generator stops classifying as public vanishes from BOTH
 * the findings and this guard, silently, and the pair still agree. So the last
 * arm re-derives the population straight from the router sources — every
 * `key: publicProcedure` declaration in the tree — and compares it with the
 * Atlas's. Two instruments, one population; the generator can no longer narrow
 * on its own.
 *
 * The parse is proven able to fail before any of its verdicts count (working
 * law 2): a fixture with a thirteenth name must come back thirteen, the
 * `x.y`/`z` shorthand must expand to two ids rather than one, and the backticks
 * elsewhere in the same paragraph (`.strict()`, `pnpm architecture:generate`)
 * must not be swallowed. And the population is asserted NON-EMPTY AND WHOLE
 * before any member claim — a parse that loses a member reads exactly like
 * coverage (`absence-only-expect-passes-on-nothing`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COUNT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
};

/**
 * THE DOCUMENT'S OWN LIST, PARSED — never a copy of it typed here.
 *
 * The sentence writes a namespace once and then leans on it: `auth.me`/`logout`
 * is two procedures, not one, and so is `waitlist.join`/`getStats`. A token
 * carrying a dot sets the namespace and is itself an id; a bare token after one
 * is that namespace's second procedure. Ten backticked tokens, twelve ids.
 */
function statedAllowlist(claudeMd: string): { ids: string[]; count: number } {
  const sentence =
    /reports it as `public-endpoint` findings\): tRPC (.+?) — (\w+), matching this list exactly\./
      .exec(claudeMd);
  if (!sentence) {
    throw new Error(
      "CLAUDE.md's invariant-5 public-tRPC sentence has moved or been reworded — re-point this arm at it rather than deleting it",
    );
  }

  const ids: string[] = [];
  let namespace = "";
  for (const token of sentence[1]!.matchAll(/`([^`]+)`/g)) {
    const name = token[1]!;
    if (name.includes(".")) {
      namespace = name.slice(0, name.indexOf("."));
      ids.push(name);
    } else {
      if (!namespace) throw new Error(`bare procedure "${name}" with no namespace before it`);
      ids.push(`${namespace}.${name}`);
    }
  }

  const count = COUNT_WORDS[sentence[2]!.toLowerCase()];
  if (count === undefined) {
    throw new Error(`CLAUDE.md states an unrecognised count word "${sentence[2]}" for the public allowlist`);
  }
  return { ids: ids.sort(), count };
}

/** The Atlas's own extraction, one finding per public procedure. */
function atlasPublicEndpoints(): string[] {
  const atlas = JSON.parse(
    readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
  ) as { findings: { kind: string; subject: string }[] };
  return atlas.findings
    .filter((finding) => finding.kind === "public-endpoint")
    .map((finding) => finding.subject.replace(/^route:/, ""))
    .sort();
}

/**
 * THE INDEPENDENT DERIVATION — the router sources, not the Atlas.
 *
 * Returns the PROPERTY KEYS rather than callable ids, and that is deliberate
 * rather than lazy: `generation.costs` is declared in
 * `routes/generation/castingExport.ts` and reaches the client with no
 * `castingExport` segment, because the router is merged in by procedure spread.
 * CLAUDE.md carries a whole parenthesis about that. Resolving the spread is the
 * Atlas's job and this arm exists to check the Atlas, so it compares the one
 * thing both instruments can state without doing each other's work.
 *
 * A MULTISET, not a set — `validate` is declared twice (`access`, `referral`)
 * and a set would quietly swallow one of them, which is the whole failure mode
 * this file is about (`prose-join-fails-both-ways`).
 */
function sourcePublicProcedureKeys(): string[] {
  const keys: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      for (const hit of readFileSync(full, "utf8").matchAll(/(\w+):\s*publicProcedure\b/g)) {
        keys.push(hit[1]!);
      }
    }
  };
  walk(path.join(repoRoot, "server"));
  return keys.sort();
}

describe("the parse, proven able to fail", () => {
  const anchor = (list: string, count: string) =>
    `reports it as \`public-endpoint\` findings): tRPC ${list} — ${count}, matching this list exactly.`;

  it("expands the shared-namespace shorthand into two procedures", () => {
    /* NEGATIVE CONTROL for the one place the sentence is not literal. Read
       naively, `auth.me`/`logout` is one id and the list comes out TEN — and a
       parse that loses two members would then have to be rescued by the
       population assert, which is exactly why that assert exists. */
    const { ids } = statedAllowlist(anchor("`auth.me`/`logout`, `waitlist.join`/`getStats`", "four"));
    expect(ids).toEqual(["auth.logout", "auth.me", "waitlist.getStats", "waitlist.join"]);
  });

  it("sees a thirteenth name when one is there", () => {
    /* POSITIVE CONTROL. The failure this file exists to catch is a name being
       ADDED to the code and not to the sentence — so the parse must be able to
       return a bigger list than today's, or its agreement means nothing. */
    const { ids, count } = statedAllowlist(
      anchor("`system.health`, `auth.me`/`logout`, `boards.peek`", "thirteen"),
    );
    expect(ids).toContain("boards.peek");
    expect(ids).toEqual(["auth.logout", "auth.me", "boards.peek", "system.health"]);
    expect(count).toBe(13);
  });

  it("does not swallow backticks from the rest of the invariant", () => {
    /* NOISE CONTROL. The same paragraph is full of backticked tokens —
       `.strict()`, `pnpm architecture:generate`, five Express paths. An anchor
       that over-reached would produce a list nobody could reconcile, and the
       tempting fix would be to loosen the comparison. */
    const paragraph = `Each is rate-limited, \`.strict()\`-validated. ${anchor(
      "`system.health`",
      "one",
    )} Express: \`/api/image-proxy\`, \`/api/cast/:castId/sheet\`.`;
    expect(statedAllowlist(paragraph).ids).toEqual(["system.health"]);
  });

  it("refuses rather than passing when the sentence has moved", () => {
    /* The failure mode a document-reading guard dies of: the prose is rewritten,
       the regex matches nothing, and a lenient parse returns an empty list that
       agrees with nothing and passes. It throws with the instruction instead. */
    expect(() => statedAllowlist("no such sentence here")).toThrow(/has moved or been reworded/);
  });
});

describe("CLAUDE.md's public tRPC allowlist against the code", () => {
  const stated = statedAllowlist(readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8"));

  it("⚠ names exactly the procedures the Atlas finds public — neither side may move alone", () => {
    const found = atlasPublicEndpoints();

    /* THE POPULATION FIRST, both sides. An empty or halved list on either side
       would make the comparison below vacuous, and a vacuous comparison is the
       shape that reads as coverage. */
    expect(stated.ids.length).toBeGreaterThan(8);
    expect(found.length).toBeGreaterThan(8);

    expect(
      found,
      "the set of public tRPC endpoints in the code differs from the set CLAUDE.md's invariant 5 enumerates — adding one is a deliberate decision, so either the endpoint should not be public or the sentence has not been updated",
    ).toEqual(stated.ids);
  });

  it("⚠ and the COUNT the sentence states is tied to the same population", () => {
    /*
      The number and the names are two independent ways for the sentence to
      drift, and the Express half proved it: the 2026-08-20 repair added the
      missing NAMES and left the NUMBER unanswerable, which is how the same list
      went stale a second time. Both are read out of the document here.
    */
    expect(
      stated.count,
      `CLAUDE.md writes out the count of public tRPC endpoints in words as well as listing them; the word and the list disagree (${stated.ids.length} named)`,
    ).toBe(stated.ids.length);
    expect(stated.count).toBe(atlasPublicEndpoints().length);
  });

  it("⚠ the Atlas has not quietly stopped seeing a shape — a SECOND instrument on the same population", () => {
    /*
      THE COUPLING ARM. Everything above compares a document with the Atlas, so
      everything above inherits the Atlas extractor's blind spots. That is not a
      hypothetical here: the Express half of this very invariant was blind to
      factory-mounted routers from the day the house style changed, and reported
      a complete list the whole time.

      So the population is re-derived from the router sources with no help from
      the generator, and compared as a MULTISET of property keys — see
      `sourcePublicProcedureKeys` for why keys and not ids. If the generator
      stops classifying a procedure as public, the two instruments disagree here
      and say so; if a genuinely new public procedure lands, it fails the arms
      above as well, which is the whole point.
    */
    const fromSource = sourcePublicProcedureKeys();
    const fromAtlas = atlasPublicEndpoints()
      .map((id) => id.slice(id.lastIndexOf(".") + 1))
      .sort();

    expect(fromSource.length).toBeGreaterThan(8);
    expect(
      fromAtlas,
      "the Atlas's public-endpoint findings and the `publicProcedure` declarations in server/ describe different populations — one instrument has stopped seeing a shape the other still sees",
    ).toEqual(fromSource);
  });
});
