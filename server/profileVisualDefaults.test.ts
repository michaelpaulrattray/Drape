import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getProfileVisualDefaults,
} from "../client/src/features/profile/ProfileVisual";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("profile visual defaults", () => {
  it("is stable for one account and varied across accounts", () => {
    const first = getProfileVisualDefaults({
      name: "Ari",
      email: "ari@example.com",
    });
    const replay = getProfileVisualDefaults({
      name: "Different display name",
      email: "ari@example.com",
    });
    const second = getProfileVisualDefaults({
      name: "Bo",
      email: "bo@example.com",
    });

    expect(first).toEqual(replay);
    expect(first.avatar).toMatch(/^data:image\/svg\+xml/);
    expect(first.cover).toMatch(/^data:image\/svg\+xml/);
    expect(second).not.toEqual(first);
    expect(decodeURIComponent(first.avatar)).not.toContain("<image");
    expect(decodeURIComponent(first.cover)).not.toContain("<image");
  });

  it("puts resilient defaults on every main account surface", () => {
    for (const file of [
      // LobbyRail.tsx was deleted at M2 when the lobby adopted the foundation
      // shell. Its avatar duty moved into AppLobby.tsx, which supplied the
      // rail's account chip — so the surface stayed covered, one line up.
      //
      // #278 moved it ONE MORE LINE UP, for the same reason and to everyone's
      // benefit: the account chip now lives in AppChrome.tsx, which every
      // in-app page mounts, so this arm covers the casting surfaces too rather
      // than the lobby alone. The lobby is not listed twice — it has no avatar
      // of its own any more, and asserting one there would be asserting a copy.
      //
      // SECTION 04 (#374, 2026-09-01) — `UserCard.tsx` came OFF this list, and
      // for the third time it is a move rather than a loss. The account menu
      // deliberately draws no avatar now; the founder's §2a: *"You just clicked
      // the avatar to open this; repeating it 30px below tells you nothing and
      // costs the width that makes the two lines fit."* The avatar for that
      // surface is the CHIP — the same `ProfileAvatar` call, in `AppChrome.tsx`
      // above, one line up, still asserted. Listing the menu as well would be
      // asserting a copy, which is the reason the lobby is not listed twice.
      "client/src/components/AppChrome.tsx",
      "client/src/features/studio/components/StudioSlimHeader.tsx",
      "client/src/features/boards/BoardHeader.tsx",
      /*
        SECTION 03 (2026-09-01) — `ProfileTab.tsx` is gone with the five modals
        it belonged to, and the settings surface it covered is now the Profile
        section of the one Settings modal. Same duty, new address.
      */
      "client/src/features/settings/sections/ProfileSection.tsx",
      "client/src/features/settings/sections/MembersSection.tsx",
    ]) {
      expect(source(file)).toMatch(/ProfileAvatar|ProfileCover/);
    }

    const settings = source("client/src/features/settings/sections/ProfileSection.tsx");
    expect(settings).toContain("<ProfileAvatar");
    expect(settings).not.toContain("defaultAvatar");
    expect(settings).not.toContain("defaultBanner");

    /*
      ⚠ **`<ProfileCover` IS NO LONGER ASSERTED ANYWHERE, AND THAT IS A STATED
      CONSEQUENCE RATHER THAN A LOOSENED ARM.** The cover was the banner, and
      section 03 removed the banner upload — the only control that ever SET one,
      for a picture no surface in the product ever displayed (`AppChrome.tsx`
      carries the reading). `ProfileCover` itself is untouched in
      `ProfileVisual.tsx` and its defaults are still proven by the arm above, so
      the day a surface wants a cover it is there. Asserting a cover on a
      surface that does not draw one would be asserting a component into
      existence, which is the opposite of what this suite is for.
    */
    expect(source("client/src/features/profile/ProfileVisual.tsx")).toContain(
      "export function ProfileCover",
    );
  });
});
