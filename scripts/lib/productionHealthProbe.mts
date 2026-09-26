/**
 * THE RITE'S HEALTH VERDICT — and it stopped dying on the first unanswered read
 * (#1188, #1177's class one reader over).
 *
 * The class, named on #1177: **a check that asks once and treats silence as a
 * refusal.** The distinction that matters is the one `eyeFramePresence.mts`
 * makes explicitly:
 *
 * - a **503** is an ANSWER. The deploy is unhealthy and the rite must refuse,
 *   immediately, exactly as it always did.
 * - **no response at all** is SILENCE. It says nothing about the deploy, and
 *   until now it refused anyway.
 *
 * What it looked like: `scripts/deploy-rite.mts` read `/api/health` three times
 * and any read that did not answer killed the run — `fetch(...).catch(() =>
 * null)` funnelled a dropped connection straight into `die`. The three readings
 * exist to see STABILITY (and to feed the UPTIME ANCHOR from the first of them),
 * never to survive a flake. So a dropped connection was reported as `no
 * response`, on the deploy VERIFICATION path, where a shift reading *"health
 * read 2 returned no response"* has every reason to believe production is
 * broken.
 *
 * #1177's own incident was four dropped connections out of 314 reported to a
 * shift as *"re-upload the frames"* — repair advice for a condition that did not
 * exist. This is the same sentence with a smaller population.
 *
 * # ⚠ THE ONE THING THAT MUST NOT HAPPEN
 *
 * **A retry that makes an unhealthy deploy eventually pass.** So the rule is one
 * line and it is the whole control: **silence is retried, an answer never is.**
 * A 503, a 500, a 404, a body that says anything but `healthy`, a body that
 * cannot be parsed — each is an answer, and each refuses on the spot. Nothing
 * here asks a second time after the service has said something.
 *
 * # WHY IT IS A MODULE AND WHY IT TAKES ITS READER
 *
 * #1188's first stated reason for not fixing this in place: **there is no seam.**
 * The `fetch` was inline in a 1,400-line script and **nothing drove the health
 * loop** — checked across `server/*.test.ts` at the time the card was filed, no
 * suite touched it, and `server/uptimeAnchor.test.ts` drives only the arithmetic
 * that runs *after* it, on readings handed to it. A retry added without a seam
 * would have been a change to the deploy's own correctness gate with no arm that
 * could fail.
 *
 * So the module owns the VERDICT and the caller owns the FETCH POLICY, which is
 * `judgeEyeFramePresence`'s shape exactly. ⚠ **The timeout therefore belongs to
 * the caller and it is not optional**: #1177 measured a bare `fetch` against a
 * host that accepts and never answers at **306.6 seconds** (node 24, undici's
 * `headersTimeout`), so a hung production host would stall the rite for five
 * minutes per read before saying anything at all.
 *
 * Nothing in here exits, opens a connection, or reads an environment variable.
 */

/** The fields the rite keeps off each reading — the uptime anchor's inputs. */
export type HealthReading = {
  readonly status: string;
  readonly db: number;
  readonly uptime: number;
  readonly timestamp: string;
};

/**
 * What one attempt came back with.
 *
 * `silent` is the request that could not be made or was never answered —
 * a dropped connection, a timeout, a DNS failure. It carries no status,
 * because there was none: that is the whole point of the distinction.
 */
export type HealthAnswer =
  | { readonly kind: "answered"; readonly status: number; readonly ok: boolean; readonly body: unknown }
  | { readonly kind: "silent" };

export type HealthProbeVerdict = {
  readonly ok: boolean;
  readonly why: string;
  /** The readings taken, in order. Shorter than `HEALTH_READS` when it refused. */
  readonly readings: readonly HealthReading[];
  /** How many attempts were actually made — a retry is an attempt. */
  readonly attempts: number;
};

/** Three, because a deploy reporting SUCCESS is a claim and one reading is not stability. */
export const HEALTH_READS = 3;

