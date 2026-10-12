/**
 * MAKING THE CREATION RECORD — the two mint roads, N2d-1 (#2311).
 *
 * The design is `docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`
 * (§§3–5). One function, `ensureCastCreationRecord`, and two callers:
 *
 *   1. **THE SIGN** — `signService.ts` calls `mintCreationRecordOnSign` as the
 *      LAST act of a Sign's detached continuation: after the views are sealed,
 *      after the money is settled and the receipt written, outside every
 *      transaction. It can never fail the Sign or move a credit — it catches
 *      everything and logs.
 *   2. **BACKFILL ON FIRST REQUEST** — a cast signed before this shipped (or
 *      one whose Sign died between the seal and this call, or whose recovery
 *      the sweep finished) gets its record the first time something asks for
 *      it. ⚠ This said *"NOTHING ASKS YET"* on #2311; ✅ it has two production
 *      callers now: the certificate download (`server/routes/creationCertificate.ts`,
 *      N2d-2, #2312) and the check page's owner toggle (N2d-3, #2313 —
 *      `creationCheck.preview` and `creationCheck.setPublic` in
 *      `server/routes/creationCheck.ts`). Its
 *      certificate later states both dates — *created* and *recorded and
 *      timestamped* — because the stamp proves when the RECORD existed, not
 *      when the cast was made (§5's honesty rule).
 *
 * # The order, and why each step is where it is
 *
 *   scope → existing? → facts (owner-scoped) → master bytes → build → BOUND
 *   → sign → verify → store → stamp → store the token
 *
 * The record is SIGNED AND STORED BEFORE IT IS STAMPED. An authority that is
 * down must cost nothing but the stamp: the row stands with no token, the next
 * request retries the stamp alone, and until a token lands the later surfaces
 * simply have nothing to offer (the ink-plate rule).
 *
 * # Scope
 *
 * `CASTING_CREATION_RECORD_SCOPE`, a child of `CASTING_V2_SCOPE`, read at the
 * point of use. Off, this returns `dark` before any statement runs — the Sign
 * behaves byte for byte as it did, which is the "production deploys dark"
 * half of the card.
 */
import { createHash } from "node:crypto";

import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import {
  getCastCreationRecord,
  insertCastCreationRecord,
  readCreationRecordSource,
  recordCastCreationStamp,
  type CreationRecordSourceRefusal,
} from "../db/castCreationRecords";
import { captureCastingCreationRecordEnabled } from "./castingV2Scope";
import {
  assertCreationRecordBound,
  buildCreationRecord,
  canonicalCreationRecordJson,
  makerDisplayName,
} from "./creationRecord";
import {
  CREATION_RECORD_PRIVATE_KEY_VARIABLE,
  loadCreationRecordKey,
  signCreationRecord,
  verifyCreationRecord,
  type CreationRecordSigningKey,
} from "./creationRecordSigning";
import { stampDigest } from "./creationRecordTimestamp";

const log = createModuleLogger("castingV2/creationRecordService");

export type CreationRecordDependencies = {
  enabled?: (userId: number) => boolean;
  readSource?: typeof readCreationRecordSource;
  getRecord?: typeof getCastCreationRecord;
  insertRecord?: typeof insertCastCreationRecord;
  recordStamp?: typeof recordCastCreationStamp;
  readBytes?: typeof storageReadBytes;
  loadKey?: () => CreationRecordSigningKey;
  stamp?: typeof stampDigest;
  now?: () => Date;
};

export type CreationRecordOutcome =
  | { kind: "dark" }
  | { kind: "refused"; reason: CreationRecordSourceRefusal }
  | { kind: "recorded"; recordId: number; stamped: boolean; created: boolean };

