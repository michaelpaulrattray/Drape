/**
 * THE SHIFT DIGEST'S ARMS (#510).
 *
 * The reader is `scripts/lib/shiftDigest.mts`; its CLI is
 * `scripts/shift-digest.mts`. What is proved here, and why each arm exists:
 *
 * 1. **The card's own two bars, driven both ways.** A card touching
 *    `server/routes/billing.ts` receives the access-control section IN FULL; a
 *    lobby-only card receives no casting flag entry. Each is run against
 *    FIXTURES (deterministic, CI-safe) *and* against the REAL law surfaces,
 *    which are tracked — the fixture arm proves the mechanism, the real arm
 *    proves it against the document a shift will actually be handed.
 *
 * 2. **The two defects the first drive found**, both of them pinned so they
 *    cannot come back: a path written inside backticks (which is how every path
 *    in these documents is written) must match, and `promptAuthor.ts` must NOT
 *    read as a money path on the `auth` inside `Author`.
 *
 * 3. **Nothing is silently dropped.** The PROGRAM split carries or names every
 *    `##` section; a heading whose vocabulary is unknown is NAMED, never lost.
 *    That is the invariant the whole heading-match rule stands on, so it is
 *    driven with a heading the vocabulary has never heard of.
 *
 * 4. **The refusals fire.** A surface with no sections, a PROGRAM with no
 *    current focus, and — the sharpest one — a money/auth request when no law
 *    surface has an access-control section. That last is the positive control
 *    this suite would be worthless without: an arm that only checks the section
 *    ARRIVES passes just as happily when the selector returns everything.
 *
 * ⚠ **What cannot be armed here, stated rather than left to be discovered:**
 * `.agents/foreman/PROGRAM.md` and `prompt.md` are gitignored, so CI never sees
 * them. Every arm about the PROGRAM runs on a fixture; the one arm that reads
 * the real file skips itself with a printed reason when it is absent, and is a
 * FLOOR rather than coverage.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAW_SURFACES } from "../scripts/lib/lawText.mts";
import {
  baseName,
  buildDigest,
  DigestRefusal,
  isMoneyAuthPath,
  isOnMoneyAuthMap,
  mentionedFileNames,
  parseMoneyAuthMap,
  mentionedFlags,
  mentionedPaths,
  pathCovers,
  PROGRAM_PATH,
  selectLawSections,
  splitProgram,
  splitSections,
  type DigestInputs,
} from "../scripts/lib/shiftDigest.mts";

const REPO_ROOT = path.resolve(__dirname, "..");
const ROOTS = ["server", "client", "scripts", "docs", "shared", "drizzle"];

/** A law surface shaped like `CLAUDE.md`: `##` sections that name paths. */
const FIXTURE_CLAUDE = `# Law

## Project context

Nothing here names a file.

## Access control — expected behaviour

The grid says what; the invariants say where.

### Enforcement invariants

1. Scope the owner in the statement that reads or writes — see \`server/db/boards.ts\`.

## Design system conventions

Tokens live in \`client/src/styles/tokens.css\`, and the lobby's own surfaces are under
\`client/src/features/lobby/\`.
`;

/** A catalogue shaped like `FEATURE_FLAGS.md`: one heading, flag entries as bullets. */
const FIXTURE_FLAGS = `# The feature-flag catalogue

## The scope flags

- \`CASTING_V2_SCOPE\` — the whole namespace; \`server/castingV2/index.ts\` is its door.
- \`CASTING_INK_STUDIO_SCOPE\` — the ink studio's door, \`server/casting/ink/inkUploadDoor.ts\`.
- \`CREW_TAB_SCOPE\` — the Crew tab at \`client/src/features/admin/crew/CrewTab.tsx\`.
`;

const FIXTURE_PROGRAM = `# THE PROGRAM

## Mission

Narrative about where the product is going.

## Current focus (ONE thing at a time)

The creative register (#16) is the current milestone.

## MAINTENANCE MODE — the only work when no focus is confirmed

The team NEVER selects the next feature.

## A heading whose words nobody classified

This section states something, and the vocabulary has never heard of its heading.
`;

const surfaces = () => [
  { path: "CLAUDE.md", text: FIXTURE_CLAUDE },
  { path: "docs/architecture/FEATURE_FLAGS.md", text: FIXTURE_FLAGS },
];

