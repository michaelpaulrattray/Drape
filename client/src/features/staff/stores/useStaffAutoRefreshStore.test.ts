import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #453 — THE SHARED AUTO-REFRESH SWITCH, DRIVEN.
 *
 * His reply #104: *"if i toggle it on its on for all pages not just 1."*
 *
 * ⚠ **THESE ARMS DRIVE THE REAL STORE, THEY DO NOT READ ITS SOURCE.** The
 * source-shaped half of this card — that no page kept a private copy — lives in
 * `section05-guard.test.ts` and is derived from the pages folder. This file
 * answers the other question: given a browser, does the thing actually
 * remember, and does it survive a browser that refuses to.
 *
 * ⚠ **THE ENVIRONMENT IS `node`, SO THERE IS NO `window` UNLESS ONE IS PUT
 * THERE** — which is convenient rather than awkward: the denial arm is the
 * default state of this runner, so a store that touched storage unguarded could
 * never have reached a green suite.
 */

/** A `localStorage` good enough to prove a round trip, and nothing more. */
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    /** Test-only view of what was actually written. */
    dump: () => Object.fromEntries(map),
  };
}

/** A browser that throws on every access — Safari private mode, a locked profile. */
const hostileStorage = {
  get getItem(): never {
    throw new Error("The operation is insecure.");
  },
  get setItem(): never {
    throw new Error("The operation is insecure.");
  },
};

/**
 * Loads a FRESH copy of the store against the given storage. The store reads
 * once at creation, so the module cache has to go with it — otherwise every arm
 * after the first would be testing the first arm's browser.
 */
async function loadStore(storage: unknown) {
  vi.resetModules();
  vi.stubGlobal("window", { localStorage: storage });
  return import("./useStaffAutoRefreshStore");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

/*
  ⚠ THE CARD NUMBER IS IN THIS COMMENT AND NOT IN THE `describe` STRING, ON
  PURPOSE. `#453` is a valid three-digit hex shorthand, so the token guard reads
  an issue number in a string literal as a colour (`token-guard.test.ts`, #211).
  Its documented workaround is to keep the reference in a comment, and taking
  that road rather than adding a carve-out matters: a carve-out would stop the
  colour guard reading this whole file, to spare four characters in a title.
*/
describe("card 453 — one auto-refresh switch for the whole staff panel", () => {
  it("a browser that has never been told anything gets the default, and the default is ON", async () => {
    const store = await loadStore(fakeStorage());
    /*
      ⚠ THE EXPECTED VALUE IS IMPORTED, NOT TYPED. A restated `true` here would
      still pass the day somebody changed the default and forgot this file, which
      is the mirrored-test failure: the arm becomes a second copy of the thing it
      is meant to check. What it asserts is that the STORE agrees with the
      CONSTANT — and the constant is what the card and his page quote.
    */
    expect(store.useStaffAutoRefreshStore.getState().autoRefresh).toBe(
      store.STAFF_AUTO_REFRESH_DEFAULT,
    );
    expect(store.STAFF_AUTO_REFRESH_DEFAULT, "his landing page has polled since it was built").toBe(
      true,
    );
  });

  it("what he last chose is what he gets back — and it is READ, not defaulted", async () => {
    /*
      ⚠ THIS IS THE ARM THAT EARNS THE OTHERS. The stored value is `"0"` and the
      default is `true`, so the two answers differ: a store that quietly ignored
      storage and returned its default would be GREEN on a seed of `"1"` and is
      RED here. The discriminating seed is the whole point.
    */
    const first = await loadStore(fakeStorage());
    const key = first.STAFF_AUTO_REFRESH_STORAGE_KEY;

    const storage = fakeStorage({ [key]: "0" });
    const store = await loadStore(storage);
    expect(store.useStaffAutoRefreshStore.getState().autoRefresh).toBe(false);
    expect(store.STAFF_AUTO_REFRESH_DEFAULT).toBe(true);
  });

  it("setting it writes it down, under the key the store itself names", async () => {
    const storage = fakeStorage();
    const store = await loadStore(storage);
    const key = store.STAFF_AUTO_REFRESH_STORAGE_KEY;

    store.useStaffAutoRefreshStore.getState().setAutoRefresh(false);
    expect(store.useStaffAutoRefreshStore.getState().autoRefresh).toBe(false);
    expect(storage.dump()[key]).toBe("0");

    store.useStaffAutoRefreshStore.getState().setAutoRefresh(true);
    expect(store.useStaffAutoRefreshStore.getState().autoRefresh).toBe(true);
    expect(storage.dump()[key]).toBe("1");
  });

  it("the switch is ONE value — a second reader sees the first reader's choice", async () => {
    /*
      This is the mechanism behind his sentence, at the only layer a node runner
      can see it: the store is a module singleton, so two surfaces reading it are
      reading one boolean rather than two. That two mounted PAGES agree across a
      real navigation is a browser fact and was driven in the running app; it is
      recorded in the card's evidence, not asserted here.
    */
    const store = await loadStore(fakeStorage());
    const readerA = store.useStaffAutoRefreshStore;
    const readerB = store.useStaffAutoRefreshStore;

    readerA.getState().setAutoRefresh(false);
    expect(readerB.getState().autoRefresh, "two surfaces, one switch").toBe(false);
  });

  it("a browser that REFUSES storage still gets a working switch, not a blank panel", async () => {
    /*
      ⚠ THE FAILURE THIS PREVENTS IS NOT A LOST PREFERENCE, IT IS A DEAD ADMIN
      PANEL. Private-mode Safari throws on the property access itself, so an
      unguarded read at module scope takes down every surface that imports the
      barrel — and it does it only for the browsers nobody on the team is using.
      Degrade to session-only, never to broken.
    */
    const store = await loadStore(hostileStorage);
    expect(store.useStaffAutoRefreshStore.getState().autoRefresh).toBe(
      store.STAFF_AUTO_REFRESH_DEFAULT,
    );

    expect(() => store.useStaffAutoRefreshStore.getState().setAutoRefresh(false)).not.toThrow();
    expect(
      store.useStaffAutoRefreshStore.getState().autoRefresh,
      "the toggle still works for this session",
    ).toBe(false);
  });

  it("no browser at all is the same story — the module loads and the switch works", async () => {
    /*
      `window` is undefined in this runner and in any non-DOM import of the
      barrel. A `ReferenceError` is caught by the same guard as a thrown
      property, which is why this arm asserts rather than assumes it.
    */
    vi.resetModules();
    vi.unstubAllGlobals();
    const store = await import("./useStaffAutoRefreshStore");
    expect(store.useStaffAutoRefreshStore.getState().autoRefresh).toBe(
      store.STAFF_AUTO_REFRESH_DEFAULT,
    );
    expect(() => store.useStaffAutoRefreshStore.getState().setAutoRefresh(false)).not.toThrow();
  });
});
