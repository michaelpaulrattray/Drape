/**
 * The interpreter (plan §E, Path A).
 *
 * One text call turns a sentence into a `CastingIntent`. It runs before the
 * claim, so it is free to fail, and it is never trusted: the response goes
 * through `parseCastingIntent`, which keeps what is in the allowlist and drops
 * everything else.
 *
 * The system prompt below is the restraint doctrine (catalog H7), and the
 * reason it is written this way is worth stating plainly, because the opposite
 * instruction is the one that failed. M3's interpreter was asked for "one
 * vivid, concrete description" and produced a rich, specific character —
 * complete with a plaid shirt and a captioned mug that every candidate then
 * inherited. Rich output from this stage is not a feature. Legacy learned the
 * same lesson the same way: *"If you fill them with plausible defaults, you
 * constrain the engine and produce a generic Brazilian cast every time. Empty
 * fields become creative opportunities for the engine; wrong fields become
 * user-trust violations."*
 */
import { createModuleLogger } from "../logging/logger";
import { createOpenRouterTextEngine } from "../providers/openrouterText";
import type { TextEngine } from "../providers/types";
import {
  AGE_BANDS,
  ARCHETYPE_KEYS,
  LOOK_KEYS,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  SEXES,
  parseCastingIntent,
  type CastingIntent,
} from "./castingIntent";
import { containsBrand } from "./brandScrub";
import { namesUnknownProperNoun } from "./properNouns";

const log = createModuleLogger("castingV2/interpreter");

/**
 * Parse-failure telemetry, in the shape of the roll-failure alarm.
 *
 * The class this closes: a truncated reply fails the whole parse, the compiler
 * falls back, and every lock the user stated is lost — SILENTLY. It has now
 * happened at three different ceilings (500, 1200, 1800), each time discovered
 * by someone tripping over it rather than by anything announcing it, and the
 * most recent was a 50% rate found only because a paid A/B measurement happened
 * to be running.
 *
 * A ceiling will always be a guess. Whether we are hitting it must not be, so
 * the rate is counted and crosses into `log.error` on its own — the same
 * "stop, something is wrong with US not the brief" shape the provider-account
 * alarm uses, rather than per-request noise nobody aggregates.
 */
const parseStats = { attempts: 0, failures: 0, truncations: 0 };

/** Exported so a test can assert the alarm fires rather than trusting it does. */
export function interpreterParseStats(): Readonly<typeof parseStats> {
  return { ...parseStats };
}

const ALARM_AFTER_ATTEMPTS = 20;
const ALARM_FAILURE_RATE = 0.2;

function recordParseOutcome(failed: boolean, truncated: boolean): void {
  parseStats.attempts += 1;
  if (failed) parseStats.failures += 1;
  if (truncated) parseStats.truncations += 1;

  if (parseStats.attempts < ALARM_AFTER_ATTEMPTS) return;
  const rate = parseStats.failures / parseStats.attempts;
  if (rate >= ALARM_FAILURE_RATE) {
    log.error(
      {
        attempts: parseStats.attempts,
        failures: parseStats.failures,
        truncations: parseStats.truncations,
        // Same units and same key as the roll alarm, so the two read alike.
        failureRate: Math.round(rate * 100),
      },
      "[interpreter] PARSE FAILURES ABOVE THRESHOLD — briefs are losing their stated locks to the fallback; check the token ceiling first",
    );
  }
  // Roll the window so one bad hour does not alarm forever.
  if (parseStats.attempts >= ALARM_AFTER_ATTEMPTS * 5) {
    parseStats.attempts = 0;
    parseStats.failures = 0;
    parseStats.truncations = 0;
  }
}

/**
 * Did an aesthetic reference land nowhere at all?
 *
 * PROVABLE, not heuristic: a listed fashion token in the brief is evidence the
 * user named a reference, so all three channels coming back null is a
 * demonstrable miss rather than an honest silence. That is what makes this the
 * role-repair pattern rather than a guess — it can never fire on a true null.
 */
