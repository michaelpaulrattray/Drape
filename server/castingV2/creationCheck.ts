/**
 * THE PUBLIC CHECK PAGE — what a stranger holding a Klieg ID may see, N2d-3 (#2313).
 *
 * Design §1, §3 and §7.3 (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`).
 * The owner turns the page on; anyone with the ID can then confirm the ID is
 * real and when the character was made — and see NOTHING ELSE.
 *
 * # ⚠ THE PROJECTION IS THE WHOLE CONTROL, AND IT IS BUILT FIELD BY FIELD
 *
 * `projectPublicCreationCheck` is the ONLY road from a stored record to a
 * public answer, and the owner's preview goes through the same function, so
 * what the owner is shown before turning the page on is exactly what a stranger
 * will see (derived, never mirrored — working law 4). It names six fields:
 * the ID, the maker's display name, the creation date, the
 * record date, the independent stamp date, and the fingerprint of the master
 * picture. It never spreads the record: the record also carries the account
 * id and the steps, and neither belongs to a stranger (the account id is "your
 * account" in the toggle's own sentence). **Never the picture, never an
 * address of one, never the email, never the brief or the recipe** — the
 * 2026-07-25 ruling's bound, restated in design §3.
 *
 * # ⚠ NO EXISTENCE ORACLE
 *
 * An ID that does not exist, an ID whose page is off, a deleted cast's ID, an
 * ID that could never exist (malformed), an ID whose owner's scope is off and
 * a record that cannot be read all produce the SAME answer — `NO_PUBLIC_RECORD`
 * — which is literally true of every one of them. The database half of the
 * rule is `readPublicCreationCheck`'s single statement; this file is the other
 * half: every refusal returns the one constant, never a variant of it.
 *
 * # Copy
 *
 * Every string a customer reads says *evidence of creation*; nothing says
 * "verified owner" or claims ownership (design, "settled before this design").
 * The strings live in `shared/creationCheckCopy.ts` so the server-side guards
 * and the client read one source.
 */
import { CAST_PUBLIC_ID_PATTERN } from "../casting/castPublicId";
import { makerDisplayName, type CreationRecord } from "./creationRecord";

/** A stored shape read back from text: any field may be missing or of any type. */
type Untrusted<T> = { [K in keyof T]?: T[K] extends object ? Untrusted<T[K]> | null : unknown };

/** The legacy public id shape (`MOD-26-0000B5`), which stays valid forever. */
const LEGACY_PUBLIC_ID_PATTERN = /^MOD-[0-9A-Z]{2}-[0-9A-Z]{6}$/;

/** The longest ID the public route accepts at all — a KI id is 22 characters. */
export const CREATION_CHECK_ID_MAX_LENGTH = 32;

/**
 * Normalise what a stranger typed or pasted into the ID the store holds, or
 * `null` when no cast could ever carry it — which the route answers exactly as
 * it answers an unknown ID, so a malformed ID teaches nothing either.
 */
export function normaliseCreationCheckId(raw: string): string | null {
  const id = raw.trim().toUpperCase();
  if (CAST_PUBLIC_ID_PATTERN.test(id) || LEGACY_PUBLIC_ID_PATTERN.test(id)) return id;
  return null;
}

/**
 * The six fields a stranger may see. Nothing else crosses this boundary.
 * ⚠ The cast's NAME is deliberately not one of them (finding 1 on PR #2325):
 * every field here is read from the signed record or its stamp, and the name is
 * neither. It waits on #2323; `creationCheckRoute.test.ts` pins its absence.
 */
export type PublicCreationCheck = {
  kliegId: string;
  makerName: string | null;
  /** When the character was made (the Sign), ISO. */
  createdAt: string;
  /** When the record was assembled, ISO — later than `createdAt` on a backfill. */
  recordedAt: string;
  /** The independent authority's time for the stamp, ISO; `null` until one lands. */
  stampedAt: string | null;
  /** SHA-256 of the master picture's bytes, lowercase hex. */
  fingerprint: string;
};

export type PublicCreationCheckAnswer = { found: false } | ({ found: true } & PublicCreationCheck);

/** The one answer for every ID that has no public page. Frozen: nobody decorates it. */
export const NO_PUBLIC_RECORD: { found: false } = Object.freeze({ found: false as const });

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && ISO.test(value) ? value : null;
}

/**
 * Build the public answer from the stored record, FIELD BY FIELD.
 * Returns `null` (which the caller turns into `NO_PUBLIC_RECORD`) for a record
 * it cannot read in full — a page that shows half a record would be claiming
 * something it cannot back.
 */
export function projectPublicCreationCheck(input: {
  kliegId: string;
  recordJson: string;
  stampedAt: Date | null;
}): PublicCreationCheck | null {
  let record: unknown;
  try {
    record = JSON.parse(input.recordJson);
  } catch {
    return null;
  }
  if (!record || typeof record !== "object") return null;
  /* The stored document, read as untrusted: every field the projector uses,
     derived from the record's own type rather than re-listed (working law 4). */
  const doc = record as Untrusted<Pick<CreationRecord, "kliegId" | "maker" | "createdAt" | "recordedAt" | "master">>;
  /* The signed record must be about THIS ID — a record that names another is not this cast's. */
  if (doc.kliegId !== input.kliegId) return null;
  const createdAt = isoOrNull(doc.createdAt);
  const recordedAt = isoOrNull(doc.recordedAt);
  const fingerprint = typeof doc.master?.sha256 === "string" && SHA256_HEX.test(doc.master.sha256)
    ? doc.master.sha256
    : null;
  if (!createdAt || !recordedAt || !fingerprint) return null;
  const signedName = typeof doc.maker?.displayName === "string" ? doc.maker.displayName : null;
  return {
    kliegId: input.kliegId,
    /* The name the record SIGNED, re-passed through the same rule that chose it
       (never an address, never `users.name`) — belt and braces on a public page. */
    makerName: makerDisplayName(signedName),
    createdAt,
    recordedAt,
    stampedAt: input.stampedAt ? input.stampedAt.toISOString() : null,
    fingerprint,
  };
}
