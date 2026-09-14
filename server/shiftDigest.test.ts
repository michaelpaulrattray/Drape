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
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAW_SURFACES } from "../scripts/lib/lawText.mts";
import {
  baseName,
  buildDigest,
  choosePreviousShift,
  DigestRefusal,
  isMoneyAuthPath,
  isOnMoneyAuthMap,
  isUnreadable,
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
  type MailboxEntry,
  type PreviousShift,
} from "../scripts/lib/shiftDigest.mts";
import { mailboxEntries } from "../scripts/lib/mailboxEntries.mts";
import {
  OPEN_QUEUE_LIMIT,
  bandFromOpenQueue,
  emptyOrderedBandVerdict,
  emptyOrderedBandVerdictOnLabels,
} from "../scripts/lib/nextUpItems.mts";

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
    since: { label: "foreman-20260904-2340.md", iso: "2026-09-04T13:40:00.000Z", notes: [] },
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

  it("⚠ POINTS at a citation that lives inside a section it does not carry, instead of denying it", () => {
    /*
      The failure this closes: a path cited only inside a level-1 preamble or an
      entry-holding section was selected by nothing, and §5 then printed "the
      surfaces were read and no section covers it" — a confident denial where the
      module's own doctrine is fail toward a POINTER. The fixture below is the
      shape the reviewer traced on the real catalogue: the only citation of the
      requested file sits in a section whose flag bullets are the real answer.
    */
    const surface = [
      {
        path: "CLAUDE.md",
        text: [
          "# Law",
          "",
          "## Optional .env vars (feature-gated)",
          "",
          "The catalogue is `docs/architecture/FEATURE_FLAGS.md`.",
          "",
          "- `R7_EVIDENCE_INGEST_SCOPE` — off/absent, all, or users:<ids>.",
          "- `CREW_TAB_SCOPE` — the Crew tab.",
          "",
        ].join("\n"),
      },
    ];
    const digest = buildDigest(
      digestInputs({
        lawSurfaces: surface,
        request: { paths: ["docs/architecture/FEATURE_FLAGS.md"], flags: [] },
      }),
    );
    expect(digest).not.toContain("That is an ANSWER, not an omission");
    expect(digest).toContain("OPEN THESE, they are not silence");
    expect(digest).toContain("Optional .env vars");
    /* THE NARROWEST place to look, not the widest: the level-1 document body
       matches too, and pointing a shift at a whole file is not pointing. */
    expect(digest).not.toMatch(/^ {2}CLAUDE\.md L1–/m);
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

  it("marks a truncated CLOSED-CARDS read too, including when the filter emptied it", () => {
    /* The marker is measured on the RAW gh rows, before the instant filter: 43
       closed, gh returns its 40, four are filtered out, and a post-filter count
       of 36 would have read as a complete list. The empty branch is the sharper
       half — "none" is the one thing it is certainly not. */
    const withRows = buildDigest(
      digestInputs({ closedCards: ["#1  a card"], truncated: { closedCards: true } }),
    );
    expect(withRows).toContain("TRUNCATED");

    const emptied = buildDigest(digestInputs({ closedCards: [], truncated: { closedCards: true } }));
    expect(emptied).toContain("AT ITS LIMIT");
    expect(buildDigest(digestInputs({ closedCards: [] }))).not.toContain("AT ITS LIMIT");
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

/**
 * THE COLLECTOR'S JUDGEMENT — the half that was actually wrong (#774).
 *
 * Every arm above drives `buildDigest`, the RENDERER, which was never the
 * defect: handed `[]` it correctly printed EMPTY, because `[]` was all it was
 * ever told. The bug lived in the collector, which asked `gh` a narrow question
 * and could not tell an empty answer from a broken one — and a collector that
 * fetches and judges in one breath can only be tested by standing up a `gh`,
 * which is why it shipped green through three sibling repairs (#725, #730,
 * #772). `bandFromOpenQueue` is that judgement, lifted out so these arms exist.
 */
describe("bandFromOpenQueue — an empty NEXT UP is cross-examined, never believed", () => {
  const row = (number: number, labels: string[] = []) => ({
    number,
    title: `card ${number}`,
    labels,
    createdAt: "2026-09-01T00:00:00Z",
  });

  it("cuts the band out of a whole-queue read and leaves the rest behind", () => {
    const verdict = bandFromOpenQueue(
      [row(1, ["bug"]), row(2, ["founder-ordered"]), row(3, ["seat:retro"])],
      200,
    );
    expect("unreadable" in verdict).toBe(false);
    if ("unreadable" in verdict) return;
    expect(verdict.band.map((item) => item.number)).toEqual([2]);
    expect(verdict.truncated).toBe(false);
  });

  it("believes an empty band when the queue answered and holds no ordered card", () => {
    const verdict = bandFromOpenQueue([row(1, ["bug"]), row(2, ["seat:retro"])], 200);
    expect("unreadable" in verdict).toBe(false);
    if ("unreadable" in verdict) return;
    expect(verdict.band).toEqual([]);
  });

  /* THE ARM THIS CARD EXISTS FOR. A `gh` that exits 0 with `[]` is the blip
     seen on production (#725: `process` 0 at 15:00:11, 8 forty seconds later).
     The old road printed "NEXT UP: EMPTY" on exactly this input. */
  it("REFUSES an empty band when the whole queue came back empty too — the blip", () => {
    const verdict = bandFromOpenQueue([], 200);
    expect("unreadable" in verdict).toBe(true);
    if (!("unreadable" in verdict)) return;
    expect(verdict.unreadable).toContain("could not be believed");
    expect(verdict.unreadable).toContain("blip");
  });

  it("REFUSES an empty band when the witness itself came back at its cap", () => {
    /* `gh` returns the NEWEST rows and ordered cards skew OLD, so a full
       window is exactly the read that may never have reached the band. */
    const full = Array.from({ length: 5 }, (_, index) => row(index + 1, ["bug"]));
    const verdict = bandFromOpenQueue(full, 5);
    expect("unreadable" in verdict).toBe(true);
    if (!("unreadable" in verdict)) return;
    expect(verdict.unreadable).toContain("5-row limit");
  });

  it("marks truncation on the POPULATION, not on the band", () => {
    /* One ordered card in a read that filled its window: the band is short and
       complete-looking, and the marker is the only thing that says an older
       ordered card may sit outside it. */
    const full = [
      row(1, ["founder-ordered"]),
      ...Array.from({ length: 4 }, (_, index) => row(index + 2, ["bug"])),
    ];
    const verdict = bandFromOpenQueue(full, 5);
    expect("unreadable" in verdict).toBe(false);
    if ("unreadable" in verdict) return;
    expect(verdict.band).toHaveLength(1);
    expect(verdict.truncated).toBe(true);
  });

  it("defaults its cap to the one constant both readers share", () => {
    /* The sweep and the digest are two files asking one question; the day they
       hold two numbers, "at its cap" means two things. */
    expect(OPEN_QUEUE_LIMIT).toBe(200);
    const atCap = Array.from({ length: OPEN_QUEUE_LIMIT }, (_, index) => row(index + 1, ["bug"]));
    expect("unreadable" in bandFromOpenQueue(atCap)).toBe(true);
  });
});

describe("emptyOrderedBandVerdict — the two shapes are stated, never guessed", () => {
  /*
    ⚠ THE POSITIVE CONTROL THAT MATTERS. The raw reader flattens `{ name }`
    label objects; the label reader takes `string[]`. Neither throws on the
    other's input — the raw one reads `.name` off a string, gets `undefined`,
    and counts ZERO ordered cards. So the sharpest refusal of the four would
    silently never fire and an empty band would read as believable while the
    band sat in the witness. These arms prove each shape reaches the same
    verdict through its own door.
  */
  const RAW = [{ labels: [{ name: "founder-ordered" }] }, { labels: [{ name: "bug" }] }];
  const NAMES = [["founder-ordered"], ["bug"]];

  it("catches an ordered card in the witness through the RAW door", () => {
    const verdict = emptyOrderedBandVerdict(RAW, 200);
    expect(verdict.believable).toBe(false);
    expect(verdict.why).toContain("1 open card(s) carrying");
  });

  it("catches the same card through the LABEL door", () => {
    const verdict = emptyOrderedBandVerdictOnLabels(NAMES, 200);
    expect(verdict.believable).toBe(false);
    expect(verdict.why).toContain("1 open card(s) carrying");
  });

  it("agrees on a witness that genuinely holds no ordered card", () => {
    expect(emptyOrderedBandVerdict([{ labels: [{ name: "bug" }] }], 200).believable).toBe(true);
    expect(emptyOrderedBandVerdictOnLabels([["bug"]], 200).believable).toBe(true);
  });

  it("refuses a witness that could not be taken at all", () => {
    expect(emptyOrderedBandVerdict(null, 200).believable).toBe(false);
    expect(emptyOrderedBandVerdictOnLabels(null, 200).believable).toBe(false);
  });
});

/**
 * WHICH ENTRY WAS THE PREVIOUS SHIFT (#960) — the section every shift reads
 * first, and the one that failed toward *nothing happened*.
 *
 * The old reader took the maximum FILENAME stamp and parsed it as LOCAL time.
 * Measured on the machine that filed the card: the mtime and filename orderings
 * disagree at 38 of 377 positions, the filename winner sat 8th by write time,
 * and one stamp was in the FUTURE of local now — which makes `git log --since=`
 * return zero rows *by construction*, rendered as a confident `none`.
 *
 * ⚠ **The refusal is the guard; the mtime switch is what stops it firing.** So
 * both are armed, and so is the negative control the suite would be worthless
 * without: the reader must still say `none` when none is TRUE. An arm that only
 * proves a refusal fires passes just as happily on a reader that refuses always.
 *
 * The IO half (`mailboxEntries`) is driven over a REAL temporary directory
 * carrying both naming conventions, because `.agents/` is gitignored and no arm
 * in CI can ever read the real mailbox.
 */
describe("choosePreviousShift — the mailbox is read by mtime, cross-examined by the filename", () => {
  const NOW = Date.parse("2026-09-14T12:20:00Z");
  const at = (iso: string) => Date.parse(iso);

  /** The live specimen: `…-2345` has the highest filename stamp and was written first. */
  const SPECIMEN: MailboxEntry[] = [
    { name: "foreman-20260914-2345.md", mtimeMs: at("2026-09-14T03:03:00Z"), filenameStamp: "202609142345" },
    { name: "foreman-20260914-1032.md", mtimeMs: at("2026-09-14T11:19:00Z"), filenameStamp: "202609141032" },
    { name: "foreman-20260914-2207.md", mtimeMs: at("2026-09-14T12:09:38Z"), filenameStamp: "202609142207" },
  ];

  it("picks the entry written LAST, not the one whose name sorts highest", () => {
    const picked = choosePreviousShift(SPECIMEN, NOW);
    expect(isUnreadable(picked)).toBe(false);
    expect((picked as PreviousShift).label).toBe("foreman-20260914-2207.md");
  });

  it("hands out ONE absolute UTC instant, and it is the write time", () => {
    const picked = choosePreviousShift(SPECIMEN, NOW) as PreviousShift;
    expect(picked.iso).toBe("2026-09-14T12:09:38.000Z");
    /* The point of the assertion: a naive local ISO would round-trip to a
       different instant on this machine, and that is the whole bug. */
    expect(Date.parse(picked.iso)).toBe(at("2026-09-14T12:09:38Z"));
  });

  it("⚠ NAMES the disagreement rather than resolving it silently", () => {
    const picked = choosePreviousShift(SPECIMEN, NOW) as PreviousShift;
    expect(picked.notes.join("\n")).toContain("foreman-20260914-2345.md");
    expect(picked.notes.join("\n")).toContain("3 of 3 by write time");
  });

  it("⚠ says out loud when the OLD reader would have asked for a future --since", () => {
    const picked = choosePreviousShift(SPECIMEN, NOW) as PreviousShift;
    /* `…-2345` read as local is 23:45 on a machine whose now is 22:20 local —
       the exact reading that printed a false `none` on the night this was
       filed. The note names the instant, so a shift can check it itself. */
    expect(picked.notes.join("\n")).toContain("FUTURE of now");
    expect(picked.notes.join("\n")).toContain("2026-09-14T23:45:00");
  });

  it("⚠ THE NEGATIVE CONTROL: it is SILENT when the two readers agree", () => {
    const agreeing: MailboxEntry[] = [
      { name: "foreman-20260913-0900.md", mtimeMs: at("2026-09-13T09:00:00Z"), filenameStamp: "202609130900" },
      { name: "foreman-20260914-1000.md", mtimeMs: at("2026-09-14T10:00:00Z"), filenameStamp: "202609141000" },
    ];
    const picked = choosePreviousShift(agreeing, NOW) as PreviousShift;
    expect(picked.label).toBe("foreman-20260914-1000.md");
    expect(picked.notes).toEqual([]);
  });

  it("⚠ REFUSES an entry written in the FUTURE rather than a --since nothing can answer", () => {
    const skewed: MailboxEntry[] = [
      { name: "foreman-20260914-1000.md", mtimeMs: at("2026-09-14T10:00:00Z"), filenameStamp: "202609141000" },
      { name: "foreman-20260914-2359.md", mtimeMs: at("2026-09-14T14:00:00Z"), filenameStamp: "202609142359" },
    ];
    const verdict = choosePreviousShift(skewed, NOW);
    expect(isUnreadable(verdict)).toBe(true);
    expect((verdict as { unreadable: string }).unreadable).toContain("FUTURE");
    expect((verdict as { unreadable: string }).unreadable).toContain("foreman-20260914-2359.md");
  });

  it("refuses an empty mailbox rather than picking nothing and calling it quiet", () => {
    expect(isUnreadable(choosePreviousShift([], NOW))).toBe(true);
    expect(
      isUnreadable(choosePreviousShift([{ name: "NOTES.md", mtimeMs: NOW, filenameStamp: null }], NOW)),
    ).toBe(true);
  });

  it("breaks an exact mtime tie by name, so two runs cannot disagree", () => {
    const tied: MailboxEntry[] = [
      { name: "foreman-20260914-0100.md", mtimeMs: at("2026-09-14T10:00:00Z"), filenameStamp: "202609140100" },
      { name: "retro-20260914-0100.md", mtimeMs: at("2026-09-14T10:00:00Z"), filenameStamp: "202609140100" },
    ];
    expect((choosePreviousShift(tied, NOW) as PreviousShift).label).toBe("retro-20260914-0100.md");
    expect((choosePreviousShift([...tied].reverse(), NOW) as PreviousShift).label).toBe(
      "retro-20260914-0100.md",
    );
  });
});

describe("mailboxEntries — the IO half, driven over a real directory", () => {
  /* `.agents/` is gitignored, so this is the only way an arm in CI can see the
     collector at all: a temporary mailbox carrying both conventions. */
  const withMailbox = (write: (dir: string) => void): string => {
    const root = mkdtempSync(path.join(tmpdir(), "drape-digest-mailbox-"));
    mkdirSync(path.join(root, ".agents", "mailbox"), { recursive: true });
    write(path.join(root, ".agents", "mailbox"));
    return root;
  };

  const writeAt = (dir: string, name: string, iso: string) => {
    const file = path.join(dir, name);
    writeFileSync(file, `# ${name}\n`);
    utimesSync(file, new Date(iso), new Date(iso));
  };

  it("reads the write time off the filesystem and carries the filename stamp as a STRING", () => {
    const root = withMailbox((dir) => {
      writeAt(dir, "foreman-20260914-2345.md", "2026-09-14T03:03:00Z");
      writeAt(dir, "foreman-20260914-1032.md", "2026-09-14T11:19:00Z");
      writeFileSync(path.join(dir, "README.md"), "not a shift entry");
    });
    try {
      const entries = mailboxEntries(root);
      expect(isUnreadable(entries)).toBe(false);
      const rows = entries as MailboxEntry[];
      /* `README.md` carries no stamp and is not a candidate. */
      expect(rows.map((row) => row.name).sort()).toEqual([
        "foreman-20260914-1032.md",
        "foreman-20260914-2345.md",
      ]);
      const picked = choosePreviousShift(rows, Date.parse("2026-09-14T12:20:00Z")) as PreviousShift;
      expect(picked.label).toBe("foreman-20260914-1032.md");
      expect(picked.iso).toBe("2026-09-14T11:19:00.000Z");
      expect(picked.notes.join("\n")).toContain("foreman-20260914-2345.md");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says the mailbox is not there rather than reporting an empty one", () => {
    const root = mkdtempSync(path.join(tmpdir(), "drape-digest-nomailbox-"));
    try {
      expect(isUnreadable(mailboxEntries(root))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("§3 renders the second reader", () => {
  it("labels the instant as a WRITE time, so it cannot be read as the filename stamp", () => {
    const text = buildDigest(digestInputs());
    expect(text).toContain("Previous entry: foreman-20260904-2340.md (written 2026-09-04T13:40:00.000Z)");
  });

  it("carries a disagreement note into the section a shift reads first", () => {
    const text = buildDigest(
      digestInputs({
        since: {
          label: "foreman-20260914-2207.md",
          iso: "2026-09-14T12:09:38.000Z",
          notes: ["⚠ the newest FILENAME stamp is a DIFFERENT entry — foreman-20260914-2345.md"],
        },
      }),
    );
    expect(text).toContain("⚠ the newest FILENAME stamp is a DIFFERENT entry");
  });

  it("⚠ and prints NO warning line when the readers agree — a quiet interval still reads as quiet", () => {
    const text = buildDigest(digestInputs({ commits: [], closedCards: [] }));
    const section = text.slice(text.indexOf("## 3 ·"), text.indexOf("## 4 "));
    expect(section).not.toContain("⚠");
    expect(section).toContain("Commits on main since then:\n  none");
  });

  it("renders an unreadable previous entry as UNREADABLE, never as a clean none", () => {
    const text = buildDigest(
      digestInputs({
        since: { unreadable: "foreman-20260914-2359.md was written 100 minute(s) in the FUTURE" },
        commits: { unreadable: "no previous entry to measure from" },
      }),
    );
    expect(text).toContain("Previous entry: UNREADABLE — foreman-20260914-2359.md was written");
    expect(text).toContain("UNREADABLE — no previous entry to measure from");
  });
});
