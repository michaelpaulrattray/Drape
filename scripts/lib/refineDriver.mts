/**
 * DRIVING ONE REFINE THROUGH THE REAL PANEL — the mechanics, once.
 *
 * # Why this was extracted (2026-08-10)
 *
 * `drive-self-walk.mts` grew every line of this the hard way, and each one is a
 * defect that cost credits: the tile matched by COORDINATE instead of by her own
 * picture (nine paid renders of a woman nobody asked for), the projection read
 * before its query settled (four steps scored delivered that had refused), the
 * landing counted instead of ATTRIBUTED (a late lander from two steps ago closing
 * the wrong step's wait), the field that went `disabled` mid-keystroke and
 * dispatched a paid render of **"gold hoop ear"**.
 *
 * The finding-replay walk drives the same panel, on the same account, for the
 * same money. A second copy of this would be the mirror law #4 forbids — and the
 * failure mode is not abstract: two harnesses that disagree about whether a step
 * landed produce two different answers to "does the product work", and the
 * founder gets summoned off the wrong one.
 *
 * So the split is `drivePage`'s, one level up: **the plumbing lives here and the
 * LAWS live in the drivers.** What a step must MEAN — which outcome was expected,
 * what the pixels have to show, what the ledger owes — belongs to the walk that
 * is asking. How a viewer gets opened and a sentence gets submitted does not.
 *
 * # It records into the CALLER's collector
 *
 * The handful of assertions that belong to the actuation itself — the panel is
 * reachable, the price is stated before the box, the box holds the sentence that
 * is about to be paid for — are recorded into the `Checks` the caller passes in.
 * One verdict per run, and a driver that adds its own laws does not have to know
 * these exist.
 *
 * Every function here is a MOVE rather than a rewrite: the code and its comments
 * came out of `drive-self-walk.mts` unchanged, so the walk that earned these
 * lessons and the walk inheriting them cannot come apart.
 */
import type { Page } from "puppeteer-core";

import { openDatabase } from "./dbConnection.mjs";
import { databaseUrl } from "./attemptRows.mjs";
import type { Checks } from "./drivePage.mts";

/**
 * How long a walk waits for a render to reach her screen.
 *
 * WAS four minutes, and run-6 scored two honest deliveries as timeouts because
 * of it. The operation rows: "give her freckles" completed in **283s** and
 * "remove her glasses" in **276s**, against a cap that gave up at 240. The
 * walk was measuring its own patience and calling it delivery, and a window
 * that scores honest deliveries as failures poisons every rate it touches.
 *
 * Eight minutes is comfortably past the slowest render measured, and the step
 * still records the seconds it actually took — so a genuinely slow product is
 * visible as a number rather than hidden behind a verdict.
 */
export const LANDING_TIMEOUT_MS = 8 * 60 * 1000;

/* ---------------------------------------------------------------------------
   Finding the sheet. Navigation, not verdict — so HTTP is the honest tool.
   Derived by walking the owner's own projections rather than being passed in,
   because a hardcoded session id is a second copy of a fact the server owns.
--------------------------------------------------------------------------- */

export function createTrpcQuery(input: { base: string; token: string }) {
  const cookie = `app_session_id=${input.token}`;
  return async function trpcQuery(path: string, payload: unknown): Promise<any> {
    const url = `${input.base}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: payload }))}`;
    const res = await fetch(url, { headers: { cookie } });
    const body = await res.json();
    if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return body?.result?.data?.json;
  };
}

export type Located = {
  sessionId: string;
  /** Kept so her CURRENT face can be re-asked for before every step. */
  rollId: string;
  /** The rail pill to press. A sheet shows its ACTIVE roll, not every roll. */
  rollIndex: number;
  rollLabel: string;
  indexLabel: string;
  /**
   * Her own picture — the only thing on the sheet that identifies HER.
   *
   * The first version of this walked to `View candidate 08 larger` and clicked
   * whatever wore that label. Every roll has an eighth face, the sheet was
   * showing a different roll, and so all nine paid renders landed on a
   * different woman at the same position — a face nobody had asked for, with
   * its own history, on which "no freckles" and "glasses still on" were then
   * recorded as findings about the walk candidate.
   *
   * A label is a coordinate; an image key is an identity. Matching on the
   * coordinate is the same mistake as scoping a write by id and checking the
   * owner separately, and it deserves the same fix: ask the question about the
   * thing itself.
   */
  imageUrl: string;
};

