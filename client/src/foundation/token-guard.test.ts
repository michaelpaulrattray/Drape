import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No-hex source guard (plan §D.1, §D.2, §M "source/contract guards").
 *
 * The foundation's first non-negotiable is that a colour may only exist in
 * `tokens.css`. Nothing behavioural can see a violation — a hardcoded hex looks
 * right in one theme and wrong in the other, which is exactly the class of bug
 * the three parallel token systems produced. So this is a grep, modelled on
 * server/storage-key-generation.test.ts.
 *
 * It guards the foundation and V2 trees only. It grows with adoption rather
 * than trying to boil the ~600 lines of legacy utility CSS on day one.
 *
 * # A blind spot worth knowing about
 *
 * **This catches `#RRGGBB`. It does not catch `rgba(17, 17, 18, 0.22)`** — a
 * colour written in functional notation is invisible to a hex-shaped net, by
 * construction. Found while shipping the toast pill (D-110), whose shadow
 * carries exactly such a literal and passed clean.
 *
 * Left as-is deliberately rather than widened. A shadow is a scrim rather than
 * a semantic colour: it does not flip between themes, so it cannot produce the
 * looks-right-in-one-theme failure this guard exists to prevent. Widening the
 * net to all `rgba()` would flag every legitimate scrim, overlay and glass
 * surface in the system and be carved out until it meant nothing.
 *
 * The rule to apply by hand: **if a colour would need a different value in the
 * other theme, it is semantic and belongs in `tokens.css`** — whatever notation
 * it is written in. The grep only covers the half it can see.
 *
 * # ⚠ The trap that costs ten minutes: AN ISSUE NUMBER IS A VALID HEX (#211)
 *
 * If this guard failed and you cannot find a colour you wrote, **look for a
 * `#NNN` issue reference inside a STRING**. `code()` below strips comments, and
 * the controls prove it — so `/* founder shot #303 *\/` is spared. **A test
 * title, a thrown message or any other string literal is not a comment**, so
 * the stripper never reaches it, and every digit 0–9 is a hex digit.
 *
 * Measured rather than assumed (2026-08-29): the matcher is `{3,8}`, so the
 * trap is **every issue number from `#100` to `#99999999`** — not the `#100`–
 * `#999` band #211 was filed with. `#12` is too short to match and `#123456789`
 * is too long for the `\b`; everything between them is caught. This queue is in
 * the 200s and climbing, so this is a live trap, not a curiosity.
 *
 * **The fix is to move the reference into a comment, not to exempt `#NNN`.**
 * The strength of this guard is that its matcher is dumb and its controls are
 * sharp; an exemption is where a real `#4a4` starts slipping through. That
 * choice is pinned by an arm below, so implementing the exemption is a decision
 * someone makes on purpose rather than a drift.
 *
 * Fourth instance of a class this repo keeps meeting — a pattern that
 * legitimately owns a string it was never aimed at (`shave`/`shape` in the typo
 * gate, the `cropped` ban, `framing` in the concept describer).
 */

const clientSrc = path.resolve(__dirname, "..");

/**
 * Directories and files under guard.
 *
 * ⚠ **A PATH THAT DOES NOT EXIST IS NOT A GUARD, AND THIS LIST HELD ONE FOR
 * MONTHS.** It read `features/casting-v2`; the directory is `features/castingV2`.
 * `collect()` answered `[]` for it — under a comment reading *"Missing paths are
 * fine — they arrive later"* — so the docblock above said this guarded "the
 * foundation and V2 trees" while the V2 tree was never opened. It had
 * accumulated 31 colour literals by the time the founder reported a popover
 * rendering dark-mode styling in light mode (fable-1249), which is the exact
 * failure the first paragraph promises to prevent.
 *
 * The tolerance is gone with it: every path here must resolve, and a path that
 * has not arrived yet does not belong on the list. That is the arm below, and
 * it is the one that would have caught this.
 */