/** Read, sign and store a cast's record if it has none; stamp it if it is unstamped. */
export async function ensureCastCreationRecord(
  dependencies: CreationRecordDependencies,
  input: { userId: number; modelId: number },
): Promise<CreationRecordOutcome> {
  const enabled = dependencies.enabled
    ? dependencies.enabled(input.userId)
    : captureCastingCreationRecordEnabled(input.userId);
  if (!enabled) return { kind: "dark" };

  const getRecord = dependencies.getRecord ?? getCastCreationRecord;
  const existing = await getRecord(input.userId, input.modelId);
  if (existing) {
    if (existing.timestampToken) {
      return { kind: "recorded", recordId: existing.id, stamped: true, created: false };
    }
    const stamped = await stampRecord(dependencies, {
      userId: input.userId,
      recordId: existing.id,
      recordSha256: existing.recordSha256,
    });
    return { kind: "recorded", recordId: existing.id, stamped, created: false };
  }

  const source = await (dependencies.readSource ?? readCreationRecordSource)(input.userId, input.modelId);
  if ("refused" in source) return { kind: "refused", reason: source.refused };

  const { bytes } = await (dependencies.readBytes ?? storageReadBytes)(source.anchorStorageKey);
  const record = buildCreationRecord({
    kliegId: source.kliegId,
    accountId: input.userId,
    makerName: makerDisplayName(source.makerDisplayName),
    createdAt: source.createdAt,
    mintedAt: source.mintedAt,
    masterSha256: createHash("sha256").update(bytes).digest("hex"),
    rolledAt: source.rolledAt,
    rollsInSession: source.rollsInSession,
    keptAt: source.keptAt,
    refinements: source.refinements,
    recordedAt: (dependencies.now ?? (() => new Date()))(),
  });
  /* THE BOUND, on the finished document, before a signature exists (§3). */
  assertCreationRecordBound(record);
  const canonical = canonicalCreationRecordJson(record);
  const recordSha256 = createHash("sha256").update(canonical, "utf8").digest("hex");

  const key = (dependencies.loadKey ?? (() => loadCreationRecordKey(process.env[CREATION_RECORD_PRIVATE_KEY_VARIABLE])))();
  const signature = await signCreationRecord(key, canonical);
  /* A signature that does not verify against the published half is worse than
     none — it would be stored as evidence and fail the first check anyone ran. */
  if (!(await verifyCreationRecord(key.publicJwk, canonical, signature))) {
    throw new Error("the creation record's signature did not verify against its own public key");
  }

  const stored = await (dependencies.insertRecord ?? insertCastCreationRecord)({
    userId: input.userId,
    modelId: input.modelId,
    recordVersion: record.recordVersion,
    recordJson: canonical,
    recordSha256,
    signature,
    signingKeyId: key.kid,
  });
  const row = await getRecord(input.userId, input.modelId);
  /* Nothing stored and nothing live to read back: the cast stopped being this
     owner's live cast between the read above and the insert (deleted
     mid-flight). The insert refused to write, so there is nothing to stamp
     and nothing to forget — the relay's finding 1 on PR #2317. */
  if (!row) return { kind: "refused", reason: "not_a_signed_cast" };
  if (row.timestampToken) return { kind: "recorded", recordId: row.id, stamped: true, created: stored.stored };
  const stamped = await stampRecord(dependencies, {
    userId: input.userId,
    recordId: row.id,
    recordSha256: row.recordSha256,
  });
  return { kind: "recorded", recordId: row.id, stamped, created: stored.stored };
}

async function stampRecord(
  dependencies: CreationRecordDependencies,
  input: { userId: number; recordId: number; recordSha256: string },
): Promise<boolean> {
  const { token, refusals } = await (dependencies.stamp ?? stampDigest)({
    digest: Buffer.from(input.recordSha256, "hex"),
  });
  if (!token) {
    log.warn(
      { recordId: input.recordId, refusals },
      "[creationRecord] no timestamp authority granted a token — the record stands unstamped and retries on its next request",
    );
  }
  await (dependencies.recordStamp ?? recordCastCreationStamp)({
    userId: input.userId,
    recordId: input.recordId,
    token: token
      ? { tokenBase64: token.tokenDer.toString("base64"), authority: token.authority, stampedAt: token.stampedAt }
      : null,
    now: dependencies.now?.(),
  });
  return token !== null;
}

/**
 * The Sign's call. NEVER throws and never touches money: everything that can
 * go wrong is logged, and the Sign it follows has already finished.
 */
export async function mintCreationRecordOnSign(
  dependencies: CreationRecordDependencies,
  input: { userId: number; modelId: number; operationId: string },
): Promise<CreationRecordOutcome | null> {
  try {
    const outcome = await ensureCastCreationRecord(dependencies, input);
    if (outcome.kind !== "dark") {
      log.info({ operationId: input.operationId, modelId: input.modelId, outcome }, "[creationRecord] Sign road");
    }
    return outcome;
  } catch (error) {
    log.error(
      { operationId: input.operationId, modelId: input.modelId, err: error },
      "[creationRecord] the record could not be made — the cast stands; it is made on its first request",
    );
    return null;
  }
}
