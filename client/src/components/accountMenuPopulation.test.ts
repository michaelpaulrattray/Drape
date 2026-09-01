/**
 * #374 — ONE ACCOUNT MENU, AND THE KNOWN SECOND NAMED WITH ITS EXPIRY.
 *
 * The card's Bar: *"One account menu component in the tree, asserted — a guard
 * that fails if a second grows again, **since that is exactly how this one
 * arrived**."* `StudioSlimHeader`'s inline menu was not designed as a rival; it
 * grew beside `UserCard` and nobody noticed until the two had drifted on every
 * detail.
 *
 * ⚠ **THE ARM CANNOT SAY "ONLY ONE EXISTS", BECAUSE MORE THAN ONE EXISTS ON
 * PURPOSE** — his answer, verbatim: *"legacy casting studio is getting retired
 * thats the answer it doesnt need a new menu"*. So the shape is a POPULATION
 * arm: the whole set is derived from the source, compared against an enumerated
 * list, and every member of that list carries the reason it is allowed to be
 * there. A fourth reddens it. A third disappearing reddens it too, which is the
 * half that matters on the day `DrapeStudio` goes: the guard TIGHTENS rather
 * than silently passing over a stale allowance.
 *
 * ## What counts, and why the net is drawn this wide
 *
 * **Every user-visible sign-out label in the client.** Not *"a popover
 * containing one"* — that was this arm's first draft and it was wrong about the
 * one file it exists to protect: `UserCard` renders the menu's CONTENTS and
 * `Topbar.tsx` owns the `{menuOpen && …}` panel around it, so a
 * panel-shaped detector found the frozen legacy menu and missed THE account
 * menu. Caught by the arm going red on its own subject, which is the shape of
 * detector worth keeping.
 *
 * So the definition is the blunt one, and blunt is right here: an account menu
 * is the thing that offers to sign you out, and any file that offers to sign
 * you out is either this menu, an enumerated exception, or a finding. **Four
 * files, each named below with its standing.** `SettingsModal` is on the list
 * as a non-menu — a sign-out at the foot of its nav — because leaving it off
 * would mean either a special case in the matcher or an arm that is red today.
 *
 * ⚠ **`signOutWording.test.ts` IS NOT THIS ARM.** It bans the word *"Log out"*
 * and names the same files as a HARD-CODED list to prove the right wording
 * arrived. It would stay green on a fifth account menu that spelled it
 * correctly — which is every account menu anyone would write. This one derives
 * its population from the source, which is the only version that can be
 * surprised.
 *
 * ⚠ And `BoardHeader.tsx` is deliberately **not** here: it has an avatar
 * popover, and inside it a balance and a Top up button and no account actions
 * at all. That is why the #374 card's claim that it hosts the legacy menu is
 * wrong at the code, and it is corrected on the card.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = join(import.meta.dirname, "..");

/** Strip comments, so this file's own prose — and the freeze note on the
 *  legacy header — cannot be read as markup. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * A user-visible sign-out label: the words between JSX tags, or a string prop.
 * Same shape `signOutWording.test.ts` settled on, and for the same reason —
 * `onLogout`, `auth.logout` and lucide's `LogOut` are ordinary code.
 */