const GUARDED_PATHS = [
  "foundation",
  "features/castingV2",
  "pages/AdminFoundation.tsx",
  /* Enrolled with #68's token conversion (PR #77 review finding 1): the
     account menu renders on the themed --surface, and a reintroduced hex is
     exactly the invisible-name defect the founder photographed. */
  "components/UserCard.tsx",
  /* Section 03 (#365): the three account surfaces — Settings, Change plan and
     Add credits. Their whole stylesheet is written in tokens and every colour
     in it flips between themes, which is exactly the population this guard is
     for; enrolling them the day they land is cheaper than the day one of them
     goes dark-on-dark. */
  "features/settings",
  "features/billing/ChangePlanModal.tsx",
  "features/billing/AddCreditsModal.tsx",
  /* Brief 05 §4, the founder's own instruction: *"Every hex literal. #D5D5D5,
     #EBEBEB, #0A0A0A, #999, #bbb, #E5E5E5 all go. token-guard should be
     extended to cover this file."* The two headers this replaced held six
     between them, and a staff bar is exactly the population this guard is for
     — staff surfaces have never been dark-tested, so a hex here is a colour
     nobody would notice was wrong until the theme flipped. */
  "features/staff",
  /*
    Brief 06 §8, the founder's own bar: *"Zero hex literals across all eleven
    surfaces; token-guard extended to cover them."*

    ⚠ **ENROLLED FILE BY FILE RATHER THAN BY DIRECTORY, AND THAT IS A
    DELIBERATE NARROWNESS.** `features/admin` and `features/moderator` hold
    thirty-four files between them; twelve are the staff LISTS this brief
    rebuilt, and the rest are the investigative tools brief 09 owns and five
    FORM modals (suspend, credits, role change, review, freeze) which no brief
    has reached yet. Enrolling the directories would have meant restyling
    dialogs this brief does not describe, in the same PR — so what is on this
    list is exactly what was rebuilt and read at zero.

    **The remainder is counted rather than forgotten** — see
    `docs/specs/PROMOTION_PASS_SECTION_06.md` §5 — and each enrols with the
    brief that rewrites it, which is how `features/staff` arrived here one
    brief ago.

    ⚠ **THE SIX `features/moderator/` ROWS THIS BLOCK CARRIED ARE GONE (#421),
    AND NOTHING STOPPED BEING GUARDED.** The `features/moderator` DIRECTORY row
    at the bottom of this list collects every one of them. The reasoning above
    is kept because it is the history — and because it is the reasoning that
    left the change request modal outside every guard until the founder opened
    it. The admin rows stay: that directory still holds a file no brief owns.
  */
  "features/admin/UserTable.tsx",
  "features/admin/UserFilters.tsx",
  "features/admin/AuditLogTable.tsx",
  "features/admin/AuditLogsFilters.tsx",
  "features/admin/BlockedIPsTab.tsx",
  "features/admin/ChangeRequestList.tsx",
  "pages/AdminAuditLogs.tsx",
  "pages/AdminBugReports.tsx",
  "pages/AdminChangeRequests.tsx",
  "pages/AdminInviteCodes.tsx",
  "features/admin/UserStatsCards.tsx",

  /*
    Brief 07 §11, the founder's own bar: *"Zero greens, zero blues, zero
    ambers. `token-guard` extended over `overview/` and passing."*

    The whole directory this time rather than a selection, because brief 07
    rebuilt every file in it — the seven cards it names plus the two this card
    adds. That is the difference from the block above: there, twelve of
    thirty-four files were rebuilt and enrolling the directory would have meant
    restyling dialogs no brief had reached; here there is no remainder.

    ⚠ `chartTokens.ts` is on the list and is the one that most needed to be.
    It is the module that hands colours to recharts, which is exactly where
    every hard-coded light hex on a staff surface has historically lived — five
    `TT_STYLE` constants and eight chart props, all of them white-on-white in
    dark. A guard that covered the components and not their colour source would
    have missed the actual defect.
  */
  "features/admin/overview/AlertsFeed.tsx",
  "features/admin/overview/BannerManagement.tsx",
  "features/admin/overview/CreditEconomyCard.tsx",
  "features/admin/overview/GovernanceCard.tsx",
  "features/admin/overview/HealthMetrics.tsx",
  "features/admin/overview/NeedsHuman.tsx",
  "features/admin/overview/SystemStatusCard.tsx",
  "features/admin/overview/UserGrowthCard.tsx",
  "features/admin/overview/chartTokens.ts",
  "features/admin/overview/overview.css",
  "pages/AdminOverview.tsx",

  /*
    Brief 08 §5/§8, the founder's own bar: *"Every hex literal goes … Zero hex
    literals under `components/crew/`; `token-guard` extended and passing."*

    The whole directory, like brief 07's and unlike brief 06's file list —
    there is nothing under `components/crew/` that brief 08 does not own, so
    the narrow enrolment that directory-level guarding was avoiding has no
    population here.

    ⚠ **THE PAGE IS ON THE LIST TOO, AND IT WAS NOT IN THE BRIEF.** §8's bar
    names the components directory; `AdminCrew.tsx` held nine more literals in
    three state cards (loading, flag-dark, fault) that the mockup never
    described because they are the page's own failure states rather than the
    briefing. Guarding the directory and leaving the page that mounts it is
    how a surface reads as clean while its worst-case screens do not.
  */
  "features/admin/components/crew",
  "pages/AdminCrew.tsx",

  /*
    Brief 09 §6/§8, the founder's own bar: *"Zero hex literals under
    `features/moderator/`; `token-guard` extended and passing."*

    ⚠ **FILE BY FILE, LIKE BRIEF 06'S BLOCK AND UNLIKE 07'S AND 08'S — because
    this directory holds exactly one file no brief owns.** `ChangeRequestModal
    .tsx` is one of the five staff FORM modals, filed as its own card, and it
    holds **89** hex literals of its own. Enrolling the directory would have
    meant restyling a dialog this brief does not describe, inside the PR that
    ends the staff lane.

    Measured before and after, so the remainder is a number rather than a
    feeling: **203 literals across these six files → 0**, with 89 left in the
    one file that has a card on it.

    ⚠ `StatsCards.tsx` was on this list and was NOT one of the brief's four
    surfaces. It is the count row at the top of the same page, it carried four
    Tailwind tints, and `.dp-countrow` already existed to draw it — leaving it
    would have made the page's top strip the only coloured thing on it. Its own
    docblock says so; a file enrolled without that sentence is a scope change
    hiding in a list.

    ⚠ **SEVEN OF THIS BLOCK'S ROWS ARE GONE TOO (#421), FOR THE SAME REASON AND
    WITH THE SAME EFFECT: NOTHING STOPPED BEING GUARDED.** The one file this
    block was written to route around is the file #421 fixed, so the directory
    row below collects all seven. `pages/ModeratorDashboard.tsx` is the survivor
    because it is a PAGE and lives outside that directory.
  */
  "pages/ModeratorDashboard.tsx",

  /*
    #421, his reply #91: *"id like the change request modal and any other staff
    modals to be re-designed in our same design language."*

    ⚠ **THE DIRECTORY THIS TIME, AND THE REASON IS THE HOLE ITSELF.** The block
    above enrolled `features/moderator/` FILE BY FILE for one stated reason —
    `ChangeRequestModal.tsx` was the one file no brief owned, and it held 89
    literals, more than the other four staff dialogs combined. That narrowness
    was correct on the day and it is also exactly what let the founder find the
    offender before a guard did: five briefs each drew a scope boundary, every
    one individually right, and the dialogs sat in the gap between all five.

    With the remainder gone there is no longer anything in `features/moderator/`
    to skip, so the enrolment stops being a list somebody has to remember to
    extend. A new component under it is measured the moment it exists.

    Measured before and after: **192 literals across the five dialog files → 0**,
    plus seven Tailwind tints deleted with `UserBadges`'s two orphaned badges.
  */
  "features/moderator",
  "features/admin/UserActionModals.tsx",
  "features/admin/AuditActionModals.tsx",
  "features/admin/ReviewModal.tsx",
  "features/admin/UserBadges.tsx",
  "pages/AdminUserManagement.tsx",
];

