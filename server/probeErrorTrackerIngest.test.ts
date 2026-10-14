/**
 * THE PROBE'S INGEST READING, DRIVEN AT THE WIRE (#2514).
 *
 * `server/trackerVerdict.test.ts` proves what the verdict DOES with an ingest
 * answer. This proves the answer is REAL: the actual
 * `scripts/probe-error-tracker.mts`, with the real tracker and the real SDK, sends
 * its event to a local stand-in for Sentry's ingest, and the `ingest` line it
 * prints is the status that stand-in returned — read off the SDK's own
 * `afterSendEvent` hook, not inferred. Working law 5: a contract about what is
 * sent is proven on the outgoing request.
 *
 * ⚠ **Three arms, and the two that are not 200 are the controls.** A reader that
 * printed "200" whatever happened would pass the first arm alone; the 401 arm and
 * the closed-port arm are what make it able to fail. No Sentry account is touched:
 * the DSN is a made-up key on 127.0.0.1, and `SENTRY_AUTH_TOKEN` is set EMPTY so
 * the probe's `dotenv` cannot fill it from a `.env` and the read-back is never
 * attempted (`lookup not-checked`).
 *
 * The child is spawned with the ASYNC `execFile`, never `execFileSync`: the stand-in
 * server lives in this process, and a synchronous spawn would block the event loop
 * that has to answer the child's request.
 */
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* Each arm spawns the real script, which imports the SDK — the child-process floor. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const run = promisify(execFile);

/** A made-up key; the arms assert it is never printed. */
const FAKE_KEY = "f00dfacef00dfacef00dfacef00dface";
const FAKE_PROJECT = "4242";

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  server = undefined;
});

/** A stand-in ingest that answers every request with `status`, and records what it was sent. */
async function fakeIngest(status: number): Promise<{ port: number; paths: string[] }> {
  const paths: string[] = [];
  server = createServer((request, response) => {
    paths.push(`${request.method} ${request.url}`);
    request.resume();
    request.on("end", () => {
      response.statusCode = status;
      response.end("{}");
    });
  });
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", () => done()));
  return { port: (server!.address() as AddressInfo).port, paths };
}

/** A port with nothing listening — bound, read, and released. */
async function closedPort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", () => done()));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((done) => probe.close(() => done()));
  return port;
}

async function runProbe(port: number): Promise<string> {
  const env = {
    ...process.env,
    SENTRY_DSN: `http://${FAKE_KEY}@127.0.0.1:${port}/${FAKE_PROJECT}`,
    SENTRY_AUTH_TOKEN: "",
    SENTRY_ORG: "",
    SENTRY_PROJECT: "",
  };
  try {
    const { stdout, stderr } = await run("npx", ["tsx", resolve("scripts/probe-error-tracker.mts")], {
      env,
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 8 * 1024 * 1024,
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    /* The probe exits 2 on every verdict but `arrived`/`not-yet-visible`, and
       with no token this run is `accepted-unverified` — so a rejection is the
       normal road. Its output is the reading. */
    const failed = error as { stdout?: string; stderr?: string };
    return `${failed.stdout ?? ""}${failed.stderr ?? ""}`;
  }
}

describe("the probe reads Sentry's ingest answer off the real SDK (#2514)", () => {
  it("a 200 at the door prints as a 200 — and the envelope really went to the DSN's project", async () => {
    const ingest = await fakeIngest(200);
    const output = await runProbe(ingest.port);

    expect(output).toMatch(/^ingest[ \t]+Sentry's ingest answered HTTP 200 to the envelope/m);
    expect(ingest.paths.some((path) => path.startsWith(`POST /api/${FAKE_PROJECT}/envelope/`))).toBe(true);
    // No token, so the read-back was never asked and the run cannot pass on the door alone.
    expect(output).toMatch(/^VERDICT[ \t]+accepted-unverified/m);
    expect(output).not.toContain(FAKE_KEY);
  });

  it("CONTROL — a 401 at the door prints as a 401, so the reader is not stuck on 200", async () => {
    const ingest = await fakeIngest(401);
    const output = await runProbe(ingest.port);

    expect(output).toMatch(/^ingest[ \t]+Sentry's ingest answered HTTP 401 to the envelope/m);
    expect(output).not.toContain(FAKE_KEY);
  });

  it("CONTROL — nothing listening prints as NO answer, never as a status", async () => {
    const output = await runProbe(await closedPort());

    expect(output).toMatch(/^ingest[ \t]+the transport got NO answer from Sentry's ingest/m);
    expect(output).not.toMatch(/^ingest[ \t]+Sentry's ingest answered HTTP/m);
    expect(output).not.toContain(FAKE_KEY);
  });
});
