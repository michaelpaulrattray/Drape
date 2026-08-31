import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { RAIL_DESTINATIONS } from "./Rail";

/**
 * Section 02's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/02-topbar-and-rail.md`).
 *
 * Three of the section's items are FOUNDER RULINGS rather than preferences, and
 * his brief names the first of them as the single thing in the PR most likely
 * to be "improved" into a lie: *"Do not make the search an input."* A rule that
 * survives only in a reviewer's head survives exactly until the reviewer is a
 * different person, which is why the mechanizable half lives here.
 *
 * These are SOURCE guards, in the shape of `section00b-guard.test.ts` and
 * `token-guard.test.ts`, plus one arm that reads the destination list as DATA
 * rather than as text. The limit is stated rather than implied: a source read
 * cannot see a cascade, a tab order or a render. The things it genuinely cannot
 * answer — does Tab actually skip the search, does the bar hold together at
 * 1024/1440/1920, do both themes look right — were driven at the running app
 * and recorded in `docs/specs/CHROME_SECTION_02_EVIDENCE.md`.
 *
 * ⚠ **EVERY ABSENCE ARM BELOW IS PAIRED WITH A POSITIVE CONTROL** — a synthetic
 * string the same matcher must reject. An arm that only asserts absence is
 * green when its subject is deleted, and green when its own regex is wrong;
 * both have happened in this repo (working law 2).
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..");

const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

const TOPBAR = read("foundation/Topbar.tsx");
const RAIL = read("foundation/Rail.tsx");
const APP_SHELL = read("foundation/AppShell.tsx");
const CHROME_STUBS = read("foundation/ChromeStubs.tsx");
const FOUNDATION_CSS = read("foundation/foundation.css");
const UTILITY_MENU = read("features/lobby/LobbyUtilityMenu.tsx");
const BUG_BUTTON = read("features/lobby/ReportBugButton.tsx");
const LOBBY = read("pages/AppLobby.tsx");
/*
  #278 — THE CHROME COMPOSER, which used to be `AppLobby.tsx` and is now
  `AppChrome.tsx`.

  Four arms in this file are about the surface that COMPOSES the topbar cluster,
  not about the lobby page: does it mount the bug button, does it hand the rail
  invented members, does it draw a queue pill over nothing, does it bind ⌘K.
  When the composition moved out of the lobby so every casting page could have
  it, those arms went green against a file that no longer contains their
  subject — which is a guard passing because its subject left, the failure mode
  this file's own header warns about.

  They are REPOINTED rather than relaxed: same assertions, aimed at whoever
  actually composes the chrome today.
*/
const CHROME = read("components/AppChrome.tsx");