function realSurfaces(): { path: string; text: string }[] {
  return LAW_SURFACES.map((surface) => ({
    path: surface,
    text: readFileSync(path.join(REPO_ROOT, surface), "utf8"),
  }));
}

function realRoots(): string[] {
  return readdirSync(REPO_ROOT).filter(
    (entry) => statSync(path.join(REPO_ROOT, entry), { throwIfNoEntry: false })?.isDirectory() ?? false,
  );
}

function digestInputs(overrides: Partial<DigestInputs> = {}): DigestInputs {
  return {
    now: new Date("2026-09-05T00:00:00Z"),
    promptMd: "# orders\n\n## 0. Safety latch\n\n## 1. Read the state\n",
    programMd: FIXTURE_PROGRAM,
    lawSurfaces: surfaces(),
    roots: ROOTS,
    nextUp: [],
    patrolClocks: "no seat is overdue",
    since: { label: "foreman-20260904-2340.md", iso: "2026-09-04T23:40:00" },
    commits: [],
    closedCards: [],
    request: { paths: [], flags: [] },
    sourceBytes: [{ path: PROGRAM_PATH, bytes: 52_000 }],
    ...overrides,
  };
}

describe("splitSections", () => {
  it("splits a law surface at its headings and keeps each section whole", () => {
    const sections = splitSections("CLAUDE.md", FIXTURE_CLAUDE);
    const access = sections.find((section) => section.heading.startsWith("Access control"));
    expect(access).toBeDefined();
    /* The `###` child is INSIDE its parent, so "in full" is what a caller gets. */
    expect(access?.text).toContain("### Enforcement invariants");
    expect(access?.text).toContain("server/db/boards.ts");
    expect(access?.text).not.toContain("Design system conventions");
  });

  it("splits the flag catalogue at its BULLETS, because that is what a flag entry is", () => {
    const sections = splitSections("docs/architecture/FEATURE_FLAGS.md", FIXTURE_FLAGS);
    const entries = sections.filter((section) => section.level === 0).map((section) => section.heading);
    expect(entries).toEqual(["CASTING_V2_SCOPE", "CASTING_INK_STUDIO_SCOPE", "CREW_TAB_SCOPE"]);
  });

  it("splits the REAL flag catalogue into one entry per flag, and finds the flags the index names", () => {
    const catalogue = readFileSync(
      path.join(REPO_ROOT, "docs/architecture/FEATURE_FLAGS.md"),
      "utf8",
    );
    const entries = splitSections("docs/architecture/FEATURE_FLAGS.md", catalogue).filter(
      (section) => section.level === 0,
    );
    /* A floor, not a count: the catalogue grows. If this ever reads 0 or 1 the
       bullet shape has changed and every by-flag selection below is inert. */
    expect(entries.length).toBeGreaterThan(20);
    expect(entries.map((entry) => entry.heading)).toContain("CASTING_V2_SCOPE");
  });

  it("REFUSES a surface with no sections rather than returning a short list", () => {
    expect(() => splitSections("CLAUDE.md", "a file with no headings at all")).toThrow(DigestRefusal);
  });
});

describe("the path index", () => {
  it("finds a path written inside backticks — the shape every law document uses", () => {
    const found = mentionedPaths("see `server/routes/billing.ts` for the call site", ROOTS);
    expect(found).toContain("server/routes/billing.ts");
  });

  it("ignores a slashed word that is not a repository path", () => {
    const found = mentionedPaths("the wardrobe/basics path is retired", ROOTS);
    expect(found).toEqual([]);
  });

  it("covers a file by the directory that holds it, both ways round", () => {
    expect(pathCovers("server/routes/", "server/routes/billing.ts")).toBe(true);
    expect(pathCovers("client/src/features/lobby/Home.tsx", "client/src/features/lobby")).toBe(true);
    expect(pathCovers("server/routes/billing.ts", "server/routes/billing.ts")).toBe(true);
  });

  it("does NOT let a whole top-level directory stand as a citation of a file", () => {
    expect(pathCovers("client/", "client/src/features/lobby")).toBe(false);
    expect(pathCovers("server/", "server/routes/billing.ts")).toBe(false);
  });

  it("reads flag names out of a section", () => {
    expect(mentionedFlags("gated by `CASTING_V2_SCOPE` today")).toContain("CASTING_V2_SCOPE");
  });
});