function needsAestheticRetry(briefText: string, intent: CastingIntent): boolean {
  if (!namesSomethingSpecific(briefText)) return false;
  return intent.composedDirection === null && intent.look === null && intent.archetype === null;
}


/**
 * Does the brief name something SPECIFIC that we might have failed to capture?
 *
 * **A listless detector, deliberately** (founder amendment). Two signals, and
 * the union is the point:
 *
 *   - a **proper-noun shape**: capitalized, not sentence-initial, and absent
 *     from our own vocabularies. That catches a director, a film, a scene, a
 *     house — anything a person names — without a list of them existing
 *     anywhere, which is the ruling that keeps this from becoming a culture
 *     dictionary we would have to maintain and defend.
 *   - a **listed fashion token**, still, because the shape alone is not
 *     enough: "miu miu" is typed lowercase, so the founder's own golden brief
 *     would slip past a pure proper-noun test. The list keeps its real job in
 *     `brandScrub` and merely contributes here.
 *
 * **False positives are acceptable by design.** The only cost of a wrong
 * detection is one cheap re-interpretation, so the detector may be sloppy
 * where the guards may not — an asymmetry worth naming, because the same
 * looseness in `scrubBrands` or the garment guard would be a defect.
 */
function namesSomethingSpecific(briefText: string): boolean {
  if (containsBrand(briefText)) return true;
  // Sentence-initial capitals say nothing — every brief starts with one.
  return namesUnknownProperNoun(briefText, { mode: "sentence" });
}

/** Exported for the prompt-contract tests; never used at runtime. */
export const SYSTEM_PROMPT_FOR_TESTS = () => SYSTEM_PROMPT;

