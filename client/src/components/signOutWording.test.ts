/**
 * #267 — one word for one action: the product says "Sign out", never "Log out".
 *
 * His ruling on the 00b frames, verbatim: *"Log out → Sign out. The Settings
 * modal already says Sign out; pick one word."* He was right that the product
 * said both — and the interesting part is that it said both in FOUR places at
 * once, which is why this arm exists rather than a one-line edit alone.
 *
 * At the ruling: `Navigation.tsx` said "Sign out" twice, `UserCard.tsx` and
 * `StudioSlimHeader.tsx` said "Log out". A customer met whichever wording the
 * surface they were on happened to carry, and nothing in the build could tell.
 *
 * The rule is checked at the SOURCE rather than through a render, because the
 * two offenders live on different surfaces with different mounts and a render
 * test would need both. What it must not do is trip on prose: this file's own
 * docblock quotes the banned words, and `AppLobby.tsx` carries a historical
 * note about a header that once held a log out control. So comments are
 * stripped first, and the arm looks only at user-visible strings.
 *
 * ⚠ It bans the WORDING, never the identifiers — `onLogout`, `useLogout`,
 * `auth.logout` and lucide's `LogOut` icon are all ordinary code and stay. A
 * ban that reached them would be the over-broad-substring class this
 * repository has now recorded seven times (`cropped` swallowing
 * "close-cropped stubble", `referencePlates` read as a leaked prompt); the
 * positive control below is what proves this one does not.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { globSync } from "node:fs";
import { join, sep } from "node:path";

const CLIENT = join(import.meta.dirname, "..");

/** Strip comments, so a docblock explaining the rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * A user-visible sign-out label: the words between JSX tags, or the value of a
 * string prop. Deliberately NOT a bare substring search for "log out" — see the
 * docblock's last paragraph.
 */
const BANNED_WORDING = /(>\s*log\s?out\s*<)|(["'`]\s*log\s?out\s*["'`])/i;

const sourceFiles = () =>
  globSync("**/*.{ts,tsx}", { cwd: CLIENT })
    .filter((name) => !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"))
    // `globSync` returns the platform separator, so a path written with "/" in
    // an assertion matches on CI and misses on this bench. Normalise once.
    .map((name) => ({ name: name.split(sep).join("/"), text: readFileSync(join(CLIENT, name), "utf8") }));

describe("#267 — the product says Sign out, and only Sign out", () => {
  it("THE SWEEP SAW THE CLIENT — an empty walk must never read as clean", () => {
    /*
      Measured while sabotage-proving this file: point the glob at a directory
      that holds no source and the ban arm below goes GREEN over a real
      offender, because a negative-only assertion passes on nothing. So the
      population is asserted before the absence is believed.

      The floor is deliberately far below the real count (700+ at writing) —
      it is here to catch a walk that found NOTHING or almost nothing, not to
      pin a number that every new file would have to move.
    */
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(200);
    expect(files.map(({ name }) => name)).toContain("components/UserCard.tsx");
  });

  it("no user-visible label anywhere in the client says 'Log out'", () => {
    const offenders = sourceFiles()
      .filter(({ text }) => BANNED_WORDING.test(code(text)))
      .map(({ name }) => name);
    expect(
      offenders,
      `These surfaces say "Log out" where the product says "Sign out" (his ruling: pick one word): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("the two surfaces his ruling named do say 'Sign out'", () => {
    /*
      A negative-only arm is green when the string is simply absent — including
      when somebody deletes the control. This is the half that proves the
      wording arrived rather than merely that the old one left.
    */
    for (const file of [
      "components/UserCard.tsx",
      "features/studio/components/StudioSlimHeader.tsx",
      "components/Navigation.tsx",
    ]) {
      expect(readFileSync(join(CLIENT, file), "utf8"), file).toContain("Sign out");
    }
  });

  it("POSITIVE CONTROL — the ban does not reach identifiers or the icon", () => {
    /*
      `onLogout`, `handleLogout`, `auth.logout` and lucide's `LogOut` icon are
      ordinary code. If this arm ever starts failing on them, the rule has
      become the over-broad-substring class it was written to avoid.
    */
    for (const innocent of [
      `<UserMenuItem icon={LogOut} label="Sign out" onClick={onLogout} />`,
      `const { mutate: logout } = trpc.auth.logout.useMutation();`,
      `import { LogOut } from "lucide-react";`,
      `onClick={handleLogout}`,
    ]) {
      expect(BANNED_WORDING.test(innocent), innocent).toBe(false);
    }
    // And it DOES catch the two real shapes, or it is proving nothing.
    expect(BANNED_WORDING.test(`<button onClick={onLogout}>Log out</button>`)).toBe(true);
    expect(BANNED_WORDING.test(`<UserMenuItem label="Log out" />`)).toBe(true);
  });
});