describe("isMoneyAuthPath", () => {
  it("is true for the money and auth surfaces", () => {
    for (const money of [
      "server/routes/billing.ts",
      "server/db/credits.ts",
      "server/routes/emailAuth.ts",
      "server/_core/cookies.ts",
      "server/casting/castingCreditCosts.ts",
    ]) {
      expect(isMoneyAuthPath(money), money).toBe(true);
    }
  });

  it("is false for a path that merely CONTAINS one of the words", () => {
    /* The defect this pins: `auth` inside `Author`. A substring rule called the
       prompt author a money path, which is the noisy half of the same failure. */
    expect(isMoneyAuthPath("server/casting/promptAuthor.ts")).toBe(false);
    expect(isMoneyAuthPath("client/src/features/lobby/Home.tsx")).toBe(false);
  });
});

describe("selectLawSections — the card's two bars", () => {
  it("BAR 1 · a card touching billing gets the access-control section IN FULL", () => {
    const selected = selectLawSections(surfaces(), { paths: ["server/routes/billing.ts"], flags: [] }, ROOTS);
    const access = selected.find((choice) => choice.section.heading.startsWith("Access control"));
    expect(access).toBeDefined();
    expect(access?.because).toContain("money/auth");
    expect(access?.section.text).toContain("### Enforcement invariants");
  });

  it("BAR 1 · and it does so on the REAL CLAUDE.md, which is the document a shift is handed", () => {
    const selected = selectLawSections(
      realSurfaces(),
      { paths: ["server/routes/billing.ts"], flags: [] },
      realRoots(),
    );
    const access = selected.find((choice) => /access control/i.test(choice.section.heading));
    expect(access).toBeDefined();
    /* "In full" means the invariants ride with the grid — the half a shift on a
       money path must not be missing. */
    expect(access?.section.text).toContain("Enforcement invariants");
    expect(access?.section.text).toContain("Capability grid");
  });

  it("BAR 2 · a lobby-only card gets no casting flag entry", () => {
    const selected = selectLawSections(
      surfaces(),
      { paths: ["client/src/features/lobby/Home.tsx"], flags: [] },
      ROOTS,
    );
    const headings = selected.map((choice) => choice.section.heading);
    expect(headings).not.toContain("CASTING_V2_SCOPE");
    expect(headings).not.toContain("CASTING_INK_STUDIO_SCOPE");
  });

  it("BAR 2 · and not on the real catalogue either, where the entries are 30-odd", () => {
    const selected = selectLawSections(
      realSurfaces(),
      { paths: ["client/src/features/lobby/Home.tsx"], flags: [] },
      realRoots(),
    );
    const casting = selected.filter((choice) => /^CASTING_/.test(choice.section.heading));
    expect(casting.map((choice) => choice.section.heading)).toEqual([]);
  });

  it("⚠ THE POSITIVE CONTROL: the selector is not simply returning everything", () => {
    /* Without this arm, both bars above pass on a selector that hands back the
       whole law every time — the absence-only shape this repository has been
       bitten by. A lobby card must receive FEWER sections than exist. */
    const all = surfaces().flatMap((surface) => splitSections(surface.path, surface.text));
    const selected = selectLawSections(
      surfaces(),
      { paths: ["client/src/features/lobby/Home.tsx"], flags: [] },
      ROOTS,
    );
    expect(selected.length).toBeLessThan(all.length);
    expect(selected.length).toBeGreaterThan(0);
  });

  it("selects a flag entry by name, and only that entry", () => {
    const selected = selectLawSections(surfaces(), { paths: [], flags: ["CREW_TAB_SCOPE"] }, ROOTS);
    expect(selected.map((choice) => choice.section.heading)).toEqual(["CREW_TAB_SCOPE"]);
  });

  it("REFUSES a money/auth request when no surface has an access-control section", () => {
    /* The instrument's own negative control: if the section is renamed or
       carved out, this must fail LOUDLY rather than hand a shift on the money
       path a digest that quietly lacks it. */
    const withoutAccessControl = [
      { path: "CLAUDE.md", text: "# Law\n\n## Project context\n\nnothing\n" },
    ];
    expect(() =>
      selectLawSections(withoutAccessControl, { paths: ["server/routes/billing.ts"], flags: [] }, ROOTS),
    ).toThrow(/access control/i);
  });
});

