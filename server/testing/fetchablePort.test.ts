/**
 * THE HELPER GETS A NEGATIVE CONTROL BEFORE ITS VERDICT COUNTS (law 2).
 *
 * The claim under `fetchablePort.ts` is that a fetch at a listed port fails
 * before it sends. If that were false, the helper would be re-binding away from
 * ports that work fine and the flake it names would have another cause. So the
 * first test drives the runtime's refusal directly, and the source guard at the
 * bottom is what stops the class coming back through a sixth file.
 */
import express from "express";
import { createServer } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOCKED_PORT_CONTROL,
  baseUrlOf,
  isFetchBlockedPort,
  listenOnFetchablePort,
  portOf,
} from "./fetchablePort";

const closed = (server: { close: (cb: () => void) => unknown }) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

describe("the runtime's own refusal — the negative control", () => {
  it("fetch at a listed port fails with `bad port`, with nothing listening there", async () => {
    // No listener is bound: the point is that the client refuses BEFORE it
    // connects, so this cannot be mistaken for a connection error.
    const failure = await fetch(`http://127.0.0.1:${BLOCKED_PORT_CONTROL}/`).then(
      () => null,
      (error: unknown) => error as Error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(String((failure as Error & { cause?: unknown }).cause)).toContain("bad port");
  });

  it("and the same fetch at an unlisted port gets a real answer — the positive half", async () => {
    const app = express();
    app.get("/", (_req, res) => res.json({ ok: true }));
    const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
    try {
      const response = await fetch(`${baseUrlOf(server)}/`);
      expect(await response.json()).toEqual({ ok: true });
    } finally {
      await closed(server);
    }
  });
});

describe("listenOnFetchablePort", () => {
  it("never returns a listener on a port the client would refuse", async () => {
    const app = express();
    const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
    try {
      expect(isFetchBlockedPort(portOf(server))).toBe(false);
    } finally {
      await closed(server);
    }
  });

  it("RE-BINDS when the OS offers a blocked port, and closes the one it declined", async () => {
    // Driven directly rather than waited for: the real draw is ~1 in 700, so a
    // test that hoped to meet one would never exercise this arm (law 3). The
    // decline is staged by making a real ephemeral listener REPORT a blocked
    // port rather than by binding one — binding 6667 for real hung on this
    // machine, and the runtime's actual refusal is proven by the control above,
    // not here. What this arm owns is the branch: report blocked → close, retry.
    const declined = createServer();
    declined.listen(0, "127.0.0.1");
    Object.defineProperty(declined, "address", {
      value: () => ({ address: "127.0.0.1", family: "IPv4", port: BLOCKED_PORT_CONTROL }),
    });
    expect(portOf(declined)).toBe(BLOCKED_PORT_CONTROL);

    const app = express();
    let call = 0;
    const server = await listenOnFetchablePort((port) => {
      call += 1;
      return call === 1 ? declined : app.listen(port, "127.0.0.1");
    });
    try {
      expect(call).toBe(2);
      expect(portOf(server)).not.toBe(BLOCKED_PORT_CONTROL);
      expect(declined.listening).toBe(false);
    } finally {
      await closed(server);
    }
  });

  it("gives up with the ports it was offered rather than looping for ever", async () => {
    const offered: Array<() => void> = [];
    await expect(
      listenOnFetchablePort(() => {
        const server = createServer();
        server.listen(0, "127.0.0.1");
        // Every attempt reports a blocked port, so the budget must run out.
        Object.defineProperty(server, "address", {
          value: () => ({ address: "127.0.0.1", family: "IPv4", port: BLOCKED_PORT_CONTROL }),
        });
        offered.push(() => server.close());
        return server;
      }, 3),
    ).rejects.toThrow(/no fetchable ephemeral port in 3 attempts/);
    offered.forEach((close) => close());
  });
});

describe("the class cannot come back through a sixth file", () => {
  it("no server test binds an ephemeral port without going through the helper", () => {
    const root = path.resolve(__dirname, "..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith(".test.ts")) continue;
        // The helper's own suite stages a raw bind on purpose — it is the file
        // that owns this rule, and exempting it by name beats a regex that
        // tries to be clever about which raw binds are legitimate.
        if (entry === "fetchablePort.test.ts") continue;
        const source = readFileSync(full, "utf8");
        // `listen(0` is the raw draw the helper exists to replace.
        if (/\.listen\(\s*0\b/.test(source)) offenders.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