/**
 * The only files allowed a hex literal, each for a documented reason
 * (foundation README rule 1, plan §D.1). Adding a row here is a design
 * decision, not a convenience.
 */
const HEX_CARVE_OUTS: Record<string, string> = {
  "foundation/tokens.css": "the token source itself — the one place a colour may exist",
  "foundation/brand-orb.css":
    "the brand orb's gradient is artwork, identical in both themes, not a semantic colour",
  /*
    THE GUARD GUARDS ITSELF, and its controls are violations ON PURPOSE — the
    planted hex that proves the net catches, and the arbitrary-value string that
    proves the second net does. A guard whose own positive control it flags is a
    guard that cannot be proven, so this row is the opposite of a convenience:
    the honesty arm below REQUIRES this file to keep containing one.
  */
  "foundation/token-guard.test.ts":
    "its own positive controls — a planted hex and an arbitrary value, which working law 2 requires it to contain",
  /*
    THE SAME SHAPE, ONE FILE OVER. Brief 05's guard BANS `bg-[#EBEBEB]` — the
    page background all nine staff pages used to wrap themselves in — so it has
    to contain that string twice: once as the matcher and once as the positive
    control proving the matcher fires. A guard whose own control its neighbour
    flags is a guard that cannot be proven, which is the reasoning of the row
    directly above this one rather than a new argument.

    ⚠ The narrowness matters: this is a TEST file, and it renders nothing. A
    carve-out for a component would be a different decision.
  */
  "features/staff/section05-guard.test.ts":
    "brief 05's own positive control — it bans `bg-[#EBEBEB]` and so must contain it",
  /*
    ⚠ **THE TRAP THIS FILE'S OWN DOCBLOCK PREDICTS, MET IN THE WILD (#398).**
    Enrolling `features/admin/components/crew` caught SIX offenders and every
    one of them is an issue number in a `describe`/`it` TITLE — `(#291)`,
    `(#292)` ×3, `(#290)`, `(#298)`. A title is a string, not a comment, so
    `code()` never reaches it, and every digit is a hex digit.

    The docblock's prescription is *"move the reference into a comment"*, and
    it is the right prescription — but brief 08 §8's own bar is that
    `crewTypes.test.ts` **passes untouched**, which is how that brief proves a
    surface-only change did not move what the page derives. Renaming six tests
    to satisfy a colour guard would spend that proof on nothing.

    So the exemption is the file, and its narrowness is the whole argument:
    this is a TEST of pure derivation functions. It renders no markup, imports
    no stylesheet and will never carry a colour — the same reasoning as the row
    directly above, which also says a carve-out for a COMPONENT would be a
    different decision. The rest of the directory is guarded by directory, so
    a new component under `crew/` is measured the moment it exists.

    ⚠ It is self-cleaning rather than permanent: the honesty arm below reddens
    the day this file stops containing a hex-shaped string, and its message
    says to remove this row. A shift that later moves those titles into
    comments is told to delete the exemption in the same run.
  */
  "features/admin/components/crew/crewTypes.test.ts":
    "issue numbers in test titles, in the one file brief 08 §8 requires to pass untouched — a pure-derivation test that renders nothing",
  /*
    THE THIRD INSTANCE OF THE ROW TWO ABOVE, and it arrives the moment
    `features/moderator/` is guarded by DIRECTORY rather than by file (#421).

    `section09-guard.test.ts` runs the same no-hex check over the moderator
    surfaces and proves its own matcher with `code("color: #BADA55;")` — a
    planted violation, which working law 2 requires it to contain and which the
    file-by-file enrolment above happened to route around. A guard whose
    neighbour flags its positive control is a guard that cannot be proven.

    ⚠ Narrow for the same stated reason as its two siblings: this is a TEST
    file and it renders nothing. A carve-out for a COMPONENT under this
    directory would be a different decision, and the honesty arm below reddens
    the day this file stops containing a hex-shaped string.
  */
  "features/moderator/section09-guard.test.ts":
    "its own positive control — `#BADA55`, the planted hex that proves its no-hex matcher fires",
};

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * WHAT THE GUARD SAYS WHEN IT CATCHES ONE — a constant so it can be pinned.
 *
 * ⚠ **It was written inline, and a sabotage control measured that deleting the
 * trap clause reddened NOTHING** (#211). The clause IS the whole shipped change
 * of that card: the guard catches exactly what it caught before, and the only
 * thing that moved is what the reader is told. An unpinned sentence is a change
 * that can be reverted silently, which is the one failure mode a message-only
 * fix has.
 */
const HEX_FAILURE_MESSAGE =
  "Use a token from foundation/tokens.css instead of a hex literal"
  + " — but if that looks like an issue number (#100 and up are all valid hex),"
  + " it is one: move the reference into a comment, which this guard strips";

/**
 * THE GUARD READS CODE, NOT PROSE.
 *
 * `#[0-9a-fA-F]{3,8}` matches a great deal that is not a colour, and this house
 * writes long docblocks: `screenshots #317–319`, `fable-703, founder shot #303`,
 * `Screenshot #312`, and comments that QUOTE token values in order to explain
 * them (*"`--surface` is #FFFFFF light, #1C1C1F dark"*). Every one of those is a
 * hex-shaped string and none of them paints a pixel.
 *
 * Left un-stripped, turning the guard on over the V2 tree would have produced a
 * page of false positives, and the cheapest way out of that is a carve-out per
 * file — which is how a guard stops meaning anything. So comments come out
 * first and what is left is what ships to a browser.
 *
 * The `//` rule skips a `://` so a URL in code is not half-eaten; block
 * comments cover CSS entirely, since CSS has no line comment.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
/** Tailwind's arbitrary-value escape hatch — the drift vector the README warns about. */
const ARBITRARY_COLOR = /\[#[0-9a-fA-F]{3,8}/g;

const GUARDED_EXTENSIONS = [".css", ".ts", ".tsx"];

function collect(target: string): string[] {
  const absolute = path.join(clientSrc, target);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return collect(path.relative(clientSrc, child));
    return GUARDED_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [child] : [];
  });
}

