/**
 * THE LANDING PAGE NAMES NO ENGINE (#1560).
 *
 * # What was there
 *
 * A pill fixed to the bottom-right corner of klieglabs.com, above everything,
 * at every scroll position: a Google-gradient diamond and the words **Powered
 * by Gemini**, linking out to `deepmind.google/technologies/gemini/`. The first
 * surface anybody meets, and the one thing it told them about the product was
 * the name of somebody else's model.
 *
 * It arrived in the scaffold-era homepage redesign (`790dd42c5`, `354678509` —
 * *"Powered by Gemini badge now has proper glassmorphism pill"*), not by a
 * decision, and nobody re-read it afterwards.
 *
 * # Why it is a defect twice over
 *
 * **The law.** `CLAUDE.md`'s disappearing-technology law has exactly one narrow
 * prohibition, verbatim: *no engine name on a path someone must walk to reach
 * their picture — not the primary button, not a loader, not an error, not a
 * required step.* The landing page is the path. His own brief for the product
 * says the other half: *the choice of model — dozens of them, each changing
 * every few months — is Klieg's homework, decided inside the codebase by
 * measurement and never put in front of the person paying.*
 *
 * **The fact.** Read at the code 2026-09-30, not quoted from a document: a roll
 * renders on `openai/gpt-image-2.5/sunburst/text-to-image`
 * (`server/providers/falImages.ts:90`, reached from `castingV2/rollEngine.ts`)
 * and a delivered signed view on `fal-ai/nano-banana-pro`
 * (`server/providers/falQueue.ts:30`, reached from `castingV2/signEngine.ts`),
 * **both through fal, neither through Google AI Studio.** The first picture
 * anybody gets is an OpenAI model's. A badge naming one vendor while the
 * pictures come from two engines through a third party was a false claim as well
 * as a law one.
 *
 * # What this guard is, and the wider one it deliberately is NOT
 *
 * ⚠ **IT IS SCOPED TO THE LANDING PAGE, AND THAT IS THE WHOLE DESIGN RATHER
 * THAN A CONVENIENCE.** His correction on the day he set the law down: *"pickers
 * will exist in the future purely because that in itself is something we are
 * offering the user"* — for an AI studio the model is MATERIAL, and a picker
 * that names its models plainly is a feature this product intends to sell. So a
 * guard over `client/src` whole would refuse the founder's own ruling. The
 * landing page is the one customer surface where a picker can never live: there
 * is no picture to choose an engine for, and nobody signed in to choose it.
 *
 * Its sibling on the other surface is
 * `client/src/features/castingV2/candidateFailureWords.test.ts` (#1551), which
 * owns a failed tile's chip and sentence. **Both read their engine names out of
 * `shared/engineVocabulary.ts` rather than each keeping a copy** — the engine
 * this product rolls on changed three times in September 2026, and a guard whose
 * vocabulary was written against the previous engine reads green over the new
 * one's name.
 *
 * # The arm that answers this card's actual lesson
 *
 * The card's sentence is *"nobody has re-read it since the engines moved."* A
 * word list alone cannot fix that — it only ever knows the engines somebody
 * thought of. So the last arm runs the other way: **every model id the provider
 * modules declare must carry a name this vocabulary knows.** An engine arriving
 * in the product without its brand phrase in the list is a red pointing at the
 * list, which is the only shape of guard that survives the next switch.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ENGINE_AND_VENDOR_NAMES } from "@shared/engineVocabulary";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* Its arms read the real tree, and under the parallel run that cost multiplies
   against vitest's 5,000 ms default. File level, never per arm (#741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * THE READER, and it lives here rather than beside the words.
 *
 * `shared/engineVocabulary.ts` carries the NAMES and deliberately no matcher:
 * this surface must catch a model SLUG pasted out of a provider module, so it
 * normalises every separator to a space before comparing, while #1551's chip
 * guard compares its own lowercase text and should not be loosened to match a
 * slug it can never contain. One shared matcher would have to be the looser of
 * the two. `openai/gpt-image-2.5/sunburst/text-to-image` normalises to `openai
 * gpt image 2.5 sunburst text to image`, which carries two of the names.
 *
 * ⚠ A DOT is not a separator here: collapsing it would turn `fal.ai` into `fal
 * ai` and make the vendor's own name unmatchable in the one place it is written.
 */
const normaliseEngineText = (text: string) => text.toLowerCase().replace(/[-_/\s]+/g, " ");

/** Which of the names this text carries, normalised on the way in. */
function engineNamesIn(text: string): string[] {
  const normalised = normaliseEngineText(text);
  return ENGINE_AND_VENDOR_NAMES.filter(({ word }) => normalised.includes(word)).map(
    ({ word }) => word,
  );
}

/** `gemini — an engine name on a path someone must walk`, for a red's message. */
function whyRefused(word: string): string {
  const entry = ENGINE_AND_VENDOR_NAMES.find((candidate) => candidate.word === word);
  return entry ? `${entry.word} — ${entry.why}` : word;
}

const REPO = path.resolve(__dirname, "..");