/** The gap between readings. It is what makes them three readings and not one. */
export const HEALTH_READ_GAP_MS = 3_000;

/**
 * How many extra attempts a SILENT read gets. One.
 *
 * ⚠ **It is one rather than three, and the difference from
 * `EYE_FRAME_RETRY_GIVE_UP_AFTER` is the population.** The eye-frame reader asks
 * 312 questions at one host in a tick and has measured a total blackout that a
 * serial pass recovered 308 of; this asks **three**, spaced seconds apart, with
 * no burst to recover from. A second attempt separates a dropped connection from
 * a host that will not answer; a third would only lengthen the wait before the
 * rite says what is wrong.
 *
 * ⚠ **And it applies ONLY to silence.** Raising this number can never make an
 * unhealthy deploy pass, because an answered read is never re-asked — which is
 * the property to keep if this figure is ever revisited.
 */
export const HEALTH_SILENT_RETRIES = 1;

function readingOf(body: unknown): HealthReading {
  const payload = (body ?? {}) as any;
  return {
    status: String(payload.status ?? ""),
    db: Number(payload.checks?.database?.latencyMs ?? NaN),
    uptime: Number(payload.uptime ?? NaN),
    timestamp: String(payload.timestamp ?? ""),
  };
}

/**
 * Read production health `HEALTH_READS` times and say whether it is healthy.
 *
 * `read` makes one attempt and never throws — a request that could not be made
 * is `{ kind: "silent" }`. `wait` is injected so a suite can drive the whole
 * probe without spending nine seconds per arm.
 */
export async function probeProductionHealth(io: {
  readonly read: () => Promise<HealthAnswer>;
  readonly wait: (ms: number) => Promise<unknown>;
}): Promise<HealthProbeVerdict> {
  const readings: HealthReading[] = [];
  let attempts = 0;

  for (let read = 0; read < HEALTH_READS; read += 1) {
    let answer: HealthAnswer = { kind: "silent" };
    let silences = 0;
    /* ⚠ The loop bound is the RETRY BUDGET plus the first attempt, and it is
       only ever reached while the answer is silence. The moment anything comes
       back — healthy or not — this loop ends. */
    for (let attempt = 0; attempt <= HEALTH_SILENT_RETRIES; attempt += 1) {
      attempts += 1;
      answer = await io.read();
      if (answer.kind === "answered") break;
      silences += 1;
    }

    if (answer.kind === "silent") {
      return {
        ok: false,
        why:
          `health read ${read + 1} did not answer at all, ${silences} time${silences === 1 ? "" : "s"}`
          + " — SILENT, not unhealthy. Nothing was learned about the deploy, so nothing may be"
          + " reported as verified; re-run the rite, and if it is silent again the host is not"
          + " answering rather than dropping a connection.",
        readings,
        attempts,
      };
    }

    /* ⚠ AN ANSWER IS NEVER RETRIED. This is the line that stops a retry from
       turning an unhealthy deploy into a passing one. */
    if (!answer.ok) {
      return {
        ok: false,
        why: `health read ${read + 1} returned ${answer.status}`,
        readings,
        attempts,
      };
    }
    if (answer.body === null || answer.body === undefined) {
      return {
        ok: false,
        why: `health read ${read + 1} answered ${answer.status} with a body that could not be read`,
        readings,
        attempts,
      };
    }

    readings.push(readingOf(answer.body));
    if (read < HEALTH_READS - 1) await io.wait(HEALTH_READ_GAP_MS);
  }

  const unhealthy = readings.filter((entry) => entry.status !== "healthy");
  if (unhealthy.length > 0) {
    return {
      ok: false,
      why: `health said ${readings.map((entry) => entry.status).join(", ")}`,
      readings,
      attempts,
    };
  }

  return {
    ok: true,
    why: `${readings.length} healthy readings`,
    readings,
    attempts,
  };
}