describe("splitProgram", () => {
  it("carries the law sections verbatim and NAMES the rest", () => {
    const split = splitProgram(FIXTURE_PROGRAM);
    const carried = split.carried.map((section) => section.heading);
    const named = split.named.map((section) => section.heading);
    expect(carried).toContain("Current focus (ONE thing at a time)");
    expect(carried.some((heading) => heading.startsWith("MAINTENANCE MODE"))).toBe(true);
    expect(named).toContain("Mission");
  });

  it("⚠ a heading the vocabulary has never heard of is NAMED, never dropped", () => {
    const split = splitProgram(FIXTURE_PROGRAM);
    const everywhere = [...split.carried, ...split.named].map((section) => section.heading);
    expect(everywhere).toContain("A heading whose words nobody classified");
  });

  it("carries a law section in FULL — no truncation anywhere", () => {
    const split = splitProgram(FIXTURE_PROGRAM);
    const focus = split.carried.find((section) => /current focus/i.test(section.heading));
    expect(focus?.text).toContain("The creative register (#16) is the current milestone.");
  });

  it("REFUSES a PROGRAM with no current focus", () => {
    expect(() => splitProgram("# THE PROGRAM\n\n## Mission\n\nnothing\n")).toThrow(/current focus/i);
  });

  it("reads the REAL PROGRAM when it is there, and says so when it is not", () => {
    const full = path.join(REPO_ROOT, PROGRAM_PATH);
    if (!existsSync(full)) {
      /* `.agents/` is gitignored: in CI this file does not exist, and that is
         the stated limit rather than a silent pass. */
      console.log(`shiftDigest: ${PROGRAM_PATH} absent (gitignored) — the real-file arm is a floor and did not run`);
      return;
    }
    const split = splitProgram(readFileSync(full, "utf8"));
    expect(split.carried.some((section) => /current focus/i.test(section.heading))).toBe(true);
    expect(split.carried.some((section) => /maintenance mode/i.test(section.heading))).toBe(true);
    expect(split.carried.some((section) => /milestone gate/i.test(section.heading))).toBe(true);
    expect(split.carried.some((section) => /standing exceptions/i.test(section.heading))).toBe(true);
  });
});

describe("buildDigest", () => {
  it("renders an unreadable queue as UNREADABLE, never as an empty one", () => {
    const digest = buildDigest(
      digestInputs({ nextUp: { unreadable: "gh failed — not authenticated" } }),
    );
    expect(digest).toContain("NEXT UP: UNREADABLE");
    expect(digest).toContain("not authenticated");
    expect(digest).not.toContain("NEXT UP: EMPTY");
  });

  it("says EMPTY only when the queue really was read and really is empty", () => {
    expect(buildDigest(digestInputs({ nextUp: [] }))).toContain("NEXT UP: EMPTY");
  });

  it("lists NEXT UP oldest first, the order the standing orders take them in", () => {
    const digest = buildDigest(
      digestInputs({
        nextUp: [
          { number: 512, title: "newer", labels: ["founder-ordered"], createdAt: "2026-09-04T01:00:00Z" },
          { number: 243, title: "older", labels: ["founder-ordered", "debt"], createdAt: "2026-08-29T01:00:00Z" },
        ],
      }),
    );
    expect(digest.indexOf("#243")).toBeLessThan(digest.indexOf("#512"));
    expect(digest).toContain("[debt]");
  });

  it("carries the whole current focus and names what it did not carry", () => {
    const digest = buildDigest(digestInputs());
    expect(digest).toContain("The creative register (#16) is the current milestone.");
    expect(digest).toContain("Mission");
    expect(digest).toContain(PROGRAM_PATH);
  });

  it("tells a shift with no card named that §5 is empty because nothing was asked", () => {
    const digest = buildDigest(digestInputs());
    expect(digest).toContain("No paths or flags were named");
  });

  it("distinguishes 'the law says nothing about this' from 'nothing was asked'", () => {
    const digest = buildDigest(
      digestInputs({ request: { paths: ["docs/specs/NOT_A_REAL_FILE.md"], flags: [] } }),
    );
    expect(digest).toContain("That is an ANSWER, not an omission");
  });

  it("REFUSES standing orders with no steps rather than printing a digest without them", () => {
    expect(() => buildDigest(digestInputs({ promptMd: "# orders with no sections" }))).toThrow(
      DigestRefusal,
    );
  });

  it("quotes its own size and does not claim CLAUDE.md as a saving", () => {
    const digest = buildDigest(digestInputs());
    expect(digest).toContain("this digest");
    expect(digest).toContain("stands in for");
    expect(digest).toContain("`CLAUDE.md` is deliberately NOT in that arithmetic");
  });
});

