/**
 * WHEN THE READER IS DOWN BECAUSE OF **OUR ACCOUNT** — the one sentence for it,
 * and the one test for when to say it (#2688, the sweep of #2686).
 *
 * # What went wrong, measured rather than supposed
 *
 * On production from 03:09Z on 2026-10-27 the text provider's account key was
 * disabled and every call answered `401`. Four picture-reading roads then told
 * the customer, in their own words:
 *
 *   > *"I couldn't read that picture just now — try again in a moment."*
 *
 * Both halves of that are wrong at once, and they are wrong in different ways.
 * **It was never their picture** — the bytes were never looked at, because the
 * provider refused US before it read anything. And **"in a moment" is advice no
 * retry can satisfy**: a disabled key is not weather, so every retry it invites
 * fails identically, and the customer concludes the fault is the photograph
 * they chose. They swap it, it fails again, and we blame them twice.
 *
 * The #126 class sweep (foreman-111) already fixed the ATTRIBUTION on two of
 * these roads — `readerOutageRefusal.test.ts` drives all four with an
 * overdrawn-account double and is this module's suite. What it did not ask is
 * what the sentence tells the customer to DO, and the money being right the
 * whole time is why nobody looked.
 *
 * # The line this module draws, and it is not "a reader failed"
 *
 * A reader failure splits in two, and only one half is weather:
 *
 *   - **weather** — a 429, a 5xx, a timeout, a transport that died. The same
 *     question a minute later is a different reading, so *"try again in a
 *     moment"* is TRUE and it stays exactly as it was.
 *   - **our account** — a 401, a 402, a 403. Our key, our balance, our access.
 *     Nothing about the request and nothing a retry reaches.
 *
 * {@link readerAccountRefused} and {@link segmenterAccountRefused} are that
 * line, one per transport. Everything they do not match keeps the sentence it
 * already had, which is what makes this a SPLIT rather than a blanket reword —
 * and every arm that asserts the new sentence has a sibling asserting the
 * transient one still appears (`readerDown.test.ts`, and the controls already
 * in `readerOutageRefusal.test.ts`).
 *
 * # Why the sentence and the predicate are ONE module
 *
 * `conceptDescribeCopy.ts` keeps its copy table import-free on purpose: the
 * capability atlas reads that table, and the Atlas's charter is that it never
 * runs app code. **That discipline does not apply here and it would cost
 * something real.** None of this module's four consumers raises a door the
 * atlas collects — roll doors come from `new BriefRefusal("id", …)` and
 * `ROLL_REFUSAL_COPY`, refine doors from `REFINE_REFUSALS`, and these four
 * roads return a plain `{ code, message }` that no collector visits
 * (`scripts/lib/capabilityAtlas.mts`, which says so in terms).
 *
 * What this module needs instead is that **the sentence and the test for when
 * to say it cannot drift apart.** A sentence promising "it is not your picture"
 * is a lie the moment some caller says it for a 500, and a predicate with no
 * sentence beside it is a classification nobody can read. So they sit together,
 * and the suite holds them to each other.
 *
 * # One sentence for four roads, deliberately
 *
 * Four near-identical sentences in four files is the drift working law 4 names,
 * and these four must never come to disagree about whose problem it is: a
 * customer who hits two of them in one sitting is being told about one outage.
 * The two cutters and the two reference readers all read A PICTURE the customer
 * attached, so there is one fact to state and one thing to do about it.
 *
 * ⚠ **AND THERE IS A SECOND COPY OF THIS SENTENCE ARRIVING, NAMED HERE RATHER
 * THAN LEFT TO BE FOUND.** PR #2687 (#2686) adds a local `READER_DOWN_MESSAGE`
 * to `conceptDescribeCopy.ts` for the concept-upload door — the same fact, one
 * entrance over, in that table's own voice. It is **not** imported from here
 * and this module does not touch that file: the atlas reads that table, so it
 * must keep importing nothing, and a branch cut from `origin/main` cannot reach
 * an unmerged file either way. The two sentences are siblings rather than
 * copies — that one says nothing about money because a concept read is house
 * money on every call, and these four say "Nothing was charged" because they
 * sit on paid roads. **What must not drift is the attribution**, and that is
 * held by an arm rather than by this paragraph (`readerDown.test.ts`).
 */
