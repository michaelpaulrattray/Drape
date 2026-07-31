/**
 * Vitest global setup — loads .env so tests see the same configuration the
 * server does (OAuth client IDs, feature flags, and the like).
 *
 * Two classes of credential are deliberately stripped, for the same reason:
 * `.env` is the *live* configuration, and a unit test that reaches live
 * infrastructure is not a unit test.
 *
 * **DATABASE_URL** points at the live Railway database. Unit tests must never
 * read from or write to it. Suites that need a database skip themselves when
 * it is absent; to run them, provide a disposable database via
 * `TEST_DATABASE_URL`.
 *
 * **Provider keys** (fal, OpenRouter, Gemini, Stripe, Resend…) spend real
 * money. This was not a hypothetical: when M5 swapped the deterministic brief
 * compiler for the real interpreter, the roll suite went from 17ms to 32
 * seconds because every run was making live OpenRouter calls against the
 * founder's account. Nothing failed, nothing warned — a green suite was
 * quietly billing. The fix belongs here rather than in each suite's mocks,
 * because remembering to inject a seam is exactly the discipline that fails
 * silently.
 *
 * A suite that genuinely needs a live provider asks for it by name:
 * `TEST_FAL_KEY`, `TEST_OPENROUTER_API_KEY`, and so on. Absent that, the
 * variable is gone and the code under test takes its unavailable path — which
 * is a path worth exercising anyway.
 */
import "dotenv/config";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

/**
 * Credentials whose absence the code already handles. Deleting them is the
 * strongest option: the module under test takes its unavailable path, which is
 * a path worth exercising anyway.
 */
const STRIPPED_CREDENTIALS = [
  "FAL_KEY",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "KLAVIYO_PRIVATE_KEY",
  "ELEVENLABS_API_KEY",
] as const;

/**
 * Credentials that are read at *module construction* — `stripeService.ts`
 * builds its client on import, so deleting the key throws before a single test
 * runs and takes ~40 unrelated suites with it.
 *
 * These get an obviously-invalid sentinel instead. The module constructs, the
 * suites run, and any call that actually escapes to the provider fails
 * authentication rather than transacting. The sentinel is worded so that if it
 * ever shows up in a log or an error, it says what went wrong.
 */
const NEUTRALIZED_CREDENTIALS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
] as const;

const SENTINEL = "unit-tests-must-never-reach-a-live-provider";

for (const name of STRIPPED_CREDENTIALS) {
  const testScoped = process.env[`TEST_${name}`];
  if (testScoped) process.env[name] = testScoped;
  else delete process.env[name];
}

for (const name of NEUTRALIZED_CREDENTIALS) {
  const testScoped = process.env[`TEST_${name}`];
  process.env[name] = testScoped || SENTINEL;
}