describe("the money/auth map, read out of the reviewer's charter", () => {
  const charter = () => readFileSync(path.join(REPO_ROOT, "docs/REVIEWER_CHARTER.md"), "utf8");

  it("parses the REAL charter and expands its alternation shorthand", () => {
    const map = parseMoneyAuthMap(charter());
    expect(map).toContain("server/routes/billing");
    expect(map).toContain("server/routes/emailVerification");
    expect(map).toContain("server/_core/sdk.ts");
    /* the charter puts the directory on the first token only; the bare names
       after it inherit it, and dropping them lost three auth surfaces */
    expect(map).toContain("server/_core/cookies.ts");
    expect(map).toContain("server/_core/env.ts");
    expect(map).toContain("drizzle");
  });

  it("REFUSES a charter with no map rather than falling back to the word set", () => {
    expect(() => parseMoneyAuthMap(["# charter", "", "## Something else", "", "nothing"].join("\n"))).toThrow(
      DigestRefusal,
    );
  });

  it("REFUSES a map section that yields no paths", () => {
    expect(() =>
      parseMoneyAuthMap(["## The money/auth path map", "", "- nothing quoted here"].join("\n")),
    ).toThrow(DigestRefusal);
  });

  it("⚠ THE SESSION-MINT SITE THE WORD SET MISSED is on the map", () => {
    /* server/routes/emailVerification.ts is invariant 9's own counterexample and
       neither `email` nor `verification` is a money word - so before the map was
       read, the unconditional arm stayed dark on the one class of file it exists
       for, and §5 then said the law was silent about it. */
    const map = parseMoneyAuthMap(charter());
    expect(isMoneyAuthPath("server/routes/emailVerification.ts")).toBe(false);
    expect(isOnMoneyAuthMap("server/routes/emailVerification.ts", map)).toBe(true);
    for (const surface of ["server/_core/sdk.ts", "server/_core/env.ts", "shared/const.ts", "drizzle/schema.ts"]) {
      expect(isOnMoneyAuthMap(surface, map), surface).toBe(true);
    }
  });

  it("does NOT put an ordinary casting file on the map", () => {
    const map = parseMoneyAuthMap(charter());
    expect(isOnMoneyAuthMap("server/casting/promptAuthor.ts", map)).toBe(false);
    expect(isOnMoneyAuthMap("client/src/features/lobby/Home.tsx", map)).toBe(false);
  });

  it("⚠ the map's own road is what carries it — asserted on a path NO other road reaches", () => {
    /* `emailVerification.ts` is also cited by NAME in the law, so an arm on it
       passes even with the map ignored — a sabotage proved exactly that. This
       one uses `server/_core/env.ts`, which the law never cites and only the
       charter's map covers, and it asserts the REASON rather than the arrival. */
    const map = parseMoneyAuthMap(charter());
    const withMap = selectLawSections(
      realSurfaces(),
      { paths: ["server/_core/env.ts"], flags: [] },
      realRoots(),
      map,
    );
    const access = withMap.find((choice) => /access control/i.test(choice.section.heading));
    expect(access, "the charter's map must carry it").toBeDefined();
    expect(access?.because).toContain("money/auth");

    const withoutMap = selectLawSections(
      realSurfaces(),
      { paths: ["server/_core/env.ts"], flags: [] },
      realRoots(),
    );
    expect(
      withoutMap.some((choice) => /access control/i.test(choice.section.heading)),
      "and without the map nothing else reaches it — otherwise this arm proves nothing",
    ).toBe(false);
  });

  it("carries the access-control section for a mint site once the map is passed", () => {
    const map = parseMoneyAuthMap(charter());
    const selected = selectLawSections(
      realSurfaces(),
      { paths: ["server/routes/emailVerification.ts"], flags: [] },
      realRoots(),
      map,
    );
    const access = selected.find((choice) => /access control/i.test(choice.section.heading));
    expect(access).toBeDefined();
    expect(access?.section.text).toContain("Enforcement invariants");
  });
});