import { ProviderError } from "../providers/types";
import { MaskError } from "./maskGeometry";

/**
 * WHAT THE CUSTOMER IS TOLD WHEN THE PICTURE READER IS REFUSING **US**.
 *
 * Three things it does, and each one is a defect it is replacing:
 *
 *   1. **It names the studio**, not their picture. The sentence it replaces
 *      opened *"I couldn't read that picture"* about bytes nobody looked at.
 *   2. **It says "later", never "in a moment"** — the one thing a retry cannot
 *      fix must not be answered with an instruction to retry.
 *   3. **It says the money is safe**, because all four of these roads are
 *      pre-claim refusals on paid surfaces and every sentence they already
 *      carried said so. Nothing about the money moves in this change.
 *
 * ⚠ **AND IT NAMES NO ENGINE AND NO VENDOR**, which is the
 * disappearing-technology law's one hard line (clause 5: no engine name on a
 * path someone must walk to reach their picture). They are told what happened
 * and whose problem it is — never which provider refused us, and never a status
 * code. Held by an arm.
 */
export const PICTURE_READER_DOWN_MESSAGE =
  "The studio can't read pictures just now — that's something at our end, not your picture. "
  + "Nothing was charged. Try again later.";

/**
 * IS THIS OUR ACCOUNT RATHER THAN THEIR PICTURE — on the TEXT transport.
 *
 * `provider_account` is the text provider's 401/402/403: our key disabled, our
 * balance gone, our access revoked (`openrouterText.ts`'s
 * `classifyOpenRouterTextHttp`, whose own mapping the suite asserts beside this
 * so the fixture cannot drift from the product's idea of what a 402 is).
 *
 * It is the one failure on these roads that is provably nothing to do with the
 * bytes and provably not fixed by trying again, so it is the one that must not
 * keep the weather sentence.
 *
 * ⚠ **IT IS DELIBERATELY NOT WIDENED TO `capability`, AND THAT LEAVES A STATED
 * REMAINDER.** Once five consecutive failures open the queue's breaker
 * (`providerQueue.ts`, `failureThreshold: 5`, `cooldownMs: 30_000`), the next
 * 30 s of calls are refused by `admit()` as `capability` — the same class a
 * malformed request and a cancelled call raise, where *"in a moment"* is
 * honest. So during a sustained outage the attempts that land on the breaker
 * still get the transient sentence. Telling those apart means the breaker
 * carrying the class that opened it, which changes what EVERY provider road
 * sees and is enumerated on #2688 as its own decision rather than taken here.
 */
export function readerAccountRefused(error: unknown): boolean {
  return error instanceof ProviderError && error.failureClass === "provider_account";
}

/**
 * THE SAME QUESTION ON THE SEGMENTER, where the error is a `MaskError`.
 *
 * The two cutters do not talk to the text provider at all — they ask fal for
 * region masks, and `falRegionReader.ts` wraps every failure in a `MaskError`.
 * That error carries `accountRefused` for exactly this reading, set from
 * `classifyFalHttp`, which is the product's own fal classifier rather than a
 * second opinion about what a 401 means (working law 4: the classifier already
 * existed and is exported).
 *
 * Why a boolean on `MaskError` and not the whole `ProviderFailureClass`:
 * `maskGeometry.ts` is a pure geometry module that imports nothing from the
 * provider layer, and `retryable` is already a boolean there for the same
 * reason. A second field in that shape costs nothing and keeps the geometry
 * module free of the transport.
 */
export function segmenterAccountRefused(error: unknown): boolean {
  return error instanceof MaskError && error.accountRefused;
}
