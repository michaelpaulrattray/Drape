/**
 * THE CREATION RECORD — what stands behind a Klieg ID, N2d-1 (#2311).
 *
 * Design §3 (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`): a
 * canonical JSON document, one per signed cast, carrying who made it, when, a
 * fingerprint of the master picture, and the steps taken — as EVENTS. Klieg
 * signs it (`creationRecordSigning.ts`) and an independent authority stamps its
 * hash (`creationRecordTimestamp.ts`).
 *
 * # ⚠ THE BOUND — the rung's most important sentence, enforced here in code
 *
 * `masterPrompt`, `technicalSchema` and `preferences` are together the complete
 * recipe for reproducing a cast (founder ruling 2026-07-25, *"A customer's cast
 * is their work"*). **Not one of them — and not the brief, a refine's words,
 * the identity text, the two persona lines, or any other creative content —
 * ever enters this record.** Two mechanisms, and both are needed:
 *
 *   1. `buildCreationRecord` constructs the document FIELD BY FIELD from named
 *      inputs. It never spreads an input object, so a caller handing it a whole
 *      `models` row (recipe and all) still gets a record of events and hashes.
 *   2. `assertCreationRecordBound` walks the finished document and REFUSES —
 *      throws, so nothing is signed or stored — if any key from the refused
 *      family appears at any depth. It is the backstop for the day somebody
 *      adds a field to the builder; the sign road calls it on every record.
 *
 * Both are driven directly by `creationRecord.test.ts` with a caller that
 * misbehaves (working law 3: a backstop needs a test no well-behaved caller
 * can rescue), and each was shown to go red under sabotage of its own line.
 *
 * # What "the steps" are
 *
 * Event dates and counts from the roll → candidate → refinement rows: when the
 * roll that produced this face was cast and how many rolls the session had
 * made by then, when the face was kept, how many refinements reached it and
 * between which dates, when it was signed, and when its views finished. That is
 * the human-authorship story the legal argument needs (selection and
 * direction), with the creative content itself staying sealed in the account.
 */

/**
 * Bumped when the document's SHAPE changes; old records keep their version.
 *
 * - **"1"** (#2311): `maker` was `{ accountId, displayName }`.
 * - **"2"** (#2352, his word 2026-10-12: *"5) ok"*): `maker` is `{ displayName }`
 *   ONLY. `accountId` was `users.id` — the database's auto-increment number —
 *   and the certificate's appendix prints the whole record, so a shared
 *   certificate leaked a sequential count of accounts and a stable handle on a
 *   customer. The record never needed it: the signature proves Klieg made the
 *   record, and the `cast_creation_records` row already holds `userId` for
 *   Klieg's own use. A v1 record is SIGNED and is never rewritten, so it keeps
 *   its number and still verifies; every record made from now on has none.
 */
export const CREATION_RECORD_VERSION = "2";

/**
 * Keys that may never appear anywhere in a record, at any depth. Matched
 * case-insensitively. The first three are the recipe (2026-07-25); the rest
 * are the creative content around it, each named in design §3 or the schema's
 * own "same family as masterPrompt" docblocks.
 */
export const CREATION_RECORD_REFUSED_KEYS: readonly string[] = [
  "masterPrompt",
  "technicalSchema",
  "preferences",
  "identityText",
  "briefText",
  "brief",
  "compiledBrief",
  "instructions",
  "editSentences",
  "requestText",
  "personality",
  "voice",
  "personalityOwnWords",
  "voiceOwnWords",
  "description",
  "prompt",
  "email",
];

/**
 * Account identifiers, refused at any depth in every record of version "2" or
 * later (#2352). `accountId` is the one v1 carried; the others are its
 * siblings — the same database number under another name, and `openId`, which
 * for a Google sign-in is the Google subject id (a personal identifier, and the
 * card's named "do not substitute"). The ONE exemption is a v1 record's own
 * `maker.accountId`, because a signed record is never rewritten.
 */
export const CREATION_RECORD_ACCOUNT_KEYS: readonly string[] = ["accountId", "userId", "ownerId", "openId"];

/** The only place a v1 record carried an account identifier. */
const V1_ACCOUNT_ID_PATH = "maker.accountId";

export class CreationRecordBoundError extends Error {
  constructor(path: string) {
    super(`a creation record may not carry "${path}" — it is creative content or a personal identifier`);
    this.name = "CreationRecordBoundError";
  }
}

/** The facts a record is built from — every one an event, an id or a hash. */
export type CreationRecordFacts = {
  kliegId: string;
  /** The owning account's display name; `null` when there is none to show. */
  makerName: string | null;
  createdAt: Date;
  mintedAt: Date;
  /** SHA-256 of the anchor (master) picture's stored bytes, lowercase hex. */
  masterSha256: string;
  rolledAt: Date | null;
  /** How many rolls the session had cast up to and including the source roll. */
  rollsInSession: number | null;
  keptAt: Date | null;
  refinements: { count: number; firstAt: Date | null; lastAt: Date | null };
  /** When this record was assembled — later than `mintedAt` on a backfill. */
  recordedAt: Date;
};