const guardedFiles = GUARDED_PATHS.flatMap(collect).map((file) => ({
  relative: path.relative(clientSrc, file).replaceAll("\\", "/"),
  source: fs.readFileSync(file, "utf8"),
}));

describe("foundation colours live only in tokens.css", () => {
  it("guards a non-empty set of files", () => {
    // A guard that matches nothing does not exist.
    expect(guardedFiles.length).toBeGreaterThan(0);
    expect(guardedFiles.map((f) => f.relative)).toContain("foundation/tokens.css");
  });

  /**
   * ⚠ THE ARM THAT WOULD HAVE CAUGHT THE DEAD PATH.
   *
   * `collect()` cannot tell "this directory is empty" from "this directory does
   * not exist", and for months it answered the second while the list said the
   * first. Nothing went red, because nothing asked.
   */
  it("every guarded path actually resolves on disk", () => {
    const missing = GUARDED_PATHS.filter(
      (target) => !fs.existsSync(path.join(clientSrc, target)),
    );
    expect(
      missing,
      "A guarded path that does not exist guards nothing — fix the spelling or remove the row",
    ).toEqual([]);
  });

  /**
   * ⚠ AND THE ONE THAT PROVES THE NET STILL CATCHES (working law 2).
   *
   * Both arms below assert an EMPTY list, and an empty list is what a broken
   * matcher returns too. So the matcher is driven against a planted violation
   * and against a comment that merely looks like one — a positive and a
   * negative control, on the same functions the real arms use.
   */
  it("catches a planted hex, and does not catch one in prose", () => {
    const planted = code(".x { color: #A23E33; }");
    expect(planted.match(HEX_LITERAL), "the net must catch a real declaration").toEqual(["#A23E33"]);

    const prose = code("/* founder shot #303, and --surface is #FFFFFF light */\n.x { color: var(--ink); }");
    expect(prose.match(HEX_LITERAL), "a hex inside a comment paints nothing").toBeNull();

    const lineComment = code("// screenshots #317-319\nconst a = 1;");
    expect(lineComment.match(HEX_LITERAL), "a hex inside a line comment paints nothing").toBeNull();

    const url = code('const u = "https://example.test/#AABBCC";');
    expect(url.match(HEX_LITERAL), "a :// is not a line comment").toEqual(["#AABBCC"]);

    expect(code(".x { color: [#123456] }").match(ARBITRARY_COLOR)).toEqual(["[#123456"]);
  });

  /**
   * ⚠ THE ISSUE-NUMBER TRAP, PINNED RATHER THAN DESCRIBED (#211).
   *
   * The docblock's claim is that an issue reference in a STRING is caught while
   * the same reference in a COMMENT is not. That is a statement about the
   * product of `code()` and `HEX_LITERAL`, so it is driven here — otherwise the
   * next reader has prose where they need a fact, which is how the docblock
   * came to describe a `#100`–`#999` band the matcher never had.
   *
   * **This arm is also the lock on the fix nobody should make.** Exempting
   * `#NNN` is tempting and would redden this; that is the point. It turns the
   * exemption from a quiet drift into a decision with this comment attached.
   */
  it("catches an issue number in a string, and not in a comment", () => {
    const title = code('describe("modalAnatomy #198", () => {});');
    expect(
      title.match(HEX_LITERAL),
      "a string literal is not a comment — the stripper never reaches it",
    ).toEqual(["#198"]);

    const referenced = code('// the sign portrait, #198\nconst a = 1;');
    expect(
      referenced.match(HEX_LITERAL),
      "and the documented workaround must actually work",
    ).toBeNull();

    /* The measured edges of the band, so the docblock's numbers are artifacts. */
    const caught = (n: string) => code(`const s = "${n}";`).match(HEX_LITERAL);
    expect(caught("#12"), "two digits is below the {3,8} floor").toBeNull();
    expect(caught("#100"), "the lowest issue number that trips it").toEqual(["#100"]);
    expect(caught("#12345678"), "eight digits still trips it").toEqual(["#12345678"]);
    expect(caught("#123456789"), "nine digits fails the trailing \\b").toBeNull();
  });

  /**
   * THE SENTENCE THE READER ACTUALLY GETS (#211).
   *
   * A failure message is only read when the arm fails, so nothing exercises it
   * on a green run — which is exactly how it could be reverted unnoticed. This
   * asserts the two things that make it worth having: that it still points at
   * the token source (the original guidance, unchanged), and that it names the
   * issue-number trap (the change). Not a byte pin — the wording may improve;
   * what may not vanish is either half of the job.
   */
  it("tells a reader whose 'colour' is an issue number what happened", () => {
    expect(HEX_FAILURE_MESSAGE).toContain("foundation/tokens.css");
    expect(HEX_FAILURE_MESSAGE).toMatch(/issue number/i);
    expect(HEX_FAILURE_MESSAGE).toMatch(/comment/i);
  });

  it("allows a hex only in the carved-out files", () => {
    const offenders = guardedFiles
      .filter(({ relative }) => !(relative in HEX_CARVE_OUTS))
      .flatMap(({ relative, source }) =>
        (code(source).match(HEX_LITERAL) ?? []).map((hex) => `${relative}: ${hex}`),
      );

    /*
      THE MESSAGE NAMES THE TRAP (#211). The old sentence said "hex literal" and
      pointed at `tokens.css`, so a reader whose real offence was `#198` in a
      test title went hunting for a colour they never wrote. The guard catches
      exactly what it caught before — this is a sentence, not a narrowing.
    */
    expect(offenders, HEX_FAILURE_MESSAGE).toEqual([]);
  });

  it("rejects Tailwind arbitrary colour values", () => {
    /*
      ⚠ THIS ARM IGNORED THE CARVE-OUTS UNTIL 2026-08-21, and nothing noticed
      because no carved-out file had ever contained a `[#`. The moment one did —
      this file's own positive control — it went red over a string that exists
      to prove the net works. An arbitrary value IS a hex, so it answers to the
      same exception list as the arm above; the two nets are now consistent
      rather than one of them being accidentally absolute.
    */
    const offenders = guardedFiles
      .filter(({ relative }) => !(relative in HEX_CARVE_OUTS))
      .flatMap(({ relative, source }) =>
        (code(source).match(ARBITRARY_COLOR) ?? []).map((match) => `${relative}: ${match}`),
      );

    expect(
      offenders,
      "Arbitrary-value colours bypass the token system — add a token instead",
    ).toEqual([]);
  });

  it("keeps every carve-out honest — each one must exist and still need it", () => {
    for (const [relative, reason] of Object.entries(HEX_CARVE_OUTS)) {
      const file = guardedFiles.find((candidate) => candidate.relative === relative);
      expect(file, `Carve-out ${relative} no longer exists — remove it (${reason})`).toBeDefined();
      expect(
        code(file!.source).match(HEX_LITERAL),
        `Carve-out ${relative} has no hex left — remove the exception (${reason})`,
      ).not.toBeNull();
    }
  });
});