const SYSTEM_PROMPT = `You read a casting brief and extract only what it actually says about WHO to cast.

Reply with a single JSON object and nothing else:

{
  "cohort": "photoreal_human" | "other",
  "role": string | null,
  "characterNotes": string | null,
  "sex": ${SEXES.map((value) => `"${value}"`).join(" | ")} | null,
  "ageBand": ${AGE_BANDS.map((value) => `"${value}"`).join(" | ")} | null,
  "agePhase": "early" | "mid" | "late" | null,
  "heritage": [{ "heritage": one of ${HERITAGES.join(", ")}, "pct": number }] (0, 1 or 2 entries),
  "build": ${BUILDS.map((value) => `"${value}"`).join(" | ")} | null,
  "energy": ${ENERGY_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "archetype": ${ARCHETYPE_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "variationAxis": "look" | "disposition" | null,
  "look": ${LOOK_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "reads": [8 short strings] | null,
  "composedDirection": { "thesis": string, "avoid": string } | null,
  "statedHair": { "cutLength": string | null, "colour": string | null, "texture": string | null, "greying": boolean },
  "poolTendencies": { "ageLean": ageBand value | null, "facialHairLean": "clean" | "beard" | "any" | null, "heritageLean": heritage value | null }
}

THE ONE RULE THAT MATTERS: null means the brief did not say. Leave every field
null unless the brief states it or unmistakably implies it. Do not fill fields
with plausible defaults. A field you guess wrong is a broken promise to the
user; a field you leave null is creative room for the casting engine, which
will vary it across the eight candidates.

THE OTHER HALF OF THAT RULE, AND IT IS EQUALLY BINDING: restraint means never
INVENTING. It never means discarding. If the brief plainly states a fact —
an age, a sex, a heritage, a build — you MUST record it. Dropping something
the user actually said is not caution; it is losing their instruction, and it
produces a sheet that ignores what they asked for. Read the brief twice and
check you have captured every fact it contains before you answer.

Worked example: "Mediterranean man in his 70s, weathered face" states three
facts. sex = "male". ageBand = "70s+". heritage = Mediterranean. All three are
stated; none of them may come back null.

WHAT TO EXTRACT
- "role": THE CASTING CATEGORY, in the user's own words, under 12 words — "a dad
  in his 30s", "punk drummer", "wiry cyclist", "corporate lawyer", "high-fashion
  editorial model", "beauty creator".
  REQUIRED whenever the brief names any occupation, type, category or kind of
  person — INCLUDING fashion and modelling categories. "editorial model",
  "runway model", "beauty creator" and "influencer" are all categories and all
  belong here. This field is the only thing that carries the category to the
  casting engine, and losing it produces a sheet of generic people instead of
  the casting the user asked for.
  Keep THEIR words. The rule is never to paraphrase a specific archetype UP into
  a vaguer one — do not turn "punk drummer" into "musician" or "model". It is
  not a reason to drop a category for being broad: if the user's own words are
  "editorial model", then "editorial model" is the role.
  "archetype" NEVER substitutes for this. That field is a closed list of casting
  DIRECTIONS and setting it does not capture the category; a brief can have both,
  and a brief that names a category must fill this one whatever else it fills.
  Leave it null only when the brief names no category at all — "someone with
  kind eyes", "a person in their 40s".
- "characterNotes": short character-side detail the brief gave — bearing,
  demeanour, hair, distinguishing features. Under 25 words.
  This field and "role" are the only text that reaches the image model, and the
  image model is literal. Write only what can be SEEN. "Wide-set almond eyes
  with monolids" produces exactly that; "editorially magnetic" produces
  nothing, and spends the field. No mood words, no marketing language, no
  "stunning", "beautiful", "striking" or "effortless" — if a phrase does not
  name something a photograph could show, leave it out.
  Never write numbers, percentages, ratios or control-signal language in either
  field. Image models render digits as text artefacts in the picture.
  NEVER write a fashion house, magazine or brand name in either field —
  not "Versace editorial style", not "a Vogue cover look". Translate the
  aesthetic into castable direction instead ("sculpted, high-glamour editorial
  casting") and put the house in "archetype" if one fits. A trademark in these
  fields goes straight to the image provider, which refuses it — a real roll
  lost five of eight candidates that way.
- "sex": only from an explicit word or pronoun. "her", "she", "woman", "guy",
  "man" decide it. Never infer sex from a hairstyle, a colour, or an occupation.
  Never output "nonbinary" unless the brief says so explicitly.
- "ageBand": from a stated age or an age idiom ("in her 20s", "mid-forties" →
  "40s", "late teens" → "teens").
  A FUZZY AGE IS STILL A STATED AGE. This is the rule most often got wrong:
  "young" is vaguer than "24" and it is not silence, and dropping it produces a
  sheet running 40s–60s for a brief that said young. Map the idiom, then let the
  phase carry the vagueness:
      young, youthful, twenty-something, in their twenties  → "20s"
      teenage, teen, adolescent, schoolgirl, schoolboy      → "teens"
      young adult, early career, graduate, junior           → "20s"
      thirty-something, early career-established            → "30s"
      middle-aged, midlife, mid-career                      → "40s"
      older, mature, senior, veteran                        → "60s"
      elderly, elder, old, aged, pensioner, retired         → "70s+"
  "Greying" is NOT an age idiom and must not set ageBand. It is a statement
  about HAIR, and absorbing it into an age band is how the grey stops reaching
  the picture: the band is a number, and nothing downstream can recover a
  colour from it. Record what the brief said about the hair in
  "characterNotes" and leave the age alone unless the brief also gives one.
  Set "agePhase" only where the brief pins the part of the decade. "Young" gives
  ageBand "20s" and agePhase NULL — the band is what they said, the phase is the
  latitude they left. That pairing is the whole point: it honours the fact
  without inventing precision the brief did not carry.
  Leave ageBand null only when the brief truly says nothing about age at all.
- "agePhase": set it ONLY when the brief pins where in the decade. "early 20s"
  → "early"; "mid-forties" → "mid"; "late teens" → "late"; a bare "in her 20s"
  → null. This is a second, separate lock: filling it wrongly narrows the
  casting pool, and leaving it null when the user said "early" lets the sheet
  drift a decade older than they asked for.
- "heritage": only when stated. A nationality maps to the nearest listed
  heritage. Bare "mixed" or "ambiguous" is not a heritage — leave it empty.
  A hyphenated or dual heritage gives TWO entries, not one: "Nigerian-British"
  is West African + British Isles, "Korean-American" is East Asian alone
  unless the brief says more. Dropping half of a stated dual heritage loses a
  fact the user pinned, so return both and let the percentages split.
- "energy": only when the brief describes how the person carries themselves.
- "archetype": only when the brief clearly points at one of the listed
  directions. Otherwise null.
- "variationAxis": what should differ between the eight candidates.
  Use "look" when the brief asks for a KIND OF FACE — a model, editorial,
  fashion, runway, beauty or campaign casting. Eight models differ by the sort
  of face a house casts, not by mood; varying mood there returns one look
  wearing eight expressions.
  Use "disposition" when the brief asks for a KIND OF PERSON — a character, an
  occupation, a UGC creator, anyone you would meet. There, eight different
  temperaments is exactly the right difference.
  Null if you genuinely cannot tell.
- "look": only when the brief names a specific casting look. A stated look
  locks across all eight; leave it null and the eight will each take a
  different one.
- "composedDirection": when the brief carries a STRONG DOCUMENTED AESTHETIC that
  none of the listed "archetype" values fits. Two sources qualify:
      an aesthetic REFERENCE — a fashion house, a director, a film, a scene; or
      a CASTING CATEGORY with a strong aesthetic of its own — a k-pop idol, a
      drill sergeant, a monk, a Viking, a biker gang leader.
  An ORDINARY OCCUPATION never qualifies. A skincare founder, a nurse, an
  accountant, a teacher have no documented casting aesthetic, and inventing one
  for them narrows the sheet for no reason — leave this null, as you would any
  other field the brief did not fill.
  Compose it in the same shape the archetype list uses:
      "thesis": what kind of FACE AND BEARING this casting wants, under 30
                words. Bearing is half of an aesthetic and is usually the half
                that is missing: a house that commands the lens, a casting that
                is doe-eyed and slightly awkward, the soft stage-charisma of an
                idol, the flint of a man who leads a gang. Name how the person
                HOLDS THEMSELVES, not only how they are built.
      "avoid":  the anti-pattern — what it must not collapse into, under 20.
  ADDITIVE, NEVER A SUBSTITUTE. Keep filling "archetype", "look" and every
  other field exactly as you would have. If a listed archetype fits, use it and
  leave this null — this field is for references the list cannot hold, not a
  second place to put things that already have a home.
  FACE, HAIR AND BEARING ONLY. Never clothing, accessories, makeup, fabric,
  logos or setting — the photograph is a plain grey tee on seamless paper, so a
  direction about clothes describes something that cannot appear.
  NEVER NAME THE REFERENCE. Not the house, not the designer, not the film.
  Describe the casting, not the brand: "quirky, slightly awkward prep-school
  beauty — unconventional features worn with total ease", never "the X girl".
  A reference to someone's AESTHETIC is direction and belongs here. Casting the
  PERSON is refused — that rule is unchanged and this field never overrides it.
- "reads": exactly eight short labels — two or three words each, under 26
  characters — describing eight different people who all fit this brief. They
  caption the tiles, so write them in the brief's OWN register: a nurse sheet
  might read "Steady", "Seen it all", "Quietly funny"; a punk drummer sheet
  would read nothing like that. Describe the person at rest, never an action or
  an expression being performed. These are labels, not sentences, and they
  never affect the image — only what the tile is called.
  ALWAYS return eight. This is the one field that is not subject to the
  leave-it-null rule: it is a caption, not a casting fact, so there is no
  wrong guess to make — and falling back to a generic set makes every sheet
  read like every other sheet.
- "statedHair": WHAT the brief said about each part of the hair, in the user's
  own words. Copy their words; do not translate, normalise or improve them.
      "cutLength": the length or the cut — "long", "a bob", "shoulder-length".
      "colour":    the colour — "pastel pink", "auburn", "jet black".
      "texture":   how it grows — "curly", "straight", "coiled".
      "greying":   true when the brief describes greying rather than naming a
                   colour — "salt and pepper", "silver at the temples",
                   "greying at the sides". This is a PROCESS, not a shade: the
                   colour underneath is still open, so set this true and leave
                   "colour" null.
  Leave a part null when the brief did not speak to it. A brief that mentions
  only the colour fills only "colour" — the cut and the texture stay null and
  the casting engine will vary them across the eight, which is the point.
  USE ONLY WORDS THAT APPEAR IN THE BRIEF. Anything you write here is checked
  against the user's sentence and dropped if it contains a word they did not
  type, so a paraphrase is worse than a null — it is silently discarded.
  Do NOT fill this for "bald", "shaved" or "buzzed" briefs. Those leave no
  remainder to describe and the engine handles them on its own.
  THIS IS IN ADDITION TO, NEVER INSTEAD OF, "role" and "characterNotes". If the
  brief says "a redhead in her 30s", "redhead" belongs in the hair colour AND
  the sentence still gets whatever role and character detail it would otherwise
  have had. Filling this field is never a reason to leave another one empty.
- "poolTendencies": what the CASTING CATEGORY typically implies about axes the
  brief did not state. This is a TENDENCY, never a fact: it nudges the odds
  across the eight candidates and can never override anything the brief said.
      "ageLean": the age band this kind of casting centres on, when it clearly
                 centres on one. A Twitch streamer or a university student
                 leans "20s"; a retirement-community resident leans "70s+".
                 PHYSICAL TRADES AND PHYSICALLY DEMANDING WORK lean working-age
                 — a lumberjack, a roofer, a soldier, a deckhand centre on
                 "30s", because the pool genuinely does. A lawyer or a teacher
                 spans every working decade and leans nothing — leave it null.
      "facialHairLean": "clean" when the category is conventionally clean-shaven
                 (k-pop idol, cabin crew, competitive swimmer); "beard" when it
                 conventionally is not (lumberjack, biker, craft brewer); "any"
                 when the category genuinely spans both and you want the sheet
                 to show the range. Null when the category implies nothing.
      "heritageLean": the heritage this casting's real pool predominantly draws
                 from, when it genuinely does — a k-pop idol leans "East Asian",
                 a Bollywood casting leans "South Asian", a Nordic folk singer
                 leans "Nordic". This describes a POOL, never a requirement:
                 most of the sheet will lean this way and some of it will not,
                 which is correct, because those castings really do include
                 people from elsewhere. Leave it null for anything
                 international or unmarked — a doctor, a model, a streamer.
  Only fill these from the CATEGORY, never from the individual. If the brief
  states an age or facial hair, that is a fact and belongs in its own field —
  putting it here instead would weaken a thing the user actually said.
  Leave both null when the brief names no category, or names one that implies
  nothing. A tendency you invent narrows the casting for no reason.
- "cohort": "photoreal_human" for any real-looking human. Use "other" for
  anime, illustration, animals, robots, fantasy creatures, or any brief that is
  not a photograph of a person.
  ALSO use "other" when the brief asks for a SPECIFIC PERSON OR CHARACTER —
  a named actor, musician, athlete or public figure, or a named fictional
  character from a game, film, comic or show. "Master Chief from Halo", "a
  Spider-Man look-alike", "someone who looks like <name>" are all "other".
  This holds however it is phrased: "look-alike", "inspired by", "in the style
  of", "vibes of", "reminds me of" are the same request wearing softer words.
  Two reasons, and both matter. We do not manufacture a likeness of a real
  person or someone else's character — the same principle that says a
  customer's own cast is theirs. And we cannot: the frame is a plain studio
  portrait with no costume, armour, mask or props, so the thing that makes
  that character recognisable is exactly what the frame strips away.
  A GENRE is not a character. "a space marine", "a superhero type", "a fantasy
  ranger" describe a kind of person and are ordinary photoreal briefs — cast
  them normally.

WHAT TO IGNORE COMPLETELY — the engine owns these, and anything you say about
them is discarded before it reaches the image model:
- The photograph: camera, lens, lighting, background, crop, pose, composition.
- The setting: locations, rooms, weather, activities, times of day. "In a
  cluttered garage" tells you this person works with their hands; it does not
  put a garage in the picture.
- Wardrobe, props, objects held, accessories, or anything with writing on it.
- Mood words that are not castable ("magnetic", "stunning", "iconic").
- Celebrity likeness. "Looks like Zendaya" gives you sex and maybe age. Stop
  there.

Never invent a detail the brief did not contain. Never write prose outside the
JSON.`;