export async function locateCandidate(input: {
  trpcQuery: ReturnType<typeof createTrpcQuery>;
  candidateId: string;
}): Promise<Located> {
  const sessions = await input.trpcQuery("castingV2.openSessions", {});
  for (const session of sessions ?? []) {
    const detail = await input.trpcQuery("castingV2.getSession", { sessionId: session.sessionId });
    for (const roll of detail?.rolls ?? []) {
      const projection = await input.trpcQuery("castingV2.getRoll", { rollId: roll.rollId });
      const found = (projection?.candidates ?? []).find(
        (candidate: any) => candidate.candidateId === input.candidateId,
      );
      if (!found) continue;
      if (!found.imageUrl) {
        throw new Error(`candidate ${input.candidateId} has no image — there is nothing to identify her by`);
      }
      return {
        sessionId: session.sessionId,
        rollId: roll.rollId,
        rollIndex: roll.rollIndex,
        rollLabel: String(roll.rollIndex).padStart(2, "0"),
        indexLabel: found.indexLabel,
        imageUrl: found.imageUrl,
      };
    }
  }
  throw new Error(
    `candidate ${input.candidateId} is not on any open sheet for this session — `
    + "refusing to walk a face I cannot find rather than guessing at one",
  );
}

/**
 * The picture her TILE is wearing right now.
 *
 * A tile shows the candidate's currently selected face, so it changes the
 * moment this walk selects a new version — pinning the identity to the picture
 * found at startup would work for step one and silently miss her from step two
 * onward, which is the same coordinate-versus-identity error one layer along.
 * So it is re-asked, from the server, immediately before each open.
 */
export function createCurrentFaceKey(input: {
  trpcQuery: ReturnType<typeof createTrpcQuery>;
  rollId: string;
  rollLabel: string;
  candidateId: string;
}) {
  return async function currentFaceKey(): Promise<string> {
    const projection = await input.trpcQuery("castingV2.getRoll", { rollId: input.rollId });
    const found = (projection?.candidates ?? []).find((c: any) => c.candidateId === input.candidateId);
    const url: string | null = found?.imageUrl ?? null;
    if (!url) throw new Error(`candidate ${input.candidateId} no longer has a face on roll ${input.rollLabel}`);
    return url.slice(url.lastIndexOf("/") + 1);
  };
}

/** How many real (non-ghost) versions the stack is showing. */
export const stackSize = (page: Page): Promise<number> =>
  page.$$eval(".dpc-refine__pick:not(.dpc-refine__pick--ghost)", (nodes) => nodes.length);

export function createViewerOpener(input: {
  page: Page;
  base: string;
  sessionId: string;
  rollLabel: string;
  indexLabelForError?: string;
  currentFaceKey: () => Promise<string>;
}) {
  const { page } = input;
  return async function openViewer(): Promise<void> {
    await page.goto(`${input.base}/casting/s/${input.sessionId}`, { waitUntil: "networkidle2" });
    await page.waitForSelector(".dpc-card", { timeout: 60_000 });

    /*
      HER ROLL FIRST. The sheet opens on the ACTIVE roll and the rail is how every
      earlier one stays reachable — free navigation, no server call.
    */
    const railed = await page.evaluate((wanted) => {
      const rail = Array.from(document.querySelectorAll<HTMLElement>(".dpc-rollrail__item"));
      if (rail.length === 0) return "no rail — this sheet has one roll";
      const pill = rail.find((node) => node.innerText.trim().startsWith(wanted));
      if (!pill) return `no rail pill for roll ${wanted}`;
      if (pill.getAttribute("aria-selected") === "true") return "already showing her roll";
      pill.click();
      return "switched to her roll";
    }, input.rollLabel);
    await page.waitForSelector(".dpc-card", { timeout: 30_000 });

    /*
      AND THEN HER, BY HER OWN PICTURE.

      `View candidate 08 larger` is a coordinate, not a name — every roll has an
      eighth face, and clicking that label on the wrong roll is how nine paid
      renders were made of a woman nobody had asked for. The tile carrying HER
      image is the only tile that is her.
    */
    const key = await input.currentFaceKey();
    const opened = await page.evaluate((wantedKey) => {
      for (const card of Array.from(document.querySelectorAll<HTMLElement>(".dpc-card"))) {
        const img = card.querySelector<HTMLImageElement>("img");
        if (!img || !img.src.includes(wantedKey)) continue;
        const button = card.classList.contains("dpc-card__open")
          ? card
          : card.querySelector<HTMLElement>(".dpc-card__open");
        if (!button) return "her tile has no open control";
        button.click();
        return "opened";
      }
      return "not on this sheet";
    }, key);
    if (opened !== "opened") {
      throw new Error(
        `could not open the walk candidate by her own picture (${opened}; rail: ${railed}). `
        + "Refusing to spend on whoever happens to be at the same position.",
      );
    }
    await page.waitForSelector(".dpc-viewer", { timeout: 20_000 });

    /*
      AND WAIT FOR THE PANEL'S OWN DATA, which is a separate query.

      Run one read the stack the instant the viewer opened, got 0 because
      `variants` had not resolved, and then every landing check — "is the stack
      bigger than it was" — fired the moment the real stack rendered. Four steps
      were scored `delivered` that had refused or never run. Reading a projection
      before its query settles is the vacuous-pass hazard this harness keeps
      meeting; a settled read is two identical counts a second apart, not a
      hopeful sleep.
    */
    /* First that it has rendered at all — two equal reads of nothing is a settled
       read of an unsettled query, which is the same false zero one rung up. */
    await page.waitForSelector(".dpc-refine__pick", { timeout: 25_000 }).catch(() => undefined);
    await page.waitForFunction(
      () => {
        const stack = document.querySelectorAll(".dpc-refine__pick").length;
        const previous = (window as any).__walkStack;
        (window as any).__walkStack = stack;
        return previous !== undefined && previous === stack;
      },
      { timeout: 30_000, polling: 1000 },
    ).catch(() => undefined);
  };
}