/*
  Comments describe the rules; only the code has to obey them. Stripping block
  and line comments is what keeps a docblock that QUOTES a violation from
  failing the arm that checks the violation is gone — which has happened in this
  family of guards before (00b, first run).
*/
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the search names a place and can never take a keystroke", () => {
  /**
   * His ruling, verbatim: *"The search must not be an `<input>`. It's a span,
   * not focusable, no ⌘K binding. A text field that takes keystrokes and does
   * nothing claims a capability, which is the one thing a stub may never do."*
   *
   * The tag is the control. A `<span>` is out of the tab order by construction;
   * an `<input disabled>` is still announced as a field, and an `<input
   * readOnly>` still takes focus and still swallows the caret.
   */
  const SEARCH_IS_A_SPAN = /<span className="dp-search" aria-disabled="true"/;

  it("renders as a span with aria-disabled and says why in its title", () => {
    expect(CHROME_STUBS).toMatch(SEARCH_IS_A_SPAN);
    expect(CHROME_STUBS).toMatch(/title="Search — not built yet"/);
  });

  it("rejects every shape the improvement would take", () => {
    for (const sabotage of [
      '<input className="dp-search" aria-disabled="true" />',
      '<input className="dp-search" readOnly />',
      '<input className="dp-search" disabled />',
      '<span className="dp-search" contentEditable>',
    ]) {
      expect(SEARCH_IS_A_SPAN.test(sabotage), sabotage + " must not read as inert").toBe(false);
    }
  });

  const FIELD_TAG = /<(input|textarea)\b/;

  it("no field element exists anywhere in the shell's chrome", () => {
    for (const [name, source] of [
      ["ChromeStubs", CHROME_STUBS],
      ["Topbar", TOPBAR],
      ["Rail", RAIL],
    ] as const) {
      expect(FIELD_TAG.test(code(source)), name + " grew a field").toBe(false);
    }
    expect(FIELD_TAG.test('<input placeholder="Search frames, prompts, avatars…" />')).toBe(true);
  });

  /**
   * The key chips describe the shortcut the feature WILL have. Binding them to
   * nothing is the same lie in a different shape — a keystroke that swallows
   * itself — so the handler does not exist rather than existing and doing
   * nothing. The matcher looks for the modifier-key reading, which is what any
   * ⌘K implementation must do however it is spelled.
   */
  const COMMAND_K = /metaKey|ctrlKey|key\s*===\s*["']k["']|useHotkey/i;

  it("nothing in the chrome reads a modifier key", () => {
    for (const [name, source] of [
      ["ChromeStubs", CHROME_STUBS],
      ["Topbar", TOPBAR],
      ["Rail", RAIL],
      ["AppLobby", LOBBY],
      ["AppChrome", CHROME],
    ] as const) {
      expect(COMMAND_K.test(code(source)), name + " bound a shortcut").toBe(false);
    }
  });

  it("rejects each spelling of a ⌘K binding", () => {
    for (const sabotage of [
      'if ((event.metaKey || event.ctrlKey) && event.key === "k") open();',
      'useHotkey("k", { meta: true }, open);',
      "if (event.key === 'k' && event.ctrlKey) open();",
    ]) {
      expect(COMMAND_K.test(sabotage), sabotage + " must read as a binding").toBe(true);
    }
  });
});

describe("the rail is eight, and its comment records the reversal", () => {
  /**
   * Read as DATA rather than as text: the list is the product's own, imported,
   * so a regex cannot agree with a source line that no longer runs.
   *
   * ⚠ **THE ORDER MOVED, AND HE MOVED IT** (#321 defect b, 2026-08-30,
   * verbatim): *"you have Cinema before Casting. My section-02 brief said that,
   * and **the brief was wrong**; the prototype is … Templates · Casting ·
   * Cinema · Assets · Library."* This arm previously pinned Cinema BEFORE
   * Casting, faithfully, because that is what §2a of his own brief said. It was
   * a guard doing its job over an instruction its author later corrected — so
   * the correction is recorded here rather than the arm quietly re-sorted, and
   * the rest of section 02 stands untouched.
   */
  it("holds eight destinations with Cinema after Casting", () => {
    const order = RAIL_DESTINATIONS.map((destination) => destination.id);
    expect(order).toEqual([
      "home",
      "create",
      "canvas",
      "templates",
      "casting",
      "cinema",
      "assets",
      "library",
    ]);
  });

  it("Cinema is inert — it names a place and has nowhere to go", () => {
    const cinema = RAIL_DESTINATIONS.find((destination) => destination.id === "cinema");
    expect(cinema, "Cinema left the rail").toBeDefined();
    expect(cinema?.href, "Cinema grew a route before Cinema exists").toBeUndefined();
  });

  /**
   * His third instruction on the rail, verbatim: *"Then the shape is fixed at
   * eight — update the comment so the next reader sees a reversal rather than a
   * contradiction."* A file whose docblock still says seven while its list holds
   * eight reads to the next author as a violation to correct.
   */
  it("the docblock says eight and names F1 as reversed", () => {
    expect(RAIL).toMatch(/EIGHT destinations/);
    expect(RAIL).toMatch(/REVERSAL of founder ruling F1/);
    expect(RAIL).not.toMatch(/Seven destinations, from now on/);
  });

  it("rejects the sentence that was there", () => {
    const before = "**Seven destinations, from now on** (founder ruling F1, 2026-07-31)";
    expect(/Seven destinations, from now on/.test(before)).toBe(true);
  });
});