/**
 * `readListedSource` answers `null` for a file that was gone by the time it was
 * read — the right answer for a walk over `scripts/`, where hundreds of
 * disposables come and go while the suites run (#223).
 *
 * ⚠ **EVERY FILE THIS SUITE READS IS TRACKED AND NAMED, SO HERE A `null` IS A
 * REFUSAL RATHER THAN A SKIP.** Its population is six landing-page modules and
 * two provider modules; none of them can legitimately vanish mid-run. The
 * precedent callers skip and then hold a floor of five hundred files, which is
 * the correct shape for a sweep of thousands and the wrong one for eight: a
 * `continue` here could empty the population and every arm below would read
 * green on nothing (invariant 7).
 */
function mustRead(file: string): string {
  const source = readListedSource(file);
  if (source === null) {
    throw new Error(
      `${path.relative(REPO, file)} is on this guard's population and could not be read — it is a tracked file, so this is a broken population rather than a vanished disposable`,
    );
  }
  return source;
}

/** The landing page's entry, which `App.tsx` mounts at `/`. */
const HOME = path.join(REPO, "client", "src", "pages", "Home.tsx");

/** Where its own components live. */
const HOME_FEATURE_DIR = path.join(REPO, "client", "src", "features", "home");

/**
 * Strip comments, so a docblock explaining the rule cannot trip the rule.
 *
 * This file's own subject is the clearest case: `Home.tsx`'s header now NAMES
 * the engines, on purpose, so that *"matches the celestial-horizon reference
 * exactly"* is never read as an instruction to put the badge back. A guard that
 * reddened on that sentence would delete the record of its own reason.
 *
 * ⚠ **IT WAS A LOCAL REGEX PAIR UNTIL #1625, AND THE SWAP WAS MEASURED BEFORE
 * IT LANDED.** The regex shape was not quote-aware, so a `/*` inside a string
 * literal opened a comment it was never in and everything to the next `*` and
 * slash left this guard's sight — the silence direction, on a guard whose whole
 * job is to NOT find something. Driven over this suite's own population the day
 * it changed: **6 landing files + 2 provider modules, 8 of the 8 strip to
 * different bytes, the declared model-id count is 8 either way with no id
 * gained or lost, and every arm below stays green.** What it buys is the
 * direction: the shared reader can only leave MORE text standing here, and more
 * text is what a guard looking for a forbidden word wants to see.
 *
 * ⚠ **AND IT WAS ONE OF 27 BYTE-IDENTICAL COPIES OF THAT REGEX PAIR, not the
 * second implementation the card believed it was.** The other 26 are the
 * remainder and are carded; converting them is a sweep with its own before and
 * after over 26 live guards, not a line in this one.
 */
const code = withoutComments;

