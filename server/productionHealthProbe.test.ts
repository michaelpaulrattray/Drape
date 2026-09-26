import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HEALTH_READS,
  HEALTH_READ_GAP_MS,
  HEALTH_SILENT_RETRIES,
  probeProductionHealth,
  type HealthAnswer,
} from "../scripts/lib/productionHealthProbe.mts";

/**
 * THE RITE'S HEALTH PROBE, DRIVEN (#1188).
 *
 * ⚠ **NOTHING DROVE THIS LOOP AT ALL BEFORE THIS FILE**, which is the reason
 * #1188 was filed as a card rather than fixed on the spot: a retry added to the
 * deploy's own correctness gate with no arm that could fail is coverage
 * reporting green by not running. `server/uptimeAnchor.test.ts` drives the
 * arithmetic that runs AFTER this, on readings handed to it.
 *
 * The distinction every arm below is about:
 *
 * - a **503** is an ANSWER. Refuse, immediately, and never ask again.
 * - **no response at all** is SILENCE. It says nothing about the deploy.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE ONE THAT STOPS THIS BECOMING "RETRY
 * UNTIL IT PASSES"** — an unhealthy answer is refused on its first answer and
 * the attempt count proves it was asked once. A probe that retried an answer
 * would make an unhealthy deploy eventually pass, which is worse than the defect
 * this card fixes.
 *
 * The rite is NEVER RUN from here. The probe takes its reader and its clock, so
 * every arm is a direct call with no network, no service and no nine-second
 * wait.
 */

const healthy = (uptime = 42.5): HealthAnswer => ({
  kind: "answered",
  status: 200,
  ok: true,
  body: { status: "healthy", uptime, timestamp: "2026-09-26T00:00:00.000Z", checks: { database: { latencyMs: 12 } } },
});

const answered = (status: number, body: unknown = { status: "unhealthy" }): HealthAnswer => ({
  kind: "answered",
  status,
  ok: status >= 200 && status < 300,
  body,
});

const SILENT: HealthAnswer = { kind: "silent" };

/** A reader that hands back a scripted sequence, and records the waits. */
function scripted(answers: readonly HealthAnswer[]) {
  const waits: number[] = [];
  let index = 0;
  return {
    waits,
    asked: () => index,
    io: {
      read: async () => answers[index++] ?? SILENT,
      wait: async (ms: number) => {
        waits.push(ms);
      },
    },
  };
}