const SIGN_OUT_LABEL = /(>\s*sign\s?out\s*<)|(["'`]\s*sign\s?out\s*["'`])/i;

const sourceFiles = () =>
  globSync("**/*.{ts,tsx}", { cwd: CLIENT })
    .filter((name) => !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"))
    // globSync returns the platform separator; normalise so an assertion
    // written with "/" matches on CI and on this bench alike.
    .map((name) => ({
      name: name.split(sep).join("/"),
      text: readFileSync(join(CLIENT, name), "utf8"),
    }));

const signOutSurfaces = () =>
  sourceFiles()
    .filter(({ text }) => SIGN_OUT_LABEL.test(code(text)))
    .map(({ name }) => name)
    .sort();

/**
 * Every file allowed to draw one, and the reason. **A member without a reason
 * is how an allowance outlives its cause**, which is the failure mode this
 * whole card is about.
 */
const ALLOWED: Record<string, string> = {
  "components/UserCard.tsx":
    "THE account menu. Rendered by AppChrome into the topbar's account slot.",
  "features/studio/components/StudioSlimHeader.tsx":
    "FROZEN, not fixed and not deleted — his ruling on #374. One host, " +
    "pages/DrapeStudio.tsx, the admin-sealed legacy studio (#364). Expires " +
    "with that page at N8; delete this entry in the same commit.",
  "components/Navigation.tsx":
    "ORPHANED. The retired marketing nav — no file in client/src imports it. " +
    "Not reachable by anyone, and not this section's to remove.",
  "features/settings/SettingsModal.tsx":
    "NOT A MENU. A sign-out at the foot of the settings nav (#267), mounted " +
    "once by AccountSurfaces. Listed because the matcher is deliberately the " +
    "blunt one — see the docblock.",
};

describe("#374 — one account menu, and the exceptions are named", () => {
  it("THE SWEEP SAW THE CLIENT — an empty walk must never read as clean", () => {
    /*
      A population arm compared against a list is green over an empty list too.
      The floor is deliberately far below the real count (900+ at writing): it
      catches a walk that found nothing, not a number every new file must move.
    */
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(200);
    expect(files.map(({ name }) => name)).toContain("components/UserCard.tsx");
  });

  it("the detector sees both shapes a new menu would take, and no identifier", () => {
    // The two ways a row is written — children, and a label prop.
    expect(SIGN_OUT_LABEL.test(`<button onClick={onLogout}>Sign out</button>`)).toBe(true);
    expect(SIGN_OUT_LABEL.test(`<UserMenuItem label="Sign out" />`)).toBe(true);

    /*
      ⚠ And it reaches no identifier. A ban that caught `onLogout` or lucide's
      `LogOut` would be the over-broad-substring class this repository has now
      recorded seven times — the whole reason `signOutWording.test.ts` matches
      on the label shape rather than the words.
    */
    for (const innocent of [
      `const handleLogout = () => auth.logout();`,
      `import { LogOut } from "lucide-react";`,
      `trpc.auth.logout.useMutation()`,
      `/** The row that signs you out. */`,
    ]) {
      expect(SIGN_OUT_LABEL.test(innocent), innocent).toBe(false);
    }
  });

  it("EXACTLY the enumerated files draw one — a fifth is a finding", () => {
    const found = signOutSurfaces();
    const allowed = Object.keys(ALLOWED).sort();

    const unexpected = found.filter((name) => !(name in ALLOWED));
    expect(
      unexpected,
      "A new account menu grew. That is exactly how the drift this section " +
        "repaired arrived: `UserCard` is THE account menu, and a second one " +
        "diverges from it silently. Render `UserCard`, or add the file here " +
        "with the reason it is allowed to exist:\n  " + unexpected.join("\n  "),
    ).toEqual([]);

    /*
      ⚠ THE OTHER DIRECTION, AND IT IS THE ONE THAT EARNS ITS KEEP. An allowance
      that has lost its subject is not a passing test, it is a removed one. When
      `DrapeStudio` retires at N8 this arm goes red and the repair is one line —
      delete the entry — rather than nobody ever noticing that the exception was
      still being granted years after the thing it excused.
    */
    expect(
      found,
      "An enumerated account menu is gone. If that is the retirement this list " +
        "was waiting for, delete its entry from ALLOWED in the same commit.",
    ).toEqual(allowed);
  });

  it("the topbar renders THE one, and the menu is not built at the call site", () => {
    const chrome = code(readFileSync(join(CLIENT, "components/AppChrome.tsx"), "utf8"));
    expect(chrome).toMatch(/<UserCard/);
    // The account slot takes the component, never an inline menu of its own.
    expect(SIGN_OUT_LABEL.test(chrome)).toBe(false);
  });

  it("the frozen one says so, quotes him, and names its expiry", () => {
    /*
      The comment IS the deliverable — his own words on #374: it is what stops a
      future reader finding two menus, no explanation, and "fixing" it. So it is
      asserted rather than trusted, and it is asserted on the three parts that
      make it useful: the ruling, the host, and the release that ends it.
    */
    const legacy = readFileSync(
      join(CLIENT, "features/studio/components/StudioSlimHeader.tsx"),
      "utf8",
    );
    expect(legacy).toContain("legacy casting studio is getting retired");
    expect(legacy).toContain("DrapeStudio.tsx");
    expect(legacy).toContain("N8");
  });
});