export type InterpretOutcome =
  | { ok: true; intent: CastingIntent; latencyMs: number; model: string }
  | { ok: false; reason: "unsupported_cohort" }
  | { ok: false; reason: "unavailable"; latencyMs: number };

let engine: TextEngine | null = null;

function interpreterEngine(): TextEngine | null {
  if (engine) return engine;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  engine = createOpenRouterTextEngine({ apiKey });
  return engine;
}

/** Test seam: drops the memoized engine so config changes take effect. */
export function resetInterpreterForTests(): void {
  engine = null;
}

/**
 * Read one brief.
 *
 * Three outcomes, and the difference between the last two is the difference
 * between a product decision and an outage:
 *
 *   - an intent;
 *   - `unsupported_cohort` — a real answer. The brief asks for something no
 *     certified adapter can cast, so the caller refuses for free rather than
 *     producing a photograph of someone vaguely anime-adjacent;
 *   - `unavailable` — the transport failed, or the reply was unreadable. Not
 *     the user's problem and not a reason to lose their roll: the caller falls
 *     back to compiling from the sentence itself. This is the house's
 *     fail-open policy for checkers (catalog H30) — an interpreter outage must
 *     never block a paid run.
 */
export async function interpretBrief(input: {
  briefText: string;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<InterpretOutcome> {
  const textEngine = input.engine ?? interpreterEngine();
  if (!textEngine) {
    log.warn({}, "[interpreter] no OPENROUTER_API_KEY — compiling without interpretation");
    return { ok: false, reason: "unavailable", latencyMs: 0 };
  }

  const startedAt = Date.now();
  /** One sampling of the interpreter. Named so the retry can repeat it exactly. */
  const runOnce = () =>
    textEngine.complete({
      system: SYSTEM_PROMPT,
      user: input.briefText,
      json: true,
      // Low, because this is extraction. Creativity belongs downstream, in the
      // adapter's variation axes and in the image model itself.
      temperature: 0.2,
      /*
        Headroom, deliberately generous. The eight `reads` labels roughly
        doubled the reply length, and at 500 the JSON began truncating
        mid-object on longer briefs — which does not degrade to "no reads", it
        fails the whole parse and drops the intent to `unavailable`. A brief
        that interpreted fine yesterday silently lost every one of its locks.
        The cost of the extra ceiling is a fraction of a cent; the cost of
        truncation is the user's stated facts.

        Raised 1200 → 1800 when `composedDirection` landed. The A/B measured
        HALF of the Margiela samples failing to parse on the new prompt against
        none on the old — the extra thesis-and-avoid pushes a reply that also
        carries eight `reads` past the old ceiling. Same lesson as the 500, one
        field later: a truncated reply does not degrade to a missing field, it
        fails the whole parse and drops every lock the brief stated.
      */
      maxOutputTokens: 1800,
      signal: input.signal,
    });

  try {
    const result = await runOnce();
    const parsed = parseCastingIntent(result.text, input.briefText);
    recordParseOutcome(!parsed.ok, result.truncated === true);

    /*
      A REPLY CUT OFF FOR LENGTH IS TRANSPORT, NOT A VERDICT.

      This is the gravest class in the subsystem wearing a transport costume:
      the fragment fails the parse, the compiler falls back, and the sheet is
      cast as though the brief had said nothing — losing the sex, the age, the
      heritage the user actually typed. Silently, and identically to a genuine
      "the model returned nonsense".

      So it is retried once as the transport failure it is, rather than
      swallowed. A truncated interpretation can never masquerade as an honest
      null.
    */
    if (!parsed.ok && result.truncated) {
      log.warn(
        { latencyMs: result.latencyMs },
        "[interpreter] reply was CUT OFF at the token ceiling — retrying rather than dropping the brief's locks",
      );
      const retry = await runOnce();
      const reparsed = parseCastingIntent(retry.text, input.briefText);
      recordParseOutcome(!reparsed.ok, retry.truncated === true);
      if (reparsed.ok) {
        return {
          ok: true,
          intent: reparsed.intent,
          latencyMs: result.latencyMs + retry.latencyMs,
          model: retry.provenance.servedModel ?? retry.provenance.model,
        };
      }
    }

    if (!parsed.ok) {
      if (parsed.reason === "unsupported_cohort") return { ok: false, reason: "unsupported_cohort" };
      log.warn(
        { latencyMs: result.latencyMs, truncated: result.truncated === true },
        "[interpreter] reply could not be read as an intent — falling back",
      );
      return { ok: false, reason: "unavailable", latencyMs: result.latencyMs };
    }

    /*
      M3 condition 4 closed. The report could not evaluate §E.1's "+5s median"
      budget because the harness recorded image latency only, and said so:
      "Recording per-call text latency is a one-line harness change for the
      next run." This is that line, in the product rather than the harness, so
      the treatment stage's cost is measurable the day it lands.
    */
    log.info(
      { stage: "interpreter", latencyMs: result.latencyMs, model: result.provenance.servedModel },
      "[interpreter] brief interpreted",
    );

    /*
      THE AESTHETIC-REFERENCE RETRY.

      Narrow, provable, and it can never fire on a true null — the role-repair
      pattern. The condition is: the brief contains a LISTED FASHION TOKEN, and
      the interpretation landed the aesthetic nowhere at all. A brand token in
      the sentence is proof the user named a reference, so "all three null" is
      demonstrably a miss rather than an honest silence.

      One re-sample, never a loop. The failure is stochastic — measured at
      roughly one run in three — so a single retry collapses it without turning
      a bad day at the provider into an unbounded spend.

      GENERAL references get the same promise tier as fashion ones, and the
      former named limit is closed. The detector is LISTLESS: a proper-noun
      shape none of our vocabularies claims, plus the fashion tokens for the
      lowercase case. So "a Wes Anderson casting" is repaired exactly as "a miu
      miu campaign model" is, and no film or culture list exists — or is
      wanted.
    */
    let intent = parsed.intent;
    if (needsAestheticRetry(input.briefText, intent)) {
      log.info({ stage: "interpreter" }, "[interpreter] aesthetic reference landed nowhere — re-sampling once");
      const retry = await runOnce();
      const reparsed = parseCastingIntent(retry.text, input.briefText);
      // Counted like any other attempt. A denominator that skips the retries
      // is a rate nobody can act on — this one keeps the same brief's second
      // reply in the same window as its first.
      recordParseOutcome(!reparsed.ok, retry.truncated === true);
      if (reparsed.ok && !needsAestheticRetry(input.briefText, reparsed.intent)) intent = reparsed.intent;
    }

    return {
      ok: true,
      intent,
      latencyMs: result.latencyMs,
      model: result.provenance.servedModel ?? result.provenance.model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    log.warn({ err: error, latencyMs }, "[interpreter] unavailable — compiling without it");
    return { ok: false, reason: "unavailable", latencyMs };
  }
}

export { SYSTEM_PROMPT as INTERPRETER_SYSTEM_PROMPT };
