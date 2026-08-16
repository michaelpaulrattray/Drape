/**
 * emailAuthInput — the register/login wire schemas, in a dependency-light
 * module so the validation tests can import them without dragging in the
 * route's database, bcrypt and email imports. These ARE the production
 * schemas (`emailAuth.ts` uses them directly), not a copy.
 *
 * Extracted because the copy was the bug. `emailAuth.test.ts` carried its own
 * transcription under the comment "mirrors emailAuth.ts schemas", and a mirror
 * drifts from its source by construction (working law 4) — the ceilings below
 * were given authored messages and the test's copy kept the old ones, so a
 * suite of eleven green assertions was proving things about a schema no
 * request has ever been validated against. Same shape as
 * `modelCreateInput.ts`, and for the same reason.
 *
 * EVERY CONSTRAINT CARRIES ITS OWN SENTENCE, INCLUDING THE CEILINGS.
 *
 * Both routes surface `parsed.error.issues[0].message` straight to the signup
 * and login screens, so an issue without an authored message ships zod's:
 * "Too big: expected string to have <=255 characters". Every `.min()` and
 * `.regex()` here already had one and every `.max()` did not — an omission
 * rather than a style, and the same class the tRPC error formatter now closes
 * for the ~237 procedures on that side (`server/_core/invalidInputMessage.ts`).
 *
 * Fixed at the schema rather than by post-processing the issue, because zod
 * does not record which messages an author supplied — telling them apart
 * downstream would mean matching on the prefix "Too big:", which is keying a
 * reader on a library's spelling. Here the field and its limit are both known.
 */
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email address is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  betaCode: z.string().min(1, "Beta code is required").max(64, "Beta code is too long"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email address is too long"),
  password: z.string().min(1, "Password is required").max(128, "Password must be 128 characters or fewer"),
});