describe("no stylesheet shadows a Tailwind utility name", () => {
  /**
   * The marketing stylesheet defined unlayered `.text-primary`,
   * `.text-secondary` and `.text-muted`. Being unlayered, they beat Tailwind's
   * layered utilities of the same name *everywhere in the app*, not just on
   * the pages that stylesheet exists to style. Removed at M2 — this stops the
   * class of bug rather than those three instances.
   */
  const SHADOWABLE = [
    "text-primary",
    "text-secondary",
    "text-muted",
    "text-foreground",
    "text-background",
    "bg-primary",
    "bg-secondary",
    "bg-muted",
    "bg-background",
    "border-border",
    "border-input",
  ];

  // Every global stylesheet still in the tree. styles/tokens.css was deleted —
  // it was wholly dead, yet its unlayered :root block shadowed Tailwind's grey,
  // leading and shadow scales app-wide.
  const stylesheets = ["styles/animations.css", "styles/canvas-tokens.css"]
    .filter((relative) => fs.existsSync(path.join(clientSrc, relative)))
    .map((relative) => ({
      relative,
      source: fs.readFileSync(path.join(clientSrc, relative), "utf8"),
    }));

  it("declares no class whose name is a Tailwind semantic utility", () => {
    const offenders = stylesheets.flatMap(({ relative, source }) =>
      SHADOWABLE.filter((name) =>
        new RegExp(`^\\s*\\.${name}\\s*(,|\\{)`, "m").test(source),
      ).map((name) => `${relative}: .${name}`),
    );

    expect(
      offenders,
      "An unlayered class with a utility's name overrides that utility app-wide",
    ).toEqual([]);
  });
});

