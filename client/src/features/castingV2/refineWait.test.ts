import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE REFINING WAIT, AND THE ANSWER CHIPS — the laws, mechanized (D-169, D-180).
 *
 * The founder's UI contract: a design law that can be checked belongs in the
 * suite rather than in review memory. These are the ones that can, and every
 * one of them is a rule somebody could quietly undo in a later edit without a
 * single existing test going red.
 *
 * What is deliberately NOT here: whether the wait *feels* supervised. That was
 * judged on pixels, in a mock, before any of this was wired (D-101), and it is
 * not a thing an assertion can hold.
 */
const CSS = new URL("./castingV2.css", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

async function rule(selector: string): Promise<string> {
  const css = await readFile(CSS, "utf8");
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} must exist`).toBeGreaterThan(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("the picture is the loader, and it claims nothing it cannot know", () => {
  it("softens the image itself rather than covering it with a panel", async () => {
    const waiting = await rule('.dpc-viewer__frame[data-wait="true"] img');
    expect(waiting).toContain("animation: dpc-settle");
    const css = await readFile(CSS, "utf8");
    const keyframes = css.slice(css.indexOf("@keyframes dpc-settle"));
    expect(keyframes.slice(0, 200)).toContain("blur(");
    /* Colour drains while it waits and returns when it lands — the arrival. */
    expect(keyframes.slice(0, 200)).toContain("saturate(");
  });

  /*
    THE CLIP IS LOAD-BEARING. Unclipped, `filter: blur()` feathers past the
    corner radius and the picture reads as a light leak rather than as a
    photograph going soft — which is the difference between "working" and
    "broken", and it is one deleted line away at all times.
  */
  it("clips the blur to the plate", async () => {
    const plate = await rule(".dpc-viewer__plate");
    expect(plate).toContain("overflow: hidden");
    expect(plate).toContain("position: relative");
  });

  /*
    NO TRAVELLING HIGHLIGHT. A band moving across a face captioned "the hair"
    claims the model is working that region. The dot field is uniform and
    full-frame precisely so it can claim nothing about where work happens.
  */
  it("keeps the dot field uniform across the whole frame", async () => {
    const dots = await rule(".dpc-viewer__dots");
    expect(dots).toContain("position: absolute");
    expect(dots).toContain("inset: 0");
  });

  it("never sets an animation that could read as progress", async () => {
    const css = await readFile(CSS, "utf8");
    const wait = css.slice(css.indexOf(".dpc-viewer__dots"), css.indexOf(".dpc-viewer__caption"));
    /* A width or a transform-scaleX growing over time IS a progress bar,
       whatever it is called. The wave moves a mask; nothing grows. */
    expect(wait).not.toMatch(/@keyframes[^}]*width:/);
  });

  it("sets the status in the type everything else uses, never mono", async () => {
    const said = await rule(".dpc-viewer__waitSaid");
    expect(said).toContain("font-family: var(--font-sans)");
    expect(said).not.toContain("--font-mono");
  });
});

describe("the wait says only what the row knows", () => {
  /*
    TWO STAGES OF PROGRESS, AND NO THIRD — the law is unchanged; what changed
    is that `settling` is not one of them (fable-467).

    A live render has exactly two states it can report, and nothing between
    dispatch and landing is knowable. `settling` answers a different question:
    the operation's lease has passed, so no worker holds the row and the sweep
    is refunding it. It earns its place because the alternative — going on
    saying "being drawn" over a render that died — is what held the founder in
    a locked sheet. The assertion below is what stops it becoming a progress
    scale by accretion: those three, and a fourth would need this line changed
    on purpose.
  */
  it("names two stages of progress, a settling state, and nothing else", async () => {
    const source = await readFile(VIEWER, "utf8");
    const at = source.indexOf("const STAGE_WORDS");
    expect(at).toBeGreaterThan(-1);
    const map = source.slice(at, source.indexOf("};", at));
    expect(map.length).toBeGreaterThan(0);
    expect(map).toContain("queued");
    expect(map).toContain("dispatched");
    expect(map).toContain("in line");
    expect(map).toContain("being drawn");
    expect(map).toContain("settling");
    /* Three keys, counted — `queued:`, `dispatched:`, `settling:`. */
    expect(map.match(/^\s{2}\w+:/gm)?.length).toBe(3);
  });

  /*
    AND IT MUST NOT KEEP PROMISING A WAIT THAT IS OVER. "Usually a minute or
    two" is a statement about a render in progress; over a row the sweep has
    taken it is a promise about nothing, and the only fact the customer needs
    at that moment is where their credits went.
  */
  it("swaps the typical-wait line for the money sentence once it is settling", async () => {
    const source = await readFile(VIEWER, "utf8");
    const at = source.indexOf("const SETTLING_NOTE");
    expect(at).toBeGreaterThan(-1);
    expect(source.slice(at, source.indexOf("\n", at))).toContain("credits come back on their own");
    expect(source).toContain('wait.stage === "settling" ? SETTLING_NOTE : TYPICAL_WAIT');
  });

  /*
    NO PERCENTAGE, NO COUNTER. The client receives nothing between dispatch and
    landing, so anything numeric here would be measuring nothing. The measured
    "usually" line is a copy constant and says so.
  */
  it("shows no percentage and no elapsed counter", async () => {
    const source = await readFile(VIEWER, "utf8");
    const wait = source.slice(source.indexOf("export type ViewerWait"));
    expect(wait).not.toMatch(/%\{|percent|Math\.round\(.*elapsed/i);
    expect(wait).not.toMatch(/setInterval|Date\.now\(\)/);
  });

  it("carries the measured typical wait with its provenance", async () => {
    const source = await readFile(VIEWER, "utf8");
    const constant = source.slice(
      source.indexOf(" * How long a refine usually takes"),
      source.indexOf("const TYPICAL_WAIT"),
    );
    /* A number nobody can date is a number nobody has checked. */
    expect(constant).toMatch(/2026-08-05/);
    expect(constant).toMatch(/median 31s/);
    expect(constant).toMatch(/deliberate/);
  });

  it("shows the user's own words, from the record", async () => {
    const source = await readFile(VIEWER, "utf8");
    expect(source).toContain("{wait.instruction}");
  });
});

describe("the answer chips are the typed path, not a second one", () => {
  /*
    THE WHOLE POINT. A chip submits its own LABEL — exactly what someone typing
    the answer sends — so both routes are one code path on the server. A chip
    that posted its `resolves` instead would be a second implementation, and the
    two would drift the first time either changed.
  */
  it("submits the chip's label, the same string a person would type", async () => {
    const source = await readFile(PANEL, "utf8");
    const chips = source.slice(source.indexOf('className="dpc-refine__answers"'));
    expect(chips).toContain("onRefine(option.label)");
    expect(chips).not.toContain("onRefine(option.resolves)");
  });

  it("leaves the box live beside them", async () => {
    const source = await readFile(PANEL, "utf8");
    /* The field is disabled only while something is RUNNING — never because a
       question is open, which would make chips the only way to answer. */
    expect(source).toContain("disabled={busy}");
    const field = source.slice(source.indexOf('className="dpc-refine__field"'));
    expect(field.slice(0, 400)).not.toContain("reask");
  });

  it("renders them in the panel's own frame, never in a dialog", async () => {
    const source = await readFile(PANEL, "utf8");
    expect(source).not.toMatch(/role="dialog"|createPortal|<Modal|aria-modal/);
  });

  /*
    UNTIL DISMISSED MEANS UNTIL SUPERSEDED, TOO.

    The walk found a refusal about a necklace sitting above a live "Refining…"
    for something else entirely. Both the sentence and its chips go the moment
    the next instruction is submitted, or the panel is describing a request
    nobody made any more.
  */
  it("clears the question and its chips when the next instruction is sent", async () => {
    const sheet = await readFile(SHEET, "utf8");
    /* The submit path is now the named `askRefine`, called by the ask box AND
       by the box that opens on the picture (fable-200) — one handler, because a
       second copy of it would drift on the thing that spends money. */
    /* Anchored on the NAME rather than the whole signature, and the anchor is
       asserted before it is used: `indexOf` on a signature that has since grown
       a parameter returns -1, and a slice from -1 is an empty string — a reader
       that says nothing, shaped exactly like a passing one. It cost this suite
       a red when `scope` arrived (fable-444). */
    const at = sheet.indexOf("function askRefine(instruction: string");
    expect(at).toBeGreaterThan(-1);
    const submit = sheet.slice(at);
    const beforeMutation = submit.slice(0, submit.indexOf("refine"));
    expect(beforeMutation.length).toBeGreaterThan(0);
    expect(beforeMutation).toContain("setRefineOutcome(null)");
    expect(beforeMutation).toContain("setReaskOptions(null)");
  });

  /*
    THE POLL MUST NOT DEADLOCK ON ITSELF — found by the production walk, not by
    any test that existed.

    The wait is read from the server, and the query that reads it was gated on
    `pending` alone: pending is empty when a refine is submitted, so nothing
    re-asked, so pending never became non-empty, so the loader never appeared
    for the one person actually waiting. It only showed up after a remount.
  */
  it("keeps polling while a refine is in flight, not only once one is known", async () => {
    const sheet = await readFile(SHEET, "utf8");
    /* The VARIANTS query's interval — the session query has one too, and it is
       not the one this law is about. */
    const query = sheet.slice(sheet.indexOf("trpc.castingV2.variants.useQuery"));
    const options = query.slice(query.indexOf("refetchInterval:"));
    const interval = options.slice(0, options.indexOf("),") + 2);
    expect(interval.length).toBeGreaterThan(0);
    expect(interval).toContain("pending?.length");
    /*
      The client's own knowledge of an outstanding request — now asked about
      the face on screen rather than about the sheet, since one mutation hook
      serves all eight (fable-465). The deadlock this guards is unchanged: the
      poll must start before the server has anything to report.
    */
    expect(interval).toContain("refineIsOutForViewer");
  });

  it("withdraws the question when it is dismissed", async () => {
    const sheet = await readFile(SHEET, "utf8");
    const dismiss = sheet.slice(sheet.indexOf("onDismissOutcome={"));
    expect(dismiss.slice(0, 400)).toContain("pendingReask.current = null");
    expect(dismiss.slice(0, 400)).toContain("setReaskOptions(null)");
  });
});
