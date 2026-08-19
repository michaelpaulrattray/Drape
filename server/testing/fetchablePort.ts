/**
 * AN EPHEMERAL PORT IS NOT ALWAYS A PORT `fetch` WILL SPEAK TO.
 *
 * # The flake this ends, measured rather than shrugged at
 *
 * A full-suite run on 2026-08-19 came back with four failures in one file,
 * `server/_core/invalidInputWire.test.ts`, and the block was not an assertion:
 *
 * ```
 * TypeError: fetch failed
 * Caused by: Error: bad port
 *  ❯ callOverTheWire server/_core/invalidInputWire.test.ts:85:28
 * ```
 *
 * The file passed alone, eleven of eleven, thirty seconds later. That pairing —
 * red under load, green in isolation — reads as a timing flake and is not one.
 *
 * **`bad port` is undici refusing to send.** The Fetch standard carries a list
 * of *bad ports* (the block below), and a `fetch` at any of them fails before a
 * packet leaves. Five test files in this repo build a throwaway express app,
 * `listen(0)` it, and fetch whatever port the OS handed back. `listen(0)` means
 * *any free port in the machine's dynamic range* — and on THIS machine that
 * range is not the usual high one:
 *
 * ```
 * netsh int ipv4 show dynamicport tcp
 *   Start Port      : 1024
 *   Number of Ports : 64511
 * ```
 *
 * So the range STARTS at 1024 and covers every blocked port on the list. Each
 * bind is a fresh draw; roughly one in seven hundred lands on one; and a file
 * that binds eleven times draws eleven times. That is the whole mechanism —
 * nothing to do with load, and the reason isolation "fixes" it is only that a
 * second draw is a second chance.
 *
 * # Why a re-bind and not a fixed port
 *
 * A pinned port collides with whatever else the machine is running (a dev
 * server on 3000 is the obvious one) and turns a rare flake into a reliable
 * one on a busy box. Re-binding keeps the OS's own choice and simply declines
 * the handful of answers the client cannot use.
 *
 * # Why the list is written out and not imported
 *
 * undici does not export it. Copying it is a mirror (law 4) and it is declared
 * as one: it is a copy of a W3C constant that has changed roughly once a year,
 * and {@link BLOCKED_PORT_CONTROL} pins the copy against the runtime's own
 * refusal — if undici ever blocks a port this list does not name, that control
 * goes red rather than the drift living on undetected.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * The Fetch standard's "bad ports" — ports at which a fetch fails outright.
 * https://fetch.spec.whatwg.org/#bad-port
 */
const FETCH_BAD_PORTS: ReadonlySet<number> = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

/**
 * A port on the list, exported for the control that proves the runtime agrees
 * with the copy above. Chosen from the middle of the range rather than the
 * ends, so a control that passes is not passing on a boundary.
 */
export const BLOCKED_PORT_CONTROL = 6667;

/** Whether `fetch` will refuse this port before sending anything. */
export function isFetchBlockedPort(port: number): boolean {
  return FETCH_BAD_PORTS.has(port);
}

/** What a caller supplies to bind: express's own `app.listen` shape. */
export type Bind = (port: number) => Server;

/**
 * Bind an ephemeral listener whose port `fetch` will actually speak to.
 *
 * Rejects rather than looping forever: an exhausted attempt budget means the
 * OS is handing back blocked ports repeatedly, which is a fact worth a failing
 * test rather than a hang.
 */
export async function listenOnFetchablePort(
  bind: Bind,
  attempts = 8,
): Promise<Server> {
  const refused: number[] = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const server = bind(0);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const { port } = server.address() as AddressInfo;
    if (!isFetchBlockedPort(port)) return server;
    refused.push(port);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  throw new Error(
    `no fetchable ephemeral port in ${attempts} attempts; the OS offered ${refused.join(", ")}`,
  );
}

/** The port a listener from {@link listenOnFetchablePort} is answering on. */
export function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}

/** `http://127.0.0.1:<port>` for a bound listener — the one place it is spelled. */
export function baseUrlOf(server: Server): string {
  return `http://127.0.0.1:${portOf(server)}`;
}
