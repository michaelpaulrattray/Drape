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
      // shell. Its avatar duty moved into AppLobby.tsx, which supplies the
      // rail's account chip — so the surface is still covered, one line up.
      "client/src/pages/AppLobby.tsx",
      "client/src/components/UserCard.tsx",
      "client/src/features/studio/components/StudioSlimHeader.tsx",
      "client/src/features/boards/BoardHeader.tsx",
      "client/src/features/profile/ProfileTab.tsx",
    ]) {
      expect(source(file)).toMatch(/ProfileAvatar|ProfileCover/);
    }

    const settings = source("client/src/features/profile/ProfileTab.tsx");
    expect(settings).toContain("<ProfileCover");
    expect(settings).toContain("<ProfileAvatar");
    expect(settings).not.toContain("defaultAvatar");
    expect(settings).not.toContain("defaultBanner");
  });
});