describe("foundation tokens define every token in both themes", () => {
  const tokens = fs.readFileSync(path.join(clientSrc, "foundation", "tokens.css"), "utf8");

  function declaredIn(selector: string): Set<string> {
    const block = tokens.slice(tokens.indexOf(selector));
    const body = block.slice(block.indexOf("{") + 1, block.indexOf("\n}"));
    return new Set([...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((match) => match[1]));
  }

  const light = declaredIn(":root {");
  const dark = declaredIn('[data-theme="dark"] {');

  /**
   * Structure, not colour: geometry, radii, spacing, type and motion are the
   * same in both themes by design, and the scrim group is identical on purpose
   * because media does not have a theme (README §6).
   */
  const THEME_INVARIANT = /^--(s-|r-|t-|font-|rail-w|topbar-h|content-max|blur-bar|ease|scrim|onScrim|onWash|onError|error)/;

  it("overrides every themeable colour in dark", () => {
    const missing = [...light].filter(
      (token) => !THEME_INVARIANT.test(token) && !dark.has(token),
    );
    expect(
      missing,
      "A token missing from the dark block forces a component to branch on theme",
    ).toEqual([]);
  });

  it("declares no dark token that light does not define", () => {
    const orphans = [...dark].filter((token) => !light.has(token));
    expect(orphans).toEqual([]);
  });

  it("declares the tokens at :root so they reach portaled content", () => {
    // M2 promoted these out of the shell subtree. Radix portals mount on
    // <body>; a scoped block would leave every dialog and menu untokenised.
    expect(tokens).toMatch(/^:root\s*\{/m);
    expect(tokens).toMatch(/^\[data-theme="dark"\]\s*\{/m);
    expect(tokens).not.toContain('[data-theme="dark"] .dp-root');
  });

  it("keeps the shell reset off `body` so marketing keeps its own type", () => {
    // §D.7: the brochure stays on Inter. A global body font-family here would
    // put Archivo on it — the reset belongs to the shell, not the document.
    expect(tokens).not.toMatch(/^body\s*\{/m);
    expect(tokens).toContain(".dp-root {\n  background: var(--surface);");
  });
});

/**
 * THE SELECTION HIGHLIGHT (#542) — the one rule in `index.css` that is under
 * guard, and the narrowness is DECLARED rather than quiet.
 *
 * His report: *"when i highlight text in dark mode its black and white still
 * shouldnt it highlight white and change text to black? just like lightmode
 * highlights black and changes text to white?"* — `::selection` was
 * `background: #111111; color: white`, two literals with no theme branch, so a
 * dark-mode highlight painted near-black on a near-black page.
 *
 * ⚠ **`client/src/index.css` IS NOT ENROLLED IN `GUARDED_PATHS`, AND THAT IS A
 * COUNTED REMAINDER, NOT AN OVERSIGHT.** The file holds **97 further hex
 * literals** (98 before this fix) across its Tailwind base and component
 * layers — marketing type scales, legacy page chrome, the hero's blues. Most
 * are not theme-sensitive and none has been read; enrolling the whole file
 * would redden the gate on 97 unrelated declarations in a one-line bug fix,
 * which is a different job and gets its own card. **What is enrolled is the
 * rule his report is about**, so the next literal *there* reddens.
 *
 * The arm reads the DECLARATION rather than the whole file for the same reason
 * the guard above resolves every path: a substring test over 700 lines would
 * pass on a `::selection` rule that had been deleted entirely.
 */
describe("the selection highlight inverts per theme (#542)", () => {
  const indexCss = fs.readFileSync(path.join(clientSrc, "index.css"), "utf8");

  /** The `::selection { … }` body, or null if the rule is gone. */
  const selectionBody = ((): string | null => {
    const at = indexCss.indexOf("::selection");
    if (at < 0) return null;
    const open = indexCss.indexOf("{", at);
    const close = indexCss.indexOf("}", open);
    if (open < 0 || close < 0) return null;
    return indexCss.slice(open + 1, close);
  })();

  it("declares a ::selection rule at all", () => {
    // The positive control for every arm below: they all read this body, and a
    // deleted rule would make each of them vacuously true.
    expect(selectionBody, "`::selection` is gone from index.css").not.toBeNull();
  });

  it("takes both of its colours from theme tokens", () => {
    expect(selectionBody).toMatch(/background:\s*var\(--ink\)/);
    expect(selectionBody).toMatch(/color:\s*var\(--surface\)/);
  });

  it("holds no colour literal — the defect was two of them", () => {
    // `#111111` and the keyword `white`, which is what made the highlight the
    // same colour in both themes.
    const literals = [
      ...(selectionBody ?? "").matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:white|black)\b/g),
    ].map((m) => m[0]);
    expect(
      literals,
      "A literal here cannot invert: the same colour paints both themes",
    ).toEqual([]);
  });

  it("uses a pair that actually inverts between the themes", () => {
    // Reading the token table rather than trusting the names: --ink and
    // --surface must each be declared in BOTH blocks and must differ, or the
    // rule states a relationship the tokens do not deliver.
    const tokens = fs.readFileSync(path.join(clientSrc, "foundation", "tokens.css"), "utf8");
    const valueIn = (selector: string, token: string): string | null => {
      const block = tokens.slice(tokens.indexOf(selector));
      const body = block.slice(block.indexOf("{") + 1, block.indexOf("\n}"));
      const hit = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(body);
      return hit ? hit[1]!.trim() : null;
    };
    for (const token of ["--ink", "--surface"]) {
      const light = valueIn(":root {", token);
      const dark = valueIn('[data-theme="dark"] {', token);
      expect(light, `${token} is not declared in the light block`).not.toBeNull();
      expect(dark, `${token} is not declared in the dark block`).not.toBeNull();
      expect(
        light,
        `${token} is the same in both themes — the selection rule would not invert`,
      ).not.toEqual(dark);
    }
  });
});
