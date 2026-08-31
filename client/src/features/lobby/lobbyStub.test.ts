/**
 * #302 — the lobby stub contract.
 *
 * The founder ordered Home and Library stubbed and Canvas blanked while they
 * are redesigned. Three things about that are easy to undo by accident, and
 * each of the three is what one arm below is for:
 *
 *  1. **The URLs must keep resolving.** A stubbed page is still a place; his
 *     rail keeps all eight destinations, so `/app/models` returning a 404 would
 *     be a broken rail rather than a stubbed page.
 *  2. **The stub must draw no controls.** His own standing rule is that a
 *     placeholder *names a place, never a capability* — a button that does
 *     nothing is the exact failure the rule exists to prevent, and it is the
 *     easiest thing for a later "let's make this useful" edit to add.
 *  3. **Nothing on the server may be unhooked with it.** `models`,
 *     `wardrobe.garments` and `wardrobe.model` still serve the legacy studio
 *     and the wardrobe workspace, and `models.deleteAvailability` is read by
 *     Casting V2 itself. A tidy that follows the unmounting and removes them
 *     breaks live surfaces.
 *
 * Source-read rather than rendered, like `section02-guard.test.ts` and
 * `r7-cast-deletion-ui.test.ts` beside it: these are facts about what the tree
 * says, and `pnpm test` runs in a node environment with no DOM.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const APP = "client/src/App.tsx";
const LOBBY = "client/src/pages/AppLobby.tsx";
const STUB = "client/src/features/lobby/LobbyStub.tsx";

/** The five URLs `AppLobby` has always answered. All five stay. */
const LOBBY_URLS = ["/app", "/app/boards", "/app/models", "/app/garments", "/app/looks"];

describe("#302 — the lobby is stubbed, and stays a place", () => {
  it("routes all five lobby URLs to AppLobby, so a stubbed page is not a 404", () => {
    const app = source(APP);
    for (const url of LOBBY_URLS) {
      expect(
        app,
        `${url} must still be routed to AppLobby — a stub that 404s is a broken rail`,
      ).toContain(`<Route path="${url}" component={AppLobby} />`);
    }
    /* The set is asserted as a SET, not one-by-one: a sixth appearing silently
       is the shape that made `LOBBY_ROUTES` and the router disagree before. */
    const routed = [...app.matchAll(/<Route path="(\/app(?:\/[a-z]+)?)" component=\{AppLobby\} \/>/g)]
      .map((m) => m[1])
      .sort();
    expect(routed).toEqual([...LOBBY_URLS].sort());
  });

  it("mounts the stub on every lobby URL and mounts none of the three old views", () => {
    const lobby = source(LOBBY);
    /* Positive first — the page must actually render the stub, three times over
       (Home, Canvas, Library), each naming its own place. */
    expect(lobby).toContain("import { LobbyStub } from '@/features/lobby/LobbyStub';");
    expect(lobby).toContain('title="Home"');
    expect(lobby).toContain('title="Canvas"');
    expect(lobby).toContain('title="Library"');
    /* Then the negative, which is only meaningful because the positives passed. */
    for (const view of ["HomeView", "LibraryView", "BoardsView"]) {
      expect(lobby, `${view} must stay unmounted while the page is stubbed`).not.toMatch(
        new RegExp(`<${view}[\\s/>]`),
      );
      expect(lobby).not.toMatch(new RegExp(`import\\s*\\{[^}]*\\b${view}\\b`));
    }
  });

  it("draws no control of any kind — a stub names a place, never a capability", () => {
    const stub = source(STUB);
    /* Read the CODE, not the docblock: the docblock quotes him saying the word
       "button", and a naive search of the whole file would fail on his words. */
    const code = stub.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("<h1");
    expect(code).toContain("{title}");
    expect(code).toContain("{note}");
    for (const control of ["<button", "<a ", "<Link", "onClick", "href", "role=", "tabIndex"]) {
      expect(code, `LobbyStub must not draw \`${control}\` — a dead control is the forbidden thing`)
        .not.toContain(control);
    }
  });

  it("takes its type from the foundation, never from the page it replaces", () => {
    /*
      His redesign pack, §"Existing does not mean finished": a section that
      touches a working feature brings it onto the grammar. The pages this stub
      replaces are, in his words, "placeholders that accumulated, not
      decisions" — and the first draft of this component quoted `HomeView`'s
      `fontWeight: 700` straight out of one of them, which the foundation
      README forbids ("weights 400 and 500 only"). The arm is on the CLASS: no
      hand-set type of any kind, so the next edit cannot reintroduce it.
    */
    const code = source(STUB).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain('className="dp-headline"');
    expect(code.match(/className="dp-body"/g) ?? []).toHaveLength(2);
    for (const handSet of ["fontSize", "fontWeight", "letterSpacing", "lineHeight", "font:"]) {
      expect(code, `LobbyStub must not set \`${handSet}\` — the foundation classes own the type`)
        .not.toContain(handSet);
    }
    /* Colour and spacing come from tokens, never from a literal. */
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const spaced of [...code.matchAll(/(marginTop|paddingTop):\s*'([^']+)'/g)]) {
      expect(spaced[2], `${spaced[1]} must come from the --s-* scale`).toMatch(/^var\(--s-\d+\)$/);
    }
  });

  it("keeps the legacy studio route, because the wardrobe workspace still lives there", () => {
    /* His instruction unhooks the legacy studio from the LOBBY. The route
       itself is the wardrobe workspace's only address and stays until N8. */
    expect(source(APP)).toContain('<Route path="/studio" component={DrapeStudio} />');
  });

  it("removes no server endpoint the wardrobe, the studio or Casting V2 still call", () => {
    /* Working law 4 — assert against the router the client actually calls, not
       against a second list of names kept here. */
    const wardrobe = source("server/routes/wardrobe.ts");
    for (const procedure of ["listMinted", "listDrafts"]) {
      expect(wardrobe, `wardrobe.model.${procedure} still has callers outside the lobby`)
        .toContain(procedure);
    }
    /* `models.deleteAvailability` is read by CastingV2.tsx and CastingRoom.tsx —
       it is a flag check, never Library functionality, and unhooking the lobby
       must not take it. */
    expect(source("client/src/pages/CastingV2.tsx")).toContain("models.deleteAvailability");
    expect(source("client/src/pages/CastingRoom.tsx")).toContain("models.deleteAvailability");
  });
});