describe("the account is in one corner and the workspace in the other", () => {
  /**
   * His ruling, verbatim: *"The account chip moves to the topbar, and the rail's
   * foot gets a gear instead. Same face in both corners doing two different
   * things is ambiguous. The face is you, the gear is settings."*
   */
  it("the topbar owns the chip and its menu", () => {
    expect(TOPBAR).toMatch(/className="dp-accountchip"/);
    expect(TOPBAR).toMatch(/className="dp-account-menu"/);
  });

  it("the rail kept none of it", () => {
    expect(code(RAIL)).not.toMatch(/dp-account/);
    expect(/dp-account/.test('<button className="dp-account">'), "the matcher must see it").toBe(
      true,
    );
  });

  /**
   * ⚠ The gear is still a gear; it is no longer Lucide's (#280, his amendment).
   * This arm read `<Settings size=` until the house set landed — kept pointing
   * at the same thing rather than deleted, because the ruling that put a gear
   * in the foot and the ruling that chose which gear are two different rulings
   * and both are still live.
   */
  it("the rail's foot is a gear, and there is no second avatar in it", () => {
    expect(RAIL).toMatch(/<Icon d=\{P\.settings\} size=/);
    expect(RAIL).toMatch(/className="dp-memberstack__add"/);
  });

  /**
   * ⚠ **NO INVENTED FACES.** The prototype draws two members plus the `+`, and
   * there is no members API in this product — no router, no query, no table. His
   * rule from the 00b frames: *"A number in a screenshot that no server produces
   * is a lie that survives into the build."* The stack may only draw what a
   * caller hands it, so the guard is that nothing here CONSTRUCTS a member.
   */
  it("the member stack draws only what it is given", () => {
    expect(RAIL).toMatch(/workspace\?\.members \?\? \[\]/);
    expect(code(RAIL)).not.toMatch(/const\s+(MEMBERS|DEMO_MEMBERS|SAMPLE_MEMBERS)\b/);
    expect(/const\s+MEMBERS\b/.test("const MEMBERS = [{ id: '1', label: 'Dani' }];")).toBe(true);
  });

  /**
   * ⚠ **THIS ARM USED TO SAY `no surface hands it any`, AND HIS RULING
   * REPLACED IT** (#281, 2026-08-30, verbatim and entire): *"Show your own
   * face beside the +, but keep it stubbed out until membership exists."*
   *
   * The old arm was `expect(code(CHROME)).not.toMatch(/members:/)`. Deleting
   * it outright would have removed the only thing standing between this rail
   * and two invented colleagues, so it is **narrowed rather than dropped**:
   * the stack may be handed the SIGNED-IN USER and nothing else.
   *
   * The distinction that makes both his rulings true at once is that the
   * constraint was never *"draw no faces"* — it was his own 00b rule, *"a
   * number in a screenshot that no server produces is a lie."* `user` is a
   * real `users` row from `auth.me`. Two named colleagues are not.
   */
  it("the chrome hands the stack exactly one member, and it is the signed-in user", () => {
    const chrome = code(CHROME);
    /* Guarded at the CONDITION, because `members` unguarded by `user` would
       draw a face for a signed-out visitor — a person the server did not
       produce, which is the same defect wearing his ruling as cover. */
    expect(chrome).toMatch(/members:\s*user\s*\n?\s*\?\s*\[/);
    /* Exactly one entry: one `id:` inside the members literal. */
    const block = chrome.match(/members:\s*user[\s\S]*?onOpenSettings/)?.[0] ?? "";
    expect(block, "the matcher must find the members block").toContain("SELF_MEMBER_ID");
    expect(block.match(/\bid:/g) ?? []).toHaveLength(1);
    /* And its face is the account chip's own, pointed at the same row — so
       the rail and the topbar cannot drift into two different people. The
       NAME is the next arm's subject, not this one's. */
    expect(block).toMatch(/<ProfileAvatar\s+src=\{avatarUrl\}\s+identity=\{user\}/);
  });

  /**
   * ⚠ **THE INVENTED-MEMBER TRIPWIRE, which is what the old arm was really
   * for.** A literal name in the members list is the failure his own instinct
   * named — *"a stack of one person is not a member stack"* — and it is the
   * shape a well-meaning "let's make it look right" change takes.
   */
  it("no member is written into the source rather than read off a row", () => {
    const block = code(CHROME).match(/members:\s*user[\s\S]*?onOpenSettings/)?.[0] ?? "";
    expect(block, "the matcher must find the members block").toContain("members:");
    /* The name is READ off the row. `?? "You"` is a fallback for a null name,
       not a second person — hence `user.name` must appear and no bare string
       may open the label. */
    expect(block).toMatch(/label:\s*user\.name/);
    expect(block).not.toMatch(/label:\s*["'`]/);
    expect(
      /label:\s*["'`]/.test("members: user ? [{ id: '1', label: 'Dani' }] : []"),
      "positive control",
    ).toBe(true);
  });

  /**
   * ⚠ **THE OTHER HALF OF HIS SENTENCE — *"but keep it stubbed out"*.** He
   * asked for *"make it live"* on 2026-08-30 morning and then ruled the stub
   * that evening; the face is the part that changed and the inertness is the
   * part he explicitly kept. There is still no Members surface, no endpoint
   * and no membership table, so an avatar that made this block look finished
   * would be the dead control D-180 forbids with a friendlier picture on it.
   */
  it("the face does not make Invite live", () => {
    expect(RAIL).toMatch(/className="dp-invite"[\s\S]{0,120}aria-disabled="true"/);
    expect(RAIL).toMatch(/title="Invite — not built yet"/);
    /* Not a button, not a link, and no click handler anywhere in the block. */
    const foot = RAIL.match(/<span className="dp-invite"[\s\S]*?<\/span>\s*\n\s*\{workspace/)?.[0] ?? "";
    expect(foot, "the matcher must find the invite block").toContain("dp-memberstack");
    expect(foot).not.toMatch(/onClick|<button|<Link|href=/);
    expect(/onClick/.test('<span className="dp-invite" onClick={go}>'), "positive control").toBe(
      true,
    );
    /* And the surface it would open still does not exist. */
    expect(code(CHROME)).not.toMatch(/members-and-invites|\/app\/members/);
  });

  /** The shell still carries the prop; only its destination moved. */
  it("the shell hands the account to the topbar and the workspace to the rail", () => {
    expect(APP_SHELL).toMatch(/<Rail current=\{current\} workspace=\{workspace\} \/>/);
    expect(APP_SHELL).toMatch(/<Topbar[^>]*account=\{account\}/);
  });
});

describe("the brand wordmark left the topbar", () => {
  /**
   * §1a: *"The `BrandOrb` already carries the brand at the top of the rail, two
   * inches away. Remove it; the space belongs to the project switcher."*
   */
  it("the topbar names neither the constant nor the block", () => {
    expect(code(TOPBAR)).not.toMatch(/BRAND_NAME|dp-brandblock/);
    expect(/dp-brandblock/.test('<span className="dp-brandblock">'), "the matcher must see it").toBe(
      true,
    );
  });

  it("the orb still carries the brand on the rail", () => {
    expect(RAIL).toMatch(/<BrandOrb \/>/);
  });
});

describe("what's new promises nothing", () => {
  /**
   * His words on #228: *"a stub names a place, never a capability, and never
   * carries an unread dot."* The prototype's `barIcons` carries `dot: true` on
   * exactly this one.
   */
  it("carries no dot of any spelling", () => {
    /*
      NOT `\bdot\b`. That was the first shape, and its own positive control
      killed it in one run: `_` is a word character, so there is no boundary
      before `dot` in `dp-iconbtn__dot` and the matcher read the sabotage as
      clean. The arm would have been green while a dot sat on the icon.
    */
    const DOT = /dot\b|badge|unread/i;
    expect(DOT.test(code(CHROME_STUBS))).toBe(false);
    for (const sabotage of [
      '<span className="dp-iconbtn__dot" />',
      "{ title: \"What's new\", dot: true }",
      "{hasDot ? <Dot /> : null}",
      '<span className="dp-badge" />',
    ]) {
      expect(DOT.test(sabotage), sabotage + " must read as a promise").toBe(true);
    }
  });
});

/*
  ⚠ **TWO OF THIS SECTION'S RULES ARE DELIBERATELY NOT GUARDED HERE, BECAUSE A
  WIDER ARM ALREADY OWNS THEM — and a second copy is working law 4 pointed at
  the suite.**

  §3's *"do not thread `projectId` anywhere"* is `section00b-guard.test.ts`'s
  own arm, and it WALKS THE WHOLE CLIENT TREE rather than this section's files,
  which is the stronger reading: the failure it guards against is somebody
  threading a project id through a query "ready for later", and by definition
  that happens somewhere else.

  His queue-pill ruling — *"The queue pill hard-codes `#E2685A`. That's a token
  violation in my file — use `--accentSolid`"* — is `token-guard.test.ts`'s. It
  refuses ANY hex outside the two carved-out files, and `foundation.css` is not
  one of them, so a pill copying the literal fails the suite whatever this file
  says. Writing the literal here a second time would only have added an
  offender for that guard to find, which is exactly what it did on the first
  run of this file.
*/

describe("report a bug is one click", () => {
  /**
   * §1d, his reason verbatim: *"Two clicks deep gets you fewer bug reports,
   * which is backwards."* The row left the help menu and became its own icon;
   * the form did not change, it moved into `FeedbackForm` so both entrances
   * share one copy and cannot drift.
   */
  it("the topbar button exists and submits the same report", () => {
    expect(BUG_BUTTON).toMatch(/className="dp-iconbtn"/);
    expect(BUG_BUTTON).toMatch(/title="Report a bug"/);
    expect(BUG_BUTTON).toMatch(/mode="bug"/);
    expect(CHROME).toMatch(/<ReportBugButton \/>/);
  });

  it("the help menu no longer offers it as a row", () => {
    expect(code(UTILITY_MENU)).not.toMatch(/label="Report a bug"/);
    expect(/label="Report a bug"/.test('<MenuItem icon={Bug} label="Report a bug" />')).toBe(true);
  });

  /**
   * His #267/#268 corrections, and section 02's own list of what the menu keeps.
   * Theme, verbatim: *"A greyed row saying Theme reads as 'theming isn't built'
   * while the product visibly themes."* Cookie preferences was his open
   * question, answered at the code: no consent mechanism, no third-party
   * trackers, one strictly-necessary session cookie — nothing to govern.
   */
  it("Theme and Cookie preferences are gone, not greyed", () => {
    expect(code(UTILITY_MENU)).not.toMatch(/label="Theme"|label="Cookie preferences"/);
    expect(/label="Theme"/.test('<StubItem icon={SunMoon} label="Theme" />')).toBe(true);
  });

  it("what it keeps is what the brief says it keeps", () => {
    expect(UTILITY_MENU).toMatch(/label="Send feedback"/);
    expect(UTILITY_MENU).toMatch(/label="Documentation"/);
    expect(UTILITY_MENU).toMatch(/label="Keyboard shortcuts"/);
  });
});

describe("nothing draws a queue pill yet", () => {
  /**
   * The pill is NOT built: it needs a real jobs feed, and `3 running · 40s` over
   * nothing is a lie about what the studio is doing. His own words on the 00b
   * frames: *"A number in a screenshot that no server produces is a lie that
   * survives into the build. Leave both spaces."*
   *
   * The colour it will use when it does land is a founder ruling of its own and
   * is guarded elsewhere — see the note above on `token-guard.test.ts`, which
   * refuses the literal in `foundation.css` whatever this file says.
   */
  it("leaves the space empty", () => {
    expect(code(CHROME)).not.toMatch(/dp-queue|running ·/);
    expect(/running ·/.test("<span>3 running · 40s</span>")).toBe(true);
  });
});

describe("the member stack is the CURRENT prototype's, and its fill is his ruling", () => {
  /**
   * #281, his verbatim corrections after looking at the live rail: *"`margin-
   * right` is `-6px`, not `-7px`; and member faces are flat per-member colours,
   * not a gradient — the gradient belongs to the account avatar."*
   *
   * ⚠ **BOTH ARE THE SAME FACT: the stack was built from the STALE prototype.**
   * The old Canvas pack draws 22px faces at `-7px` with a per-face
   * `linear-gradient(160deg,…)`; the current studio pack
   * (`design_handoff_studio/Klieg Studio.dc.html:81`) draws 21px faces at
   * `-6px` with a per-member `background`. The shipped block took its SIZE from
   * the current pack and its overlap and fill from the stale one — which is his
   * own *"you're reading the stale prototype"* complaint wearing CSS.
   *
   * So these arms exist to stop a future edit re-reading the wrong pack. A
   * source read cannot see a cascade; the rendered rail was looked at in both
   * themes and the frames are on the PR (law 6).
   */
  const faceRule = /\.dp-memberstack__face\s*\{[^}]*\}/;

  it("the faces overlap by the current pack's -6px", () => {
    const rule = code(FOUNDATION_CSS).match(faceRule)?.[0] ?? "";
    expect(rule, "the matcher must find the rule at all").toMatch(/margin-right/);
    expect(rule).toMatch(/margin-right:\s*-6px/);
    expect(rule).not.toMatch(/margin-right:\s*-7px/);
    expect(/margin-right:\s*-7px/.test("margin-right: -7px;"), "positive control").toBe(true);
  });

  it("a face is flat; the gradient stays on the account avatar", () => {
    const rule = code(FOUNDATION_CSS).match(faceRule)?.[0] ?? "";
    expect(rule, "the matcher must find the rule at all").toMatch(/background/);
    expect(rule).not.toMatch(/linear-gradient/);
    expect(
      /linear-gradient/.test("background: linear-gradient(160deg, var(--media), var(--dashed));"),
      "positive control",
    ).toBe(true);

    /* The other half of his sentence: the avatar KEEPS it. An arm that only
       banned the gradient would pass just as well with it deleted everywhere,
       which is not what he ruled. */
    const account = code(FOUNDATION_CSS).match(/\.dp-account\s*\{[^}]*\}/)?.[0] ?? "";
    expect(account, "the matcher must find .dp-account").toMatch(/border-radius/);
    expect(account).toMatch(/linear-gradient\(160deg/);
  });

  /**
   * ⚠ **THE `+` HAS NO HOVER, AND ITS ABSENCE IS THE DECISION.** He asked for
   * *"Make it live"* and *"give the `+` its hover back"* in one breath; the
   * first cannot be done — there is no Members surface, no endpoint and no
   * membership in the schema — so a hover response here would be an affordance
   * on a control that goes nowhere. The house stub pattern he ratified says the
   * same thing out loud: `.dp-rail__item--stub:hover` and
   * `.dp-menuitem--stub:hover` both CANCEL hover.
   *
   * This arm is a TRIPWIRE, not a preference: it fails the day someone adds the
   * hover, and the fix is to land it WITH the live destination, not to delete
   * the arm.
   */
  it("the + gets its hover back only when Invite has somewhere to go", () => {
    expect(code(FOUNDATION_CSS)).not.toMatch(/\.dp-memberstack__add:hover/);
    expect(
      /\.dp-memberstack__add:hover/.test(".dp-memberstack__add:hover { border-color: var(--ink); }"),
      "positive control",
    ).toBe(true);
    /* The premise of the hold, asserted rather than remembered. */
    expect(RAIL).toMatch(/className="dp-invite"[\s\S]{0,120}aria-disabled="true"/);
  });
});