/** Every `.tsx`/`.ts` file the landing page is made of, off the real tree. */
function landingFiles(): string[] {
  const out: string[] = [HOME];
  for (const entry of fs.readdirSync(HOME_FEATURE_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(path.join(HOME_FEATURE_DIR, entry.name));
  }
  return out;
}

/** The specifiers `Home.tsx` imports — raw source, because a specifier is a string. */
function homeImportSpecifiers(): string[] {
  const source = mustRead(HOME);
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}

/** Model ids the fal provider modules declare — `vendor/model[/sub]`, quoted. */
function declaredModelIds(): Array<{ file: string; id: string }> {
  const modules = ["falImages.ts", "falQueue.ts"].map((name) =>
    path.join(REPO, "server", "providers", name),
  );
  const out: Array<{ file: string; id: string }> = [];
  for (const file of modules) {
    const source = mustRead(file);
    for (const match of source.matchAll(/"([a-z0-9][a-z0-9.-]*\/[a-z0-9./-]+)"/g)) {
      out.push({ file: path.basename(file), id: match[1] });
    }
  }
  return out;
}

describe("the landing page names no engine and no vendor", () => {
  it("found the landing page at all — the population, with a floor", () => {
    const files = landingFiles();
    /* A guard that read zero files would pass every arm below it. The floor is
       the entry plus the five components `Home.tsx` composes today; it is a
       floor rather than an equality so that adding a sixth is not a red. */
    expect(fs.existsSync(HOME), `${HOME} is the route App.tsx mounts at /`).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.some((file) => file.endsWith("Home.tsx"))).toBe(true);
  });

  it("carries none of the names, in any file a customer's browser renders", () => {
    for (const file of landingFiles()) {
      const found = engineNamesIn(code(mustRead(file)));
      const why = found.map(whyRefused).join("; ");
      expect(found, `${path.relative(REPO, file)} — ${why}`).toEqual([]);
    }
  });

  it("and no outbound link to a model vendor", () => {
    for (const file of landingFiles()) {
      const source = code(mustRead(file));
      const hrefs = [...source.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      for (const href of hrefs) {
        expect(engineNamesIn(href), `${path.relative(REPO, file)} links to ${href}`).toEqual(
          [],
        );
      }
    }
  });

  it("keeps its own components inside the population it sweeps", () => {
    /*
      THE CONTAINMENT ARM. Without it the guard is a promise about one directory
      rather than about the landing page: a new component holding the next badge
      need only live somewhere else to escape. So every specifier `Home.tsx`
      imports that resolves INSIDE `client/src` must be a file this sweep reads,
      with the shared primitives it may legitimately reach named as the
      exceptions they are.
    */
    const swept = new Set(landingFiles().map((file) => file.replace(/\\/g, "/")));
    const allowedOutside = ["@/components/ui/", "@/lib/", "@/foundation/", "@shared/"];
    for (const specifier of homeImportSpecifiers()) {
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      if (allowedOutside.some((prefix) => specifier.startsWith(prefix))) continue;
      const rel = specifier.startsWith("@/")
        ? path.join(REPO, "client", "src", specifier.slice(2))
        : path.resolve(path.dirname(HOME), specifier);
      const candidates = [`${rel}.tsx`, `${rel}.ts`].map((file) => file.replace(/\\/g, "/"));
      expect(
        candidates.some((file) => swept.has(file)),
        `Home.tsx imports ${specifier}, which this guard does not read — put it under client/src/features/home/, or add its prefix to allowedOutside with a reason`,
      ).toBe(true);
    }
  });

  it("CAN FAIL — the real badge is caught, by the two words that caught it", () => {
    /*
      THE POSITIVE CONTROL (working law 2). Every arm above asserts an EMPTY
      list, and an empty list is what a broken reader returns too — a typo in one
      vocabulary entry, a normaliser that lost its lowercase, a `landingFiles()`
      that walked the wrong directory. So the reader is driven against the markup
      this card REMOVED, quoted from `Home.tsx` at `03d3c1cad`.
    */
    const removed = `
      <div className="fixed bottom-6 right-6 z-50">
        <a href="https://deepmind.google/technologies/gemini/" target="_blank">
          <svg><linearGradient id="gemini-gradient" /></svg>
          Powered by Gemini
        </a>
      </div>`;
    expect(engineNamesIn(removed)).toEqual(["gemini", "deepmind"]);

    /* And the class, not only the instance: the engines it should have named. */
    expect(engineNamesIn("Powered by Nano Banana Pro")).toEqual(["nano banana"]);
    expect(engineNamesIn("Rendered on GPT Image 2.5 Sunburst")).toEqual([
      "sunburst",
      "gpt image",
    ]);
    /* A slug, which is the shape a copy-paste from the provider module makes. */
    expect(engineNamesIn("openai/gpt-image-2.5/sunburst/text-to-image")).toEqual([
      "sunburst",
      "gpt image",
    ]);
  });

  it("does NOT fire on a comment — including the one Home.tsx now carries", () => {
    /*
      THE NEGATIVE CONTROL, and it is not hypothetical: `Home.tsx`'s header names
      Sunburst, Nano Banana Pro, Gemini and deepmind.google deliberately, so the
      next person reading *"matches the reference exactly"* knows what was taken
      out and why. If the stripper failed, the honest record would be the thing
      that reddened, and the cheapest repair would be to delete it.
    */
    const home = mustRead(HOME);
    expect(engineNamesIn(home).length).toBeGreaterThan(0);
    expect(engineNamesIn(code(home))).toEqual([]);

    /* Both comment shapes, driven rather than assumed. */
    expect(engineNamesIn(code("/* runs on Gemini */\nconst a = 1;"))).toEqual([]);
    expect(engineNamesIn(code("// runs on Gemini\nconst a = 1;"))).toEqual([]);
  });

  it("knows the name of every engine the product actually declares", () => {
    /*
      THE ARM THAT ANSWERS THE CARD'S OWN SENTENCE — *nobody has re-read it since
      the engines moved.* A hand-kept word list can only ever hold the engines
      somebody thought of, so this one runs the other way: each model id the
      provider modules declare must normalise to something this vocabulary knows.
      Add an engine and the red points at `shared/engineVocabulary.ts`.
    */
    const ids = declaredModelIds();
    /* Refuse an empty reading: a regex that stopped matching would otherwise
       turn this arm green by making it blind (invariant 7). */
    expect(ids.length, "no model ids read out of server/providers — the reader is blind").
      toBeGreaterThanOrEqual(8);
    for (const { file, id } of ids) {
      expect(
        engineNamesIn(id),
        `${file} declares ${id} (normalises to "${normaliseEngineText(id)}") and shared/engineVocabulary.ts holds no name for it`,
      ).not.toEqual([]);
    }
  });

  it("is a vocabulary with a stated reason on every entry", () => {
    /* A bare blocklist tells a shift what not to write and never what to write
       instead, which is how a guard gets worked around rather than obeyed. */
    expect(ENGINE_AND_VENDOR_NAMES.length).toBeGreaterThanOrEqual(7);
    for (const { word, why } of ENGINE_AND_VENDOR_NAMES) {
      expect(word, "spelled with spaces, which is what both readers normalise to").toBe(
        word.toLowerCase(),
      );
      expect(word).not.toMatch(/[-_/]/);
      expect(why.length, `${word} has no reason`).toBeGreaterThan(20);
    }
  });
});