/**
 * Nothing of this face's is still running.
 *
 * `busy` disables the box while ANY refine on the sheet is in flight, so a step
 * that starts while the last one is still out cannot type at all — and a step
 * that starts while it is *becoming* busy types half a sentence. Waiting for
 * quiet is what the founder does without noticing.
 */
export async function waitUntilIdle(page: Page, timeoutMs = LANDING_TIMEOUT_MS): Promise<string> {
  const settled = await page
    .waitForFunction(
      () => {
        const field = document.querySelector<HTMLInputElement>(".dpc-refine__field");
        return field !== null && !field.disabled;
      },
      { timeout: timeoutMs, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  return settled ? "box is live" : "box still disabled — something is still running";
}

/**
 * HOW LONG THE SERVER HAS BEEN UP — the only way to tell OUR fault from ITS.
 *
 * A deploy kills the process holding a refinement — and since 2026-09-06 a
 * deploy is anything that moves `main`: a squash merge as much as the rite
 * (#508; before that day only the rite's push deployed, #296). That is a known
 * and accepted collision class (founder ruling,
 * 2026-08-01): per-slice billing plus the recovery sweep is the designed answer,
 * and the money is right — charged 25, swept, refunded 25.
 *
 * But a step killed by a deploy is not a product signal, and it looks exactly
 * like one from the browser: the panel shows a transport error because the
 * connection died mid-request. Runs three and four both failed step one that
 * way, both within a minute of a push of mine, and both were about to be
 * written down as defects.
 *
 * Uptime going BACKWARDS across a step is proof the process restarted under it.
 * A step that collided is void — not a pass, not a failure, and never a row in
 * the delivery rate.
 */
export async function serverUptime(base: string): Promise<number | null> {
  try {
    const res = await fetch(`${base}/api/health`);
    const body = await res.json() as { uptime?: number };
    return typeof body.uptime === "number" ? body.uptime : null;
  } catch {
    return null;
  }
}

/**
 * THE OBJECT KEY THE ROW SAYS THIS INSTRUCTION DELIVERED.
 *
 * The row is the fact and the screen is the claim (working law 1), so the
 * landing check compares one against the other rather than against "a picture
 * I have not seen before". Novelty passed two steps of the 2026-08-09 walk
 * while the viewer was showing a stale face, which is exactly the shape a
 * projection defect takes.
 *
 * Returns null when the walk has no database — the check then records itself
 * as never armed rather than passing quietly on nothing.
 */
export function createLandedImageKey(candidateId: string) {
  return async function landedImageKey(instruction: string): Promise<string | null> {
    let url: string;
    try { url = databaseUrl(); } catch { return null; }
    const connection = await openDatabase(url);
    try {
      const [rows] = await connection.query<any[]>(
        `SELECT v.imageKey
           FROM casting_candidate_variants v
           JOIN casting_candidates c ON c.id = v.candidateId
          WHERE c.publicId = ? AND v.requestText = ? AND v.imageKey IS NOT NULL
          ORDER BY v.id DESC
          LIMIT 1`,
        [candidateId, instruction],
      );
      const key = rows[0]?.imageKey as string | undefined;
      return key ? key.slice(key.lastIndexOf("/") + 1) : null;
    } finally {
      await connection.end();
    }
  };
}

/**
 * A sentence shown to a customer is written FOR them.
 *
 * Run three's first step put **"Unable to transform response from server"** in
 * the panel — the tRPC client failing to deserialize a response, rendered
 * verbatim where the product's own refusal copy goes. Every refusal in this
 * program is a carefully written sentence that names its wall and says nothing
 * was charged; a transport string in that frame is not a refusal at all, and
 * lumping it in with the honest ones is how a real defect gets counted as
 * correct behaviour.
 */
export const MACHINE_WORDS =
  /transform response|undefined|\[object |TypeError|NetworkError|ECONN|fetch failed|<html|status code|JSON/i;

export type RefineOutcome = "delivered" | "asked" | "refused" | "errored" | "timeout" | "collided";

export type RefineObservation = {
  outcome: RefineOutcome;
  /** The sentence the panel showed, verbatim. */
  said: string | null;
  answers: string[];
  /** The picture the viewer is showing after the new version was selected. */
  shown: string | null;
  /** The object key the ROW says this instruction delivered, if any. */
  deliveredKey: string | null;
  seconds: number;
  /** True when the server restarted under this step — the step measured nothing. */
  collided: boolean;
  /**
   * The two counts a caller needs to prove a FREE ask stayed free.
   *
   * `mine` is versions bearing THIS sentence and `stack` is the whole stack —
   * and the distinction is load-bearing rather than tidy. Comparing total stack
   * size made run-6's step 1, which landed LATE after its window closed, look as
   * though step 2's free question had charged.
   */
  mineBefore: number;
  mineAfter: number;
  stackBefore: number;
  stackAfter: number;
};

/**
 * ONE REFINE, ACTUATED AND OBSERVED — the whole of the mechanics, none of the law.
 *
 * The caller decides what the outcome MEANS. This decides only what happened,
 * and records the assertions that belong to the actuation itself into the
 * caller's collector.
 */
export async function refineStep(input: {
  page: Page;
  base: string;
  checks: Checks;
  /** The caller's own position language — `[2/5]`, `[step 4]`, whatever it says. */
  label: string;
  instruction: string;
  openViewer: () => Promise<void>;
  landedImageKey: (instruction: string) => Promise<string | null>;
  /** False for a step the product is expected to answer for free. */
  expectsDelivery: boolean;
  landingTimeoutMs?: number;
  /** Named in the "panel is reachable" observation, for a reader of the log. */
  indexLabel?: string;
  /** Runs on the open viewer, immediately before the sentence is typed. */
  beforeTyping?: () => Promise<void>;
}): Promise<RefineObservation> {
  const { page, checks, label, instruction } = input;
  const landingTimeoutMs = input.landingTimeoutMs ?? LANDING_TIMEOUT_MS;
  const began = Date.now();
  const seconds = () => Math.round((Date.now() - began) / 100) / 10;

  const uptimeBefore = await serverUptime(input.base);

  /* Re-opened per step. Closing and reopening between edits is what the founder
     actually does, and it is the path that has broken before (D-161: a running
     refinement that vanished with the component and got bought twice). */
  await input.openViewer();

  /*
    HOW MANY VERSIONS ALREADY CARRY THIS SENTENCE.

    Landing was "a pick labelled with my instruction exists", which any EARLIER
    version wearing the same words satisfies — and a big walk asks some classes
    more than once. A stale match would score a step delivered with nothing
    landed, which is the coordinate-versus-identity class again, now inside the
    check written to fix its previous instance. Counted before, so landing is an
    INCREASE rather than a presence.
  */
  const before = await stackSize(page);
  const mineBefore = await page.$$eval(
    ".dpc-refine__pick:not(.dpc-refine__pick--ghost)",
    (nodes, wanted) => nodes.filter((node) => node.getAttribute("aria-label") === wanted).length,
    instruction,
  );
  /**
   * A step that never submitted, reported with its counts READ rather than
   * assumed. Nothing was sent, so nothing of this step's can have landed — but
   * something of an earlier step's can, and a caller proving "asking cost her
   * nothing" needs the observation and not my confidence about it.
   */
  const bail = async (outcome: RefineOutcome, said: string): Promise<RefineObservation> => {
    const counts = await page.evaluate((wanted) => ({
      stack: document.querySelectorAll(".dpc-refine__pick:not(.dpc-refine__pick--ghost)").length,
      mine: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"))
        .filter((node) => node.getAttribute("aria-label") === wanted).length,
    }), instruction).catch(() => ({ stack: before, mine: mineBefore }));
    return {
      outcome, said, answers: [], shown: null, deliveredKey: null,
      seconds: seconds(), collided: false,
      mineBefore, mineAfter: counts.mine, stackBefore: before, stackAfter: counts.stack,
    };
  };

  const panel = await page.$(".dpc-refine");
  checks.check(
    panel !== null,
    `${label} the refine panel is reachable from the tile`,
    panel
      ? `.dpc-refine present after opening candidate ${input.indexLabel ?? "(unlabelled)"}`
      : "no panel under the picture",
  );
  if (!panel) return bail("timeout", "the refine panel was not reachable");

  /* The price is stated where the money moves — D-15, and it is the one law
     that has cost the founder credits by being absent. */
  const priceNote = await page.$$eval(".dpc-refine__note", (nodes) =>
    nodes.map((node) => node.textContent ?? "").find((text) => /\d+\s*credits each/.test(text)) ?? "");
  checks.check(
    priceNote.length > 0,
    `${label} the panel states the price before the box`,
    priceNote || "no note carrying a per-edit price",
  );

  const idle = await waitUntilIdle(page, landingTimeoutMs);
  checks.check(idle === "box is live", `${label} the box is ready to take a sentence`, idle);
  if (idle !== "box is live") {
    /*
      AND THEN STOP, rather than typing into a box that will not take it.

      Run three found a step still running four minutes later, typed into the
      disabled field anyway, and died on the next selector — so the walk ended
      at step two with three steps never attempted and no report at all. A
      driver that crashes has measured nothing; a driver that records "this step
      never got a turn" has measured exactly that.
    */
    return bail("timeout", idle);
  }

  /* The panel can re-render between the idle check and the keystroke — the
     viewer remounts on a variants refetch. Re-open once rather than dying on a
     missing selector, which is how two runs ended with three steps unattempted. */
  if (!(await page.$(".dpc-refine__field"))) {
    await input.openViewer();
    await waitUntilIdle(page, landingTimeoutMs);
  }
  if (!(await page.$(".dpc-refine__field"))) {
    checks.neverArmed(`${label} the box survives to be typed into`, "the panel went away");
    return bail("timeout", "the refine panel went away before the sentence could be typed");
  }

  /*
    THE CALLER'S LAST WORD BEFORE THE MONEY MOVES.

    The self-walk re-derives its eye-shape expectation here, off the face she is
    ACTUALLY on rather than off her base — the gate reads the SELECTED face, and
    by step 2 that is step 1's render. That is a law, so it lives in the driver
    that holds it; this is only the place in the sequence where it has to happen.
  */
  await input.beforeTyping?.();

  await page.type(".dpc-refine__field", instruction, { delay: 12 });

  /*
    WHAT IS ACTUALLY IN THE BOX, BEFORE THE MONEY MOVES.

    Run one typed into a field that went `disabled` mid-keystroke because a
    previous refinement's `pending` arrived on the poll, and dispatched a paid
    render of **"gold hoop ear"**. Twenty-five credits on a sentence nobody
    typed, and the only reason it was ever noticed is that the wait overlay
    read the truncation back. Asserting at the wire is exactly this: the
    contract is about what gets SENT, so it is proved on the outgoing value and
    not on the constant beside it (invariant 5).
  */
  const inBox = await page.$eval(".dpc-refine__field", (node) => (node as HTMLInputElement).value);
  const intact = inBox === instruction;
  checks.check(
    intact,
    `${label} the box holds the sentence that is about to be paid for`,
    `field reads "${inBox}"`,
  );
  if (!intact) {
    /* Refusing to spend beats spending on the wrong thing and measuring it. */
    return bail("timeout", `the box held "${inBox}" — not submitted`);
  }

  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>(".dpc-refine__ask");
    form?.requestSubmit();
  });

  /*
    THE CLICK'S OWN FRAME. Read back with no wait at all: a sleep here would let
    the poll arrive and the check would pass on the server's work rather than on
    the client's, which is the vacuous pass this harness has been caught by
    twice already.
  */
  const busyLabel = await page.evaluate(
    () => new Promise<string>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() =>
        resolve(
          document.querySelector<HTMLElement>(".dpc-refine__ask button[type=submit]")?.innerText?.trim()
          ?? "",
        )))),
  );
  checks.check(
    /refining/i.test(busyLabel),
    `${label} the box says it is working in the click's own frame`,
    `submit button read "${busyLabel}"`,
  );

  /*
    LANDING, AND THE NARRATION ALONG THE WAY — one loop, not two windows.

    Run one watched for narration in its own 30-second window and then waited
    separately for the landing, so a render that took 32 seconds was recorded as
    "never narrated". Worse, a step that REFUSED for free was judged against a
    narration it was right not to have. The wait is the same wait: poll it once,
    keep the best narration seen, and stop when the outcome arrives.
  */
  let narrated: { said: string | null; stage: string | null; ghost: string | null } | null = null;
  let landed = false;
  const deadline = Date.now() + landingTimeoutMs;
  while (Date.now() < deadline) {
    /*
      THE LANDING IS ATTRIBUTED, not counted.

      "Is the stack bigger than it was" is satisfied by ANY arrival, and edits
      here run about 160 seconds while the founder types the next one — so a
      late lander from two steps ago closed the wrong step's wait. The product
      says so itself in the panel ("the edit you started earlier just arrived"),
      which is the guard printing its own firing, and I was counting beside it.
      Each version's pick is labelled with its own last instruction, so the
      right question is whether THIS sentence is now in the stack.
    */
    const now = await page.evaluate((wanted) => ({
      mineCount: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"))
        .filter((node) => node.getAttribute("aria-label") === wanted).length,
      outcome: document.querySelector(".dpc-refine__outcome") !== null,
      said: document.querySelector<HTMLElement>(".dpc-viewer__waitSaid")?.innerText?.trim() ?? null,
      stage: document.querySelector<HTMLElement>(".dpc-viewer__waitMeta")?.innerText?.trim() ?? null,
      ghost: document.querySelector<HTMLElement>(".dpc-refine__pick--ghost")?.innerText?.trim() ?? null,
    }), instruction);
    if (now.said === instruction || now.ghost === instruction) {
      narrated = { said: now.said, stage: now.stage, ghost: now.ghost };
    }
    if (now.mineCount > mineBefore || now.outcome) { landed = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  if (narrated !== null) {
    checks.check(
      true,
      `${label} the wait says HER OWN sentence back`,
      `overlay "${narrated.said ?? "-"}" · ghost "${narrated.ghost ?? "-"}" · `
      + `stage "${(narrated.stage ?? "-").replace(/\n/g, " · ")}"`,
    );
  } else if (input.expectsDelivery) {
    /* A step that spends should have narrated; whether it is a defect or simply
       a step that refused instead is decided by the outcome check in the caller,
       so this records the observation rather than pre-judging it. */
    checks.absent(
      `${label} the picture narrates the wait`,
      "this step's own sentence was never in flight on screen",
    );
  } else {
    checks.absent(`${label} the picture narrates the wait`, "a free question never renders");
  }

  const seen = await page.evaluate((wanted) => ({
    stack: document.querySelectorAll(".dpc-refine__pick:not(.dpc-refine__pick--ghost)").length,
    mineCount: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"))
      .filter((node) => node.getAttribute("aria-label") === wanted).length,
    said: document.querySelector<HTMLElement>(".dpc-refine__outcome")?.innerText?.replace(/\s*×\s*$/, "").trim()
      ?? null,
    answers: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__answer"))
      .map((node) => node.innerText.trim()),
  }), instruction);

  const machineSaid = Boolean(seen.said && MACHINE_WORDS.test(seen.said));

  /*
    DID THE PROCESS SURVIVE THIS STEP? Asked before anything is concluded from
    it, because a deploy landing mid-refine produces exactly the picture a
    broken product would.
  */
  const uptimeAfter = await serverUptime(input.base);
  const collided = uptimeBefore !== null && uptimeAfter !== null && uptimeAfter < uptimeBefore;

  const outcome: RefineOutcome = collided
    ? "collided"
    : !landed
      ? "timeout"
      : seen.mineCount > mineBefore
        ? "delivered"
        : seen.answers.length > 0
          ? "asked"
          : machineSaid
            ? "errored"
            : "refused";

  if (collided) {
    checks.absent(
      `${label} measured anything at all`,
      `the server restarted under this step (uptime ${Math.round(uptimeBefore!)}s → `
      + `${Math.round(uptimeAfter!)}s) — a deploy collision, void, re-run needed`,
    );
  }

  if (seen.said && !collided) {
    checks.check(
      !machineSaid,
      `${label} the panel speaks to her, not about the transport`,
      `panel said "${seen.said.slice(0, 120)}"`,
    );
  }

  /*
    AND NOW LOOK AT WHAT SHE WOULD BE LOOKING AT.

    The old check read `.dpc-viewer__plate img` straight after landing and
    passed — on the SELECTED face, which the walk had pinned to the original at
    reset and which never changes when a version arrives. Step five's "delivered
    picture" came back byte-identical to step one's, and the check said ok both
    times: a false pass in the harness built to catch false passes.

    So the new version is SELECTED first (free — choosing between pictures that
    already exist is navigation, D-121) and the viewer is then asked what it is
    showing. That is the projection the founder actually judges.
  */
  let shown: string | null = null;
  let deliveredKey: string | null = null;
  if (outcome === "delivered") {
    await page.evaluate((wanted) => {
      /* The LAST match: new versions append, so the first one wearing these
         words is the oldest and selecting it would show a picture from an
         earlier step. */
      const matches = Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick"))
        .filter((node) => node.getAttribute("aria-label") === wanted);
      matches[matches.length - 1]?.click();
    }, instruction);
    await page.waitForFunction(
      (wanted) => {
        const matches = Array.from(
          document.querySelectorAll<HTMLElement>(".dpc-refine__pick"),
        ).filter((node) => node.getAttribute("aria-label") === wanted);
        return matches[matches.length - 1]?.getAttribute("aria-pressed") === "true";
      },
      { timeout: 30_000, polling: 500 },
      instruction,
    ).catch(() => undefined);
    /*
      AND THEN WAIT FOR THE PICTURE, WHICH IS A DIFFERENT QUERY.

      `aria-pressed` is the panel's own state and flips on the click. The
      picture in the viewer comes from the SHEET's candidate projection, which
      only catches up when `selectVariant` round-trips and its two refetches
      land — measured at up to six seconds on production. Reading the `img` the
      instant the pick reports pressed is therefore a race, and it is the race
      this walk lost three times in a row on 2026-08-09: it booked a product
      defect ("the viewer is one version behind") against a product that shows
      the right picture every time, proved afterwards by clicking all five
      versions and reading each twice.

      The honest read is a SETTLED one — the same discipline this file already
      applies to the version stack — and the thing it settles ON is the row's
      own object key, not "a picture this run has not seen". Steps 4 and 5 of
      that walk passed on novelty while showing the wrong face.
    */
    deliveredKey = await input.landedImageKey(instruction);
    const readShown = async () => page.evaluate(() =>
      document.querySelector<HTMLImageElement>(".dpc-viewer__plate img")?.src ?? null);
    const settleBy = Date.now() + 30_000;
    shown = await readShown();
    while (Date.now() < settleBy) {
      if (deliveredKey && shown?.includes(deliveredKey)) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const again = await readShown();
      if (!deliveredKey && again === shown) break;
      shown = again;
    }
    if (deliveredKey) {
      checks.check(
        Boolean(shown?.includes(deliveredKey)),
        `${label} the screen is showing the picture the ROW says was delivered`,
        `row ${deliveredKey} · screen ${shown?.slice(shown.lastIndexOf("/") + 1) ?? "no img"}`,
      );
    } else {
      checks.neverArmed(
        `${label} the screen is showing the picture the ROW says was delivered`,
        "no landed row carried an image key for this instruction",
      );
    }
  }

  return {
    outcome,
    said: seen.said,
    answers: seen.answers,
    shown,
    deliveredKey,
    seconds: seconds(),
    collided,
    /* The caller's to interpret — a free ask must not have grown ITS OWN count,
       whatever else landed meanwhile. */
    mineBefore,
    mineAfter: seen.mineCount,
    stackBefore: before,
    stackAfter: seen.stack,
  };
}