describe("silence is retried", () => {
  it("a read that drops once then answers healthy lets the rite proceed", () => {
    /* #1177's incident in miniature: a dropped connection is not a finding about
       the deploy, and it used to kill the run. */
    const probe = scripted([SILENT, healthy(), healthy(), healthy()]);
    return probeProductionHealth(probe.io).then((verdict) => {
      expect(verdict.ok).toBe(true);
      expect(verdict.readings).toHaveLength(HEALTH_READS);
      /* Four attempts for three readings — the retry is visible in the count. */
      expect(verdict.attempts).toBe(HEALTH_READS + 1);
    });
  });

  it("a drop on the LAST read is retried too, not only on the first", async () => {
    const probe = scripted([healthy(), healthy(), SILENT, healthy()]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.ok).toBe(true);
    expect(verdict.readings).toHaveLength(HEALTH_READS);
  });

  it("a host that never answers still REFUSES, and says SILENT rather than unhealthy", async () => {
    const probe = scripted([SILENT, SILENT, SILENT, SILENT, SILENT, SILENT]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("did not answer");
    expect(verdict.why).toContain("SILENT, not unhealthy");
    /* It stopped at the first read's budget rather than walking all three. */
    expect(verdict.attempts).toBe(1 + HEALTH_SILENT_RETRIES);
    expect(verdict.readings).toHaveLength(0);
  });

  it("names how many times it went unanswered, so a re-run is an informed act", async () => {
    const probe = scripted([SILENT, SILENT]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.why).toContain(`${1 + HEALTH_SILENT_RETRIES} times`);
  });
});

describe("an answer is NEVER retried", () => {
  it("⚠ a 503 refuses on its FIRST answer — the arm that stops this becoming retry-until-pass", async () => {
    const probe = scripted([answered(503), healthy(), healthy(), healthy()]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("returned 503");
    /* ONE attempt. If this ever becomes two, an unhealthy deploy can pass by
       being asked again, which is the one failure this module must not have. */
    expect(verdict.attempts).toBe(1);
  });

  it("a 200 whose body says anything but healthy refuses, and is not re-asked", async () => {
    const probe = scripted([
      answered(200, { status: "degraded", uptime: 3, timestamp: "t", checks: { database: { latencyMs: 9 } } }),
      healthy(),
      healthy(),
    ]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("degraded");
    /* All three readings were taken — the status verdict is about the set — and
       no reading was asked twice. */
    expect(verdict.attempts).toBe(HEALTH_READS);
  });

  it("a body that could not be parsed is an ANSWER, refused rather than retried", async () => {
    const probe = scripted([{ kind: "answered", status: 200, ok: true, body: null }, healthy(), healthy()]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("could not be read");
    expect(verdict.attempts).toBe(1);
  });

  it("an unhealthy answer AFTER a retried silence still refuses", async () => {
    /* The two rules meeting: the silence bought a second attempt, the answer that
       came back was a 500, and the retry must not have laundered it. */
    const probe = scripted([SILENT, answered(500), healthy(), healthy()]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("returned 500");
  });
});

describe("the readings themselves", () => {
  it("⚠ the UPTIME ANCHOR still reads from the first ANSWERED response", async () => {
    /* The card's own arm. The first attempt was silence, so reading[0] must be
       the body that actually answered — an implementation that pushed a
       placeholder for the dropped attempt would anchor the receipt on nothing. */
    const probe = scripted([SILENT, healthy(111.5), healthy(222.5), healthy(333.5)]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.readings[0]!.uptime).toBe(111.5);
    expect(verdict.readings.map((entry) => entry.uptime)).toEqual([111.5, 222.5, 333.5]);
  });

  it("keeps the four fields the receipt prints, off the body rather than invented", async () => {
    const probe = scripted([healthy(), healthy(), healthy()]);
    const verdict = await probeProductionHealth(probe.io);

    expect(verdict.readings[0]).toEqual({
      status: "healthy",
      db: 12,
      uptime: 42.5,
      timestamp: "2026-09-26T00:00:00.000Z",
    });
  });

  it("waits BETWEEN readings and not after the last — three readings, two gaps", async () => {
    const probe = scripted([healthy(), healthy(), healthy()]);
    await probeProductionHealth(probe.io);

    expect(probe.waits).toEqual([HEALTH_READ_GAP_MS, HEALTH_READ_GAP_MS]);
  });

  it("does not wait at all when it refuses on the first read", async () => {
    const probe = scripted([answered(503)]);
    await probeProductionHealth(probe.io);

    expect(probe.waits).toEqual([]);
  });
});

describe("the rite hands it a fetch policy, never the other way round", () => {
  const rite = readFileSync(join(__dirname, "..", "scripts", "deploy-rite.mts"), "utf8");
  const probeSource = readFileSync(
    join(__dirname, "..", "scripts", "lib", "productionHealthProbe.mts"),
    "utf8",
  );

  it("the rite reaches health through the probe rather than an inline loop", () => {
    expect(rite).toContain("probeProductionHealth({");
    expect(rite, "an inline `for (let read = ...)` health loop is the shape this replaced")
      .not.toMatch(/for \(let read = 0; read < 3; read \+= 1\)/);
  });

  it("⚠ the health read carries a TIMEOUT — a bare fetch is 306.6s against a hung host", () => {
    /* #1177 measured it (node 24, undici's headersTimeout). Without this the
       probe's own patience is five minutes per read, and it would report nothing
       at all in the meantime. */
    const call = /probeProductionHealth\(\{[\s\S]*?\n\}\);/.exec(rite);
    expect(call, "the probe call could not be found — this arm is measuring nothing").not.toBeNull();
    expect(call![0]).toContain("/api/health");
    expect(call![0]).toMatch(/AbortSignal\.timeout\(\s*10_000\s*\)/);
  });

  it("the probe owns no fetch policy of its own", () => {
    /* The split is the seam: a module that reached for `fetch` could not be
       driven without a network, which is why nothing drove the old loop.

       ⚠ The comments are stripped first, and the first shape of this arm was RED
       for that reason — the module's docblock quotes `fetch(...).catch(() =>
       null)` as the shape it replaced. An arm that cannot tell code from the
       prose explaining the code is measuring the prose. */
    const code = probeSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "the docblock stripper left nothing to read").toContain("probeProductionHealth");
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/AbortSignal/);
    expect(code).not.toMatch(/process\.(env|exit)/);
    /* POSITIVE CONTROL — the stripper does not simply delete everything: the
       rite's own code, read the same way, DOES carry a fetch. */
    const riteCode = rite.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(riteCode).toMatch(/\bfetch\s*\(/);
  });
});