export type CreationRecordStep =
  | { event: "rolled"; at: string; rollsInSession: number | null }
  | { event: "kept"; at: string }
  | { event: "refined"; count: number; firstAt: string; lastAt: string }
  | { event: "signed"; at: string }
  | { event: "minted"; at: string };

/** The shape this code WRITES (version "2"): the maker is a display name only. */
export type CreationRecord = {
  recordVersion: string;
  kliegId: string;
  maker: { displayName: string | null };
  createdAt: string;
  mintedAt: string;
  master: { sha256: string };
  steps: CreationRecordStep[];
  recordedAt: string;
};

/** A version "1" record, as already signed and stored — read, never written. */
export type CreationRecordV1 = Omit<CreationRecord, "maker"> & {
  maker: { accountId: number; displayName: string | null };
};

/** Any record a reader may meet in the store. */
export type StoredCreationRecord = CreationRecord | CreationRecordV1;

/**
 * The name a record signs: the account's DISPLAY NAME and nothing else.
 *
 * ⚠ **NEVER `users.name`** (the relay's finding 4 on PR #2317). For a Google
 * sign-in that column is the person's real full name; the design (§3) says
 * *display name*; this value is SIGNED, so it can never be edited out of a
 * record afterwards; and N2d-3 can make a record public. A person's legal name
 * going public is a founder decision the design never asked for. So with no
 * display name, the record signs NO name — `null` — rather than reaching for
 * another column. A display name that looks like an address is dropped too:
 * "never the email" holds even when somebody typed theirs into that field.
 */
export function makerDisplayName(displayName: string | null): string | null {
  const trimmed = displayName?.trim();
  if (!trimmed || trimmed.includes("@")) return null;
  return trimmed.slice(0, 128);
}

const iso = (at: Date): string => at.toISOString();

/** Build the record FIELD BY FIELD. Never spreads its input (see the bound). */
export function buildCreationRecord(facts: CreationRecordFacts): CreationRecord {
  if (!/^[0-9a-f]{64}$/.test(facts.masterSha256)) {
    throw new Error("a creation record's master fingerprint must be a lowercase SHA-256 hex digest");
  }
  const steps: CreationRecordStep[] = [];
  if (facts.rolledAt) {
    steps.push({ event: "rolled", at: iso(facts.rolledAt), rollsInSession: facts.rollsInSession });
  }
  if (facts.keptAt) steps.push({ event: "kept", at: iso(facts.keptAt) });
  if (facts.refinements.count > 0 && facts.refinements.firstAt && facts.refinements.lastAt) {
    steps.push({
      event: "refined",
      count: facts.refinements.count,
      firstAt: iso(facts.refinements.firstAt),
      lastAt: iso(facts.refinements.lastAt),
    });
  }
  steps.push({ event: "signed", at: iso(facts.createdAt) });
  steps.push({ event: "minted", at: iso(facts.mintedAt) });
  return {
    recordVersion: CREATION_RECORD_VERSION,
    kliegId: facts.kliegId,
    maker: { displayName: facts.makerName },
    createdAt: iso(facts.createdAt),
    mintedAt: iso(facts.mintedAt),
    master: { sha256: facts.masterSha256 },
    steps,
    recordedAt: iso(facts.recordedAt),
  };
}

/**
 * Throws `CreationRecordBoundError` if a refused key appears at any depth — the
 * creative-content family in every version, and the account identifiers in
 * every version except at a v1 record's own `maker.accountId` (#2352).
 */
export function assertCreationRecordBound(record: unknown): void {
  const refused = new Set(CREATION_RECORD_REFUSED_KEYS.map((key) => key.toLowerCase()));
  const account = new Set(CREATION_RECORD_ACCOUNT_KEYS.map((key) => key.toLowerCase()));
  /* Only a record that SAYS it is v1 gets v1's exemption; a missing or unknown
     version is read as the newest rule, which is the refusing direction. */
  const isV1 = typeof record === "object" && record !== null && !Array.isArray(record)
    && (record as { recordVersion?: unknown }).recordVersion === "1";
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const at = path ? `${path}.${key}` : key;
      if (refused.has(key.toLowerCase())) throw new CreationRecordBoundError(at);
      if (account.has(key.toLowerCase()) && !(isV1 && at === V1_ACCOUNT_ID_PATH)) {
        throw new CreationRecordBoundError(at);
      }
      walk(child, at);
    }
  };
  walk(record, "");
}

/**
 * Canonical JSON: object keys sorted at every depth, no whitespace. The bytes
 * that are hashed, signed and stamped — so the same record always produces the
 * same bytes, and a verifier can rebuild them from the stored document.
 */
export function canonicalCreationRecordJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite number in a record");
    if (value === undefined) throw new Error("undefined in a record");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalCreationRecordJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalCreationRecordJson(child)}`).join(",")}}`;
}