describe("citations the index used to be blind to", () => {
  it("reads a bare file name cited in backticks", () => {
    expect(mentionedFileNames("`/api/auth/verify-email` is minted by `emailVerification.ts`")).toContain(
      "emailVerification.ts",
    );
  });

  it("ignores a generic name that names nothing in particular", () => {
    expect(mentionedFileNames("see `index.ts` and `types.ts`")).toEqual([]);
  });

  it("baseName takes the last segment", () => {
    expect(baseName("server/routes/emailVerification.ts")).toBe("emailVerification.ts");
  });

  it("⚠ SELECTS a section that cites the file by NAME ALONE", () => {
    /* The unit arms above prove the reader; this proves the SELECTION uses it.
       A sabotage that disabled the by-name road left every unit arm green —
       measured, and it is why this arm exists rather than being assumed. */
    const surface = [
      {
        path: "CLAUDE.md",
        text: [
          "# Law",
          "",
          "## Session issuance",
          "",
          "`/api/auth/verify-email` is minted by `emailVerification.ts` and nothing else.",
          "",
          "## Something else",
          "",
          "no citation here",
          "",
        ].join("\n"),
      },
    ];
    const selected = selectLawSections(
      surface,
      { paths: ["server/routes/emailVerification.ts"], flags: [] },
      ROOTS,
    );
    expect(selected.map((choice) => choice.section.heading)).toEqual(["Session issuance"]);
    expect(selected[0].because).toContain("by file name");
  });
});

describe("a fenced block is not a heading", () => {
  const FENCED = [
    "# THE PROGRAM",
    "",
    "## Current focus (ONE thing at a time)",
    "",
    "Run the reader:",
    "",
    "```",
    "# this is a shell comment, not a heading",
    "npx tsx scripts/patrol-clocks.mts",
    "```",
    "",
    "The focus continues after the fence and must survive.",
    "",
    "## MAINTENANCE MODE",
    "",
    "The team NEVER selects the next feature.",
    "",
  ].join("\n");

  it("does not open a phantom section inside a fence", () => {
    const headings = splitSections("PROGRAM.md", FENCED).map((section) => section.heading);
    expect(headings).not.toContain("this is a shell comment, not a heading");
  });

  it("⚠ the law section survives the fence WHOLE — the truncation the fence caused", () => {
    const split = splitProgram(FENCED);
    const focus = split.carried.find((section) => /current focus/i.test(section.heading));
    expect(focus?.text).toContain("The focus continues after the fence and must survive.");
  });

  it("REFUSES a stray level-1 heading after the first section, whatever caused it", () => {
    const stray = ["# THE PROGRAM", "", "## Current focus", "", "x", "", "# A STRAY TOP HEADING", "", "lost text"].join("\n");
    expect(() => splitProgram(stray)).toThrow(/level-1 heading/i);
  });
});

describe("bytes the digest must not waste", () => {
  it("does not carry a ### child beside the ## parent that contains it", () => {
    const surface = [
      { path: "CLAUDE.md", text: FIXTURE_CLAUDE },
    ];
    const selected = selectLawSections(surface, { paths: ["server/db/boards.ts"], flags: [] }, ROOTS);
    /* `server/db/boards.ts` is cited inside `### Enforcement invariants`, whose
       parent `## Access control` contains it. One answer, not two. */
    expect(selected).toHaveLength(1);
    expect(selected[0].section.heading).toMatch(/^Access control/);
  });

  it("marks a queue read that came back at its limit rather than dropping the rest silently", () => {
    const digest = buildDigest(
      digestInputs({
        nextUp: [
          { number: 1, title: "a", labels: [], createdAt: "2026-09-01T00:00:00Z" },
        ],
        truncated: { nextUp: true },
      }),
    );
    expect(digest).toContain("TRUNCATED");
  });

  it("says nothing about truncation when the read was complete", () => {
    const digest = buildDigest(
      digestInputs({
        nextUp: [{ number: 1, title: "a", labels: [], createdAt: "2026-09-01T00:00:00Z" }],
      }),
    );
    expect(digest).not.toContain("TRUNCATED");
  });
});
