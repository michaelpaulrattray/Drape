/**
 * Server-owned Casting V2 rollout scope.
 *
 * The flag ships in M4 rather than M5 (plan §K, amended 2026-07-31) because
 * M4's procedures are the first V2 surface that can *spend a customer's
 * credits*. Shipping spendable surface unflagged and promising to flag it a
 * milestone later is how dark code stops being dark.
 *
 * Mirrors `evidenceIngestScope.ts` deliberately: same grammar (`off` / `all` /
 * `users:<ids>`), same boot-validation posture (a malformed value stops
 * startup rather than ambiguously half-enabling a paid path), same shape of
 * fail-closed dependency checks. The client never supplies or influences this
 * value — it observes only the resulting boolean capability.
 */
import { loadCreationRecordKey } from "./creationRecordSigning";

export const CASTING_V2_SCOPE_ENV = "CASTING_V2_SCOPE";

export type CastingV2Scope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export class CastingV2ScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingV2ScopeConfigurationError";
  }
}

/**
 * A roll writes objects to storage that §G.6 promises will be purged. Without
 * the cleanup worker running, nothing ever deletes them — the promise silently
 * becomes false. Refusing to enable is the honest posture (invariant 7: a
 * control that is not invoked does not exist).
 */
export class CastingV2CleanupWorkerConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "CastingV2CleanupWorkerConfigurationError";
  }
}

/**
 * The image transport must be configured before a paid roll is reachable.
 * Otherwise the user is charged and every candidate fails on a missing
 * credential — a full refund at best, and a support ticket regardless.
 */
export class CastingV2TransportConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} cannot be enabled unless the casting image transport (FAL_KEY) is configured`,
    );
    this.name = "CastingV2TransportConfigurationError";
  }
}

/**
 * The Sign package cannot land a view without a second opinion.
 *
 * §I's fail-closed law: where no trustworthy verifier exists, the request
 * refuses BEFORE the spend. Without the judge transport, every Sign would
 * charge its flat 3,250 credits (`CASTING_V2_SIGN_PRICE_CREDITS`, since #1968),
 * fail all five conformance checks, and refund the WHOLE 3,250 credits — a Cast
 * with an empty package, every single time, and the money technically correct
 * throughout. Refusing to enable is the only honest posture (invariant 7).
 *
 * ⚠ **THIS PARAGRAPH SAID "six views" AND "refund three hundred credits back",
 * AND ALL THREE NUMBERS IN IT WERE WRONG — corrected 2026-08-25 (opus-1272,
 * ruled fable-1654 §2).** The package is FIVE views (`CAST_PACKAGE_VIEWS`, and
 * the Sign price was then DERIVED from its length — a promotion plus five view
 * slices on the scale of that day; it is one flat number with no promotion and
 * no slice since #1968), so the charge was never 500 and the checks were never
 * six. The third is the one that mattered: **a zero-of-N Sign did not keep
 * its promotion**, the base the Sign price then carried. The founder ruled
 * on 2026-08-02 that the promotion goes back too — *"nobody came here to
 * buy the preservation of a face they had already paid for on the sheet"* — and
 * `packageOrchestrator` has refunded it ever since, logging *"TOTAL LOSS — not
 * one view landed; the whole Sign refunded, base included"*. So this docblock
 * described a product that kept 3,500 credits of a customer's money during our
 * own outage, which is the thing the confession law forbids and the exact
 * behaviour that ruling removed. **A comment cannot be run, so nothing went
 * red for six months.**
 *
 * ⚠ **AND ALL FOUR OF ITS FIGURES MOVED AGAIN ON 2026-10-01 — #1601 item 1
 * set the adopted scale: the Sign 450 → 8,500, the promotion 200 → 3,500, a
 * view 50 → 1,000.** They were missed in that commit while its own TEST
 * docblock was corrected in the same diff, and the relay's review caught it.
 * **That is the class and it is worth more than the four figures: a pin that
 * lives beside a COPY of a sentence moves the copy when it reddens, never the
 * source.** `castingV2Scope.test.ts`'s arm reads both constants at the place
 * ITS claim is made — and the claim a reader actually meets when they ask why
 * the scope refuses to boot is THIS one, three files away from the arm.
 */
export class CastingV2ValidatorConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} cannot be enabled unless the view-conformance validator (OPENROUTER_API_KEY) is configured`,
    );
    this.name = "CastingV2ValidatorConfigurationError";
  }
}

/**
 * The grammar, written once.
 *
 * Every rollout flag in this program shares it, and a second copy of a parser
 * is a second thing to keep in step — the one that falls behind accepts a value
 * the other rejects, on a switch that governs spending. The caller supplies its
 * own error so the message still names the variable the operator actually set.
 */
function parseScopeGrammar(raw: string | undefined, fail: () => never): CastingV2Scope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) fail();
  const members = raw.slice("users:".length).split(",");
  if (members.length === 0 || members.some((member) => !/^[1-9]\d*$/.test(member))) fail();
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    fail();
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

export function parseCastingV2Scope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingV2ScopeConfigurationError();
  });
}

export function castingV2EnabledForUser(scope: CastingV2Scope, userId: number): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Casting V2 scope requires a positive integer user id");
  }
  return scope.kind === "all" || (scope.kind === "users" && scope.userIds.includes(userId));
}

/**
 * Read the live scope for one user.
 *
 * Evaluated per request rather than cached at boot so a scope change takes
 * effect on redeploy without a code path that could hold a stale `all`.
 */
export function captureCastingV2Enabled(userId: number): boolean {
  return castingV2EnabledForUser(parseCastingV2Scope(process.env[CASTING_V2_SCOPE_ENV]), userId);
}

/* ------------ the reference-library sub-flag, RETIRED (#1577 slice D5) ------- */

/*
 ⚠ THE REFERENCE LIBRARY'S OWN FLAG STOOD HERE AND IS GONE — the variable, its
 three errors, its parse, its capture, its armed question and its boot fence,
 all in one act. It is the LAST of the six settings his word retired, and the
 last flag of the ghost audit's refine-road half.

 It was `CASTING_REFERENCE_LIBRARY_SCOPE` (migration 0028's companion): off, a
 face built no library, so the face panel answered `enabled: false` with no
 rows, a refine read no carried crops and the mint stored none; on, every edit
 filed a crop of what it delivered and every later render carried it. The table
 landed by ceremony and the flag was flipped afterwards, which is why it existed
 at all — a writer shipping under `CASTING_V2_SCOPE` alone would have INSERTed
 into a table production did not have yet, on a render somebody paid for.

 It reached `all` on production on 2026-08-24 and stood there, read by name with
 a working negative control on the night it came out, so its OFF arm had been
 reached by no account for two months. **His word retiring it, 2026-10-15,
 verbatim and entire: _"yes approve the plan and switch off the six settings"_.**
 The code stopped reading the variable in this commit and the variable came off
 the service AFTER that code DEPLOYED — never in the same act as the merge
 (`scripts/lib/productionFlagPositions.mts` is the authority and says it
 once). The other order is the expensive one: with the old build still serving,
 an absent variable parses as `off`, which would have blanked the face panel for
 every customer and stopped every refine carrying the cast's own features.

 # THE LIBRARY IS LIVE AND IS NOT WHAT RETIRED

 `casting_reference_library`, `recordReferenceRows`, `listLineageReferences`,
 `mintReferencesForRender`, the retention sweep and the face panel are all
 untouched. What retired is the SWITCH: the library is now simply what a Casting
 V2 account's refine does, the way the repaint became simply what a refine
 paints (slice 4b) and the open lane became simply what the interpreter reads
 (slice D1).

 # WHAT CARRIED ITS WEIGHT, AND WHERE EACH PIECE WENT

 **The cleanup-worker condition did NOT travel with it, and it did not need to.**
 This flag refused to boot unless `ENABLE_STORAGE_CLEANUP_WORKER` was exactly
 `"true"`, because the library writes crops of a person's face to the PUBLIC
 bucket and without the sweep nothing would ever delete them — the founder's own
 storage condition. Every surviving child enforces that same condition in its
 own body (`validateCastingInkStudioEnvironment`,
 `validateCastingReferenceAttachEnvironment`, and the scan table's own fence),
 so no retention promise is weakened by this deletion. ⚠ The one thing that IS
 gone is the condition over the LIBRARY'S own writes, and that is stated rather
 than glossed: a deployment with the sweep off now boots and files crops nothing
 collects. It is not a new exposure — `ENABLE_STORAGE_CLEANUP_WORKER` is `true`
 on the service and has been since at least 2026-08-11 (`opus-204`'s separate
 `ENABLE_` sweep) — but it is a fence that existed and does not, and the honest
 place to say so is here rather than in a report.

 **THE THREE CHILDREN RE-PARENT ONTO `CASTING_V2_SCOPE`**, which is exactly what
 slice 4a did one level down when the repaint flag died, and what #1442 slice 1
 did for another flag: `CASTING_FACE_SCAN_SCOPE`,
 `CASTING_REFERENCE_ATTACH_SCOPE` and `CASTING_INK_STUDIO_SCOPE` each named this
 flag as their parent, and a child naming a missing parent refuses boot. The
 chain `CASTING_INK_CUT_SCOPE` → `CASTING_INK_STUDIO_SCOPE` →
 `CASTING_REFERENCE_LIBRARY_SCOPE` → `CASTING_V2_SCOPE` loses its third link and
 still ends where it ended, so the `FAL_KEY`-is-guaranteed-by-the-chain argument
 at `CASTING_INK_CUT_SCOPE_ENV` holds unchanged.

 ⚠ **It changes nothing at the positions production actually holds**, read at
 the service by name rather than argued: the library and `CASTING_V2_SCOPE` both
 stood at `all`, the scan at `all`, attach at `users:1`, and the ink studio is
 ABSENT (so `off`, and its fence returns before the parent is read at all). Every
 user inside the library was already inside the casting scope — the library's own
 capture ENDED in `captureCastingV2Enabled`, and its boot fence refused a library
 reaching past the casting scope — so the new parent is the same answer or wider.

 ⚠ **AND IT IS THE WEAKER OF THE TWO WHEREVER THE LIBRARY WAS NARROWER THAN
 `CASTING_V2_SCOPE`, exactly as slice 4a said of itself: a child at `all` under a
 `users:1` library used to be refused and would now pass. There is no narrower
 flag left to track, because the library's flag does not exist.

 # THE FACE SCAN'S REASON MOVED RATHER THAN DYING

 Its fence's sentence was *"the scan fills a panel that does not render"* — true
 while the panel was gated on the library alone. The panel is now gated by
 `requireCastingV2` and nothing else, so the same sentence is said about the
 casting scope: a scan is house money on a read nobody asked to pay for, and
 buying one for an account that cannot open a sheet is a paid read into the dark.
 Inert and mistaken look identical from outside, which is why it is still a
 fence and not a dropped check.

/* ------------- the compositor-swap sub-flag, RETIRED (#1577 slice 4b) -------- */

/*
 ⚠ THE REPAINT'S OWN FLAG STOOD HERE AND IS GONE — the variable, its parse,
 its two errors, its capture and its boot fence, all in one act.

 It was `CASTING_REPAINT_SCOPE` (D-241, fable-277 §2): off, a refine painted
 through the old road — full-frame engine call, masked harvest, segments pasted
 back, seam blended; on, the same ask assembled a recipe and repainted the whole
 frame from the pristine master plus a cropped reference of every delivered
 feature, with the engine's own frame delivered and nothing pasted. It reached
 `all` on production at fable-1253, so the old road ran for nobody, and #1577's
 refine-road audit found the whole paste compositor still standing behind it.
 **His word retiring it, 2026-10-15, verbatim and entire: _"yes approve the plan
 and switch off the six settings"_.** The code went first and the variable was
 deleted from the service after it deployed — that order is not stylistic: with
 the old code still serving, an absent variable parses as `off` and would have
 put every customer back on the paste road.

 Its PARENT was the reference library, and that parenthood is the one thing to
 carry forward rather than forget: a repaint carries features by crop and the
 crops are the library's, so a repaint without a library is a paid render that
 silently loses every feature a paste used to preserve (D-244). With the flag
 gone there is no pair to keep covered — every refine repaints, and
 `CASTING_REFERENCE_LIBRARY_SCOPE` is what decides whether it has crops to carry.
 Slice 4a had already re-parented the four children that named this flag onto
 that scope for exactly this reason, which is why nothing else moved tonight.
 ⚠ **THAT LAST SENTENCE ABOUT THE LIBRARY DECIDING IS NO LONGER TRUE AND THE
 RECORD IS LEFT STANDING WITH THIS CORRECTION BESIDE IT (#1577 slice D5):** the
 library's own flag is retired too, so nothing decides any more — every refine
 carries whatever crops the library holds, and the three children slice 4a
 re-parented onto it have been re-parented again onto `CASTING_V2_SCOPE`. A
 sentence inside an obituary is still read in the present tense, which is why
 this is corrected rather than filed as history.

 An EMPTY library remains the degenerate case and remains fine (fable-171
 condition 1): the road every new cast travels, assembling to the master alone
 plus words. Empty is not disabled.
*/

/* ---------------------------------------------- the auto-scan sub-flag */

/**
 * THE AUTO-SCAN — reading a face nobody has edited, on its own switch.
 *
 * Off, the face panel is exactly what it is today: rows from the catalogue,
 * content from the library, and an untouched face showing a column of empty
 * slots (the founder's own screenshot, fable-352). On, the panel's first read
 * of a version also asks a segmenter where every feature is on that frame, and
 * fills the rows the library has nothing for.
 *
 * # Why it needs a switch of its own, given the panel already has one
 *
 * It SPENDS. Not a customer's credits — a scan is house money on a read the
 * user never asked to pay for — every version looked at buys a run of
 * segmenter reads, a body cutout and a describer call, priced in one place:
 * `FACE_SCAN_FAL_CALLS` / `faceScanUsd()` in `scripts/lib/falSpend.mts`
 * (⚠ this said *fourteen calls* until 2026-08-24, then *twenty calls, $0.100*
 * until #2187 — a count taken with a recording reader that answered every
 * question first time, which no real face does; #2183 measured the real one).
 * A switch is the difference between that starting when we choose and starting
 * the moment a deploy lands on whoever already has the panel.
 * The panel is open to every account that can open a sheet — it was gated on
 * `CASTING_REFERENCE_LIBRARY_SCOPE` at `all` until #1577 slice D5 retired that
 * flag, and before 2026-08-24 that read *"open for the founder"* — so without
 * this switch the scan would arrive on EVERY account's next selection
 * unannounced, which is more of the reason and not less.
 *
 * # Its parent is `CASTING_V2_SCOPE`, because the panel is its only consumer
 *
 * The scan produces panel furniture and nothing else — no rows, no objects, no
 * manifest (fable-373 ruling 4a). ⚠ **This section said THE LIBRARY SCOPE until
 * #1577 slice D5, and the reasoning is unchanged — only the flag it lands on
 * moved.** The panel it fills is drawn on a casting sheet, so a scan scope
 * reaching past the casting scope is a paid read whose answer nobody can see:
 * inert, and inert is indistinguishable from mistaken from outside
 * (invariant 7). The transport is inherited rather than re-asserted —
 * `CASTING_V2_SCOPE`, which every scope below it must sit inside, already
 * refuses to arm without `FAL_KEY`, and it is now this flag's own parent rather
 * than its grandparent.
 */
export const CASTING_FACE_SCAN_SCOPE_ENV = "CASTING_FACE_SCAN_SCOPE";

export class CastingFaceScanScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_FACE_SCAN_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingFaceScanScopeConfigurationError";
  }
}

export class CastingFaceScanCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_FACE_SCAN_SCOPE_ENV} ${detail}`);
    this.name = "CastingFaceScanCoverageError";
  }
}

export function parseCastingFaceScanScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingFaceScanScopeConfigurationError();
  });
}

/**
 * Whether this user's untouched faces are read on selection.
 *
 * An AND of the whole chain, for the reason its siblings carry: the boot check
 * already refuses a scope that reaches past its parent, and this is the same
 * rule enforced again where it is used, because a boot check that was never
 * invoked is the second way a flag pair goes wrong.
 *
 * ⚠ The other half was `captureCastingReferenceLibraryEnabled` until #1577
 * slice D5 retired the library's flag; it ENDED in this same call, so the
 * answer here is unchanged for every position production has ever held.
 */
export function captureCastingFaceScanEnabled(userId: number): boolean {
  const scan = parseCastingFaceScanScope(process.env[CASTING_FACE_SCAN_SCOPE_ENV]);
  if (!castingV2EnabledForUser(scan, userId)) return false;
  return captureCastingV2Enabled(userId);
}

/**
 * ⚠ RE-PARENTED ONTO `CASTING_V2_SCOPE` BY #1577 SLICE D5, and the fence's own
 * reason moved with it rather than dying.
 *
 * ⚠ IT IS A `/**` DOCBLOCK RATHER THAN A PLAIN COMMENT ON PURPOSE:
 * `scopeFlagTemplate.test.ts` regenerates THIS flag from the template and
 * compares byte for byte, stripping docblocks because *the reasons are what a
 * human writes and the generator deliberately does not*. A plain comment here
 * is kept by that stripper and reddens a template that is perfectly correct.
 *
 * It tracked `CASTING_REFERENCE_LIBRARY_SCOPE` and refused with *"the scan
 * fills a panel that does not render"* — true while `facePanel` was gated on
 * the library alone. That gate is gone with the library's flag, so the panel
 * renders for every account that can open a sheet at all, and the same sentence
 * is now said about the casting scope: a scan is house money on a read nobody
 * asked to pay for, and buying one for an account with no sheet is a paid read
 * into the dark. Inert and mistaken look identical from outside, which is why
 * this is still a fence.
 *
 * It changes nothing at the positions production holds — the scan is `all` and
 * so is `CASTING_V2_SCOPE` — and the library's own capture ended in
 * `captureCastingV2Enabled`, so the new parent is the same answer or wider.
 */
export function validateCastingFaceScanEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const scan = parseCastingFaceScanScope(input.scope);
  if (scan.kind === "off") return scan;

  const casting = parseCastingV2Scope(input.castingScope);
  if (casting.kind === "off") {
    throw new CastingFaceScanCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — the scan fills a panel on a sheet nobody can open`,
    );
  }
  if (casting.kind === "all") return scan;
  if (scan.kind === "all") {
    throw new CastingFaceScanCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = scan.userIds.filter((userId) => !casting.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingFaceScanCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return scan;
}

/**
 * THE DISCOVERY READ — whether a first reading asks the picture what is on this
 * character before it asks the catalogue (#2566, the design approved on #2532).
 *
 * Off, a scan asks its fixed list of twelve questions exactly as it does today,
 * and a cast's own horns, jaw hardware or jacket stay invisible to the panel at
 * any price. On, one open text read of the frame names what is actually there,
 * the questions about features this face has not got are never bought, and what
 * it names beyond the list is the ground slice 2's pointer road stands on.
 *
 * # Why it needs a switch of its own, given the scan already has one
 *
 * It SPENDS, on a different transport, and it CHANGES WHAT THE PANEL DRAWS. Two
 * text reads per first reading (a head crop and the full frame — measured on
 * #2566, each crop sees things the other does not) on the OpenRouter balance
 * rather than fal's, against a run of segmenter questions it then shortens. The
 * net is expected to be a saving, and expected is exactly the word a switch
 * exists for: his eye on the panels decides whether it widens, and until then a
 * deploy cannot start it on anybody.
 *
 * # Its parent is the SCAN scope, because the scan is its only consumer
 *
 * A discovery narrows a scan plan and does nothing else — it has no row, no
 * object and no surface of its own. A user outside `CASTING_FACE_SCAN_SCOPE`
 * buys no scan for it to narrow, so a discovery scope reaching past it is a
 * paid read whose answer nothing consumes: inert, and inert is
 * indistinguishable from mistaken from outside (invariant 7). The scan scope in
 * turn sits inside the library scope and then `CASTING_V2_SCOPE`, so naming a
 * user here names them all the way down.
 *
 * ⚠ **It does not refuse to boot without `OPENROUTER_API_KEY`, and that is
 * deliberate rather than an omission.** A discovery that cannot reach its
 * transport is the fail-open case the reader is built around: the scan asks its
 * whole list, the panel is exactly today's, and nobody sees an error. Refusing
 * the boot would turn a degraded courtesy into an outage, which is the opposite
 * of what every other clause in this file is protecting.
 */
export const CASTING_FACE_DISCOVERY_SCOPE_ENV = "CASTING_FACE_DISCOVERY_SCOPE";

export class CastingFaceDiscoveryScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_FACE_DISCOVERY_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingFaceDiscoveryScopeConfigurationError";
  }
}

export class CastingFaceDiscoveryCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_FACE_DISCOVERY_SCOPE_ENV} ${detail}`);
    this.name = "CastingFaceDiscoveryCoverageError";
  }
}

export function parseCastingFaceDiscoveryScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingFaceDiscoveryScopeConfigurationError();
  });
}

/**
 * Whether this user's first readings ask the picture before they ask the list.
 *
 * An AND of the whole chain, for `captureCastingFaceScanEnabled`'s reason: the
 * boot check already refuses a scope that reaches past its parent, and this is
 * the same rule enforced again where it is used, because a boot check that was
 * never invoked is the second way a flag pair goes wrong.
 */
export function captureCastingFaceDiscoveryEnabled(userId: number): boolean {
  const discovery = parseCastingFaceDiscoveryScope(process.env[CASTING_FACE_DISCOVERY_SCOPE_ENV]);
  if (!castingV2EnabledForUser(discovery, userId)) return false;
  return captureCastingFaceScanEnabled(userId);
}

export function validateCastingFaceDiscoveryEnvironment(input: {
  scope: string | undefined;
  scanScope: string | undefined;
}): CastingV2Scope {
  const discovery = parseCastingFaceDiscoveryScope(input.scope);
  if (discovery.kind === "off") return discovery;

  const scan = parseCastingFaceScanScope(input.scanScope);
  if (scan.kind === "off") {
    throw new CastingFaceDiscoveryCoverageError(
      `cannot be enabled while ${CASTING_FACE_SCAN_SCOPE_ENV} is off — there would be no scan plan to narrow`,
    );
  }
  if (scan.kind === "all") return discovery;
  if (discovery.kind === "all") {
    throw new CastingFaceDiscoveryCoverageError(
      `cannot be "all" while ${CASTING_FACE_SCAN_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = discovery.userIds.filter((userId) => !scan.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingFaceDiscoveryCoverageError(
      `names users outside ${CASTING_FACE_SCAN_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return discovery;
}

export function validateCastingV2Environment(input: {
  scope: string | undefined;
  cleanupWorker: string | undefined;
  transportConfigured?: boolean;
  validatorConfigured?: boolean;
}): CastingV2Scope {
  const parsed = parseCastingV2Scope(input.scope);
  if (parsed.kind !== "off" && input.cleanupWorker !== "true") {
    throw new CastingV2CleanupWorkerConfigurationError();
  }
  if (parsed.kind !== "off" && input.transportConfigured !== true) {
    throw new CastingV2TransportConfigurationError();
  }
  if (parsed.kind !== "off" && input.validatorConfigured !== true) {
    throw new CastingV2ValidatorConfigurationError();
  }
  return parsed;
}

/**
 * THE KEPT SCAN (migration 0032) — whether a finished reading is written down.
 *
 * The scan itself is `CASTING_FACE_SCAN_SCOPE`'s business: a run of segmenter
 * questions about a face-version (priced by `faceScanUsd()` in
 * `scripts/lib/falSpend.mts`), held in memory for as long
 * as the process lives. This flag governs one thing on top of that — whether
 * the answer survives the process. Off, not a row is written and not a row is
 * read, and the panel behaves exactly as it does today.
 *
 * # Its parent is the SCAN scope, and that is the whole chain
 *
 * A kept scan is a scan that has already happened. A user outside
 * `CASTING_FACE_SCAN_SCOPE` produces no scans to keep, so a table scope
 * reaching past it could only ever write rows for readings that do not exist —
 * inert, and inert is indistinguishable from mistaken from outside
 * (invariant 7). The scan scope in turn sits inside the library scope, which
 * sits inside `CASTING_V2_SCOPE`, so naming a user here names them all the way
 * down.
 *
 * # And the cleanup worker, for the founder's storage condition
 *
 * A kept scan owns OBJECTS: one stencil per feature found, under the
 * candidate's own path. A persisted artifact class without a running purge is
 * the thing the founder's storage condition forbids, so this refuses to boot
 * without the worker — as every store that owns objects in this file does. (The
 * segment store was the sibling named here until #1160 retired it.)
 *
 * Purging is deliberately NOT gated on this flag — see {@link
 * castingScanTableArmed}.
 */
export const CASTING_SCAN_TABLE_SCOPE_ENV = "CASTING_SCAN_TABLE_SCOPE";

export class CastingScanTableScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_SCAN_TABLE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingScanTableScopeConfigurationError";
  }
}

export class CastingScanTableCleanupWorkerError extends Error {
  constructor() {
    super(
      `${CASTING_SCAN_TABLE_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "CastingScanTableCleanupWorkerError";
  }
}

export class CastingScanTableCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_SCAN_TABLE_SCOPE_ENV} ${detail}`);
    this.name = "CastingScanTableCoverageError";
  }
}

export function parseCastingScanTableScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingScanTableScopeConfigurationError();
  });
}

/** Whether this user's finished scans are written down and read back. */
export function captureCastingScanTableEnabled(userId: number): boolean {
  const table = parseCastingScanTableScope(process.env[CASTING_SCAN_TABLE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(table, userId)) return false;
  return captureCastingFaceScanEnabled(userId);
}

/**
 * Whether the store is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable. It never gates the purge itself: rows written while the
 * flag was on must be collected after it goes off, and a retention path that
 * narrows with a feature flag is how objects outlive the sheet that promised
 * to destroy them.
 */
export function castingScanTableArmed(): boolean {
  return parseCastingScanTableScope(process.env[CASTING_SCAN_TABLE_SCOPE_ENV]).kind !== "off";
}

export function validateCastingScanTableEnvironment(input: {
  scope: string | undefined;
  scanScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const table = parseCastingScanTableScope(input.scope);
  if (table.kind === "off") return table;

  if (input.cleanupWorker !== "true") throw new CastingScanTableCleanupWorkerError();

  const scan = parseCastingFaceScanScope(input.scanScope);
  if (scan.kind === "off") {
    throw new CastingScanTableCoverageError(
      `cannot be enabled while ${CASTING_FACE_SCAN_SCOPE_ENV} is off — there would be no reading to keep`,
    );
  }
  if (scan.kind === "all") return table;
  if (table.kind === "all") {
    throw new CastingScanTableCoverageError(
      `cannot be "all" while ${CASTING_FACE_SCAN_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = table.userIds.filter((userId) => !scan.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingScanTableCoverageError(
      `names users outside ${CASTING_FACE_SCAN_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return table;
}

/* ------------------------- the open-lane sub-flag, RETIRED (#1577 slice D1)

   `CASTING_OPEN_LANE_SCOPE` stood here with its parse, its two error classes,
   `captureCastingOpenLaneEnabled` and `validateCastingOpenLaneEnvironment`. It
   is retired on his word of 2026-10-15 (*"yes approve the plan and switch off
   the six settings"*), the ghost audit's row D1: it had stood at `all` since
   2026-09-24 and every flag above it was `all` too.

   ⚠ THIS SENTENCE ENDED *"so its off arm -- the two closed-lane interpreter
   prompts -- was asked of nobody"*, AND ONE ROAD WAS STILL ASKING IT: the removal
   path's RULE 3 re-read never passed the option, and absent meant off. Found by
   the relay on PR #2556; declared and measured on the D1 row. Nothing here moves,
   because that road never read a scope -- and the lesson that belongs to THIS file
   is the one below, one turn further: a flag with two gates has two sweeps, and a
   caller that passed NEITHER gate is found by asking what every caller passes,
   never by the compiler and never by a grep for the flag.

   WHAT THE BLOCK ARGUED, kept because the next sub-flag here will face it:

    - it gated the prompt AND the acceptance door, deliberately, because the
      door shipped ungated and a reply can name an unknown key without being
      invited to. A flag that gates only the prompt is not a gate.
    - its parent was the reference library (re-parented from the repaint by
      slice 4a), on the measured ground that the paste road's `readDelta` DROPS
      `delta.open` by construction, so a user armed for the lane on that road
      would have been charged for a render whose prompt never mentioned what
      they asked for. The paste road and its flag went with slice 4b; the open
      lane is now simply what the interpreter does.

   The lane itself is LIVE and is not what retired -- `openLaneKind`,
   `openLaneAccept`, `openKindProperties` and the demand table are untouched. */

/**
 * THE INK STUDIO — whether a customer may attach a tattoo design to a Cast.
 *
 * # What it gates, and what it deliberately does not
 *
 * On, the upload door exists: a design arrives, is stored under the candidate's
 * own purge path, and records the placement it is meant for from the closed
 * vocabulary (`shared/inkPlacementVocabulary.ts`). Off, and absent means off,
 * there is no door and not one row is written.
 *
 * It does **not** gate the words-rendered ink road. `inkPlacement.ts` decides
 * whether ink stated in a sentence can be rendered from words alone (D-133(a):
 * face and neck, today) and is untouched by this flag in either position.
 * Retiring that road removes a paid capability and is a founder-adjacent
 * decision, not a consequence of this one being switched on.
 *
 * # Why the parent is the REPAINT scope
 *
 * Same argument as the open lane's, and the same measurement underneath it. An
 * ink design reaches a photograph as a cropped reference carried by the repaint
 * recipe; the paste road composes its prompt from a reader that carries no such
 * thing. A user armed here and not on the repaint road would be offered a door
 * that opens onto a wall — an upload that can never appear on her.
 *
 * The library scope is the repaint scope's own parent, so requiring the repaint
 * road requires the library transitively. It is not re-asserted here: two
 * checks of one fact drift apart, and the boot chain already refuses a scope
 * reaching past its parent.
 *
 * # And the cleanup worker, for the reason every storage-writing flag has it
 *
 * An upload is bytes we keep. Without the worker running, nothing deletes them
 * when the Cast they belong to goes, and the promise that a customer's picture
 * leaves with her work becomes quietly false. Refusing to boot is the honest
 * posture (invariant 7).
 *
 * # WHAT REMAINS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * Nothing renders. The released-tuple table (`shared/inkReleasedPlacements.ts`)
 * is empty, so even with this flag on, no placement has yet earned a paid
 * drive — and the mannequin template the design is plated onto does not exist
 * until the founder's one-time taste gate is answered (D-138). This flag opens
 * the door to a room that is still being built, which is exactly why it is off.
 */
export const CASTING_INK_STUDIO_SCOPE_ENV = "CASTING_INK_STUDIO_SCOPE";

export class CastingInkStudioScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_STUDIO_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkStudioScopeConfigurationError";
  }
}

export class CastingInkStudioCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_STUDIO_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkStudioCoverageError";
  }
}

export function parseCastingInkStudioScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkStudioScopeConfigurationError();
  });
}

/*
  THE STUDIO'S POINT-OF-USE PREDICATE IS GONE — #1158 slice 4b, his ruling
  *"It retires with N2"*.

  `captureCastingInkStudioEnabled` answered *"may this user attach an ink
  design?"* and the door it answered for was retired in slices 1–2:
  `uploadInkDesign` does not exist, and slice 1 left the import behind in
  `server/routes/castingV2.ts` calling nothing. Its last reader of any kind was
  `captureCastingInkCutEnabled`, deleted in the same commit as this.

  Recorded rather than silently removed, because a predicate that vanishes
  without a trace is indistinguishable from one that was never wired — the
  reading this campaign keeps having to repair.

  ⚠ **WHAT DID NOT GO WITH IT IS `castingInkStudioArmed` BELOW, AND THE
  DIFFERENCE IS THE WHOLE POINT.** That one is not a door: it asks whether a row
  could EVER have been written, which is the retention sweep's question, and a
  purge path that narrows when a feature retires is how a customer's photograph
  outlives the Cast it was promised to leave with. The flag leaves the service in
  slice 4c; the collecting does not.
*/

/**
 * Whether the studio is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable — production has not taken migration 0034 and sweeps every
 * pass. It never gates the purge itself: a design uploaded while the flag was
 * on must be collected after it goes off, and a retention path that narrows
 * with a feature flag is how a customer's own photograph outlives the Cast it
 * was promised to leave with.
 */
export function castingInkStudioArmed(): boolean {
  return parseCastingInkStudioScope(process.env[CASTING_INK_STUDIO_SCOPE_ENV]).kind !== "off";
}

export function validateCastingInkStudioEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkStudioScope(input.scope);
  if (child.kind === "off") return child;

  if (input.cleanupWorker !== "true") {
    throw new CastingInkStudioCoverageError(
      "cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly \"true\" — an uploaded "
      + "design is bytes we keep, and nothing would ever delete them",
    );
  }

  /*
    ⚠ THIS FENCE HAS NOW MOVED TWICE AND BOTH MOVES WERE A PARENT DYING UNDER
    IT. It tracked `CASTING_REPAINT_SCOPE` until #1577 slice 4a, which
    re-parented it onto the repaint's OWN parent, the reference library; slice
    D5 retires that flag too, so it is re-parented again onto the chain root,
    `CASTING_V2_SCOPE`. A child naming a missing parent refuses boot, which is
    why this is not optional either time.

    It changes nothing at the positions production actually holds, read at the
    service by name rather than argued (`scripts/lib/productionFlagPositions.mts`
    carries the record): `CASTING_INK_STUDIO_SCOPE` is ABSENT from the service,
    so `child.kind === "off"` returns four statements above this and the parent
    is never read at all. Even armed it would hold — the library's own capture
    ENDED in `captureCastingV2Enabled`, so every user inside the library was
    already inside the casting scope.

    ⚠ But it is the WEAKER of the two wherever the dying parent was narrower
    than the surviving one, and that is stated rather than glossed, exactly as
    slice 4a stated it of itself: a child at `all` under a `users:1` library
    used to be refused here and would now pass. There is no narrower flag left
    to track, because neither the repaint's flag nor the library's exists.
  */
  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingInkStudioCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — it became this `
      + "flag's parent when the reference library's own flag was retired (#1577 slice D5), and "
      + "nothing below an off parent is reachable",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkStudioCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkStudioCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the attach sub-flag */

/**
 * THE ATTACH DOOR — whether a customer may hand a picture to a Cast at all
 * (build two, `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §2, countersigned
 * fable-1063 §1).
 *
 * The founder's complaint is the whole reason: *"you put a small link take
 * makeup from a photo???? this is stupid, you should be able to upload any image
 * like grok and use it as a reference for anything"*. On, there is one door —
 * she attaches, our copy lands under the candidate's own purge path, and she
 * gets a handle back. Off, and absent means off, `castingV2.reference.attach`
 * answers NOT_FOUND and not one row is written.
 *
 * # A THIRD FLAG RATHER THAN THE STUDIO'S, and the reason is what it keeps
 *
 * `CASTING_INK_STUDIO_SCOPE` was `users:1` in production when this was written
 * (it is UNSET as of 2026-09-24, #1158 slice 4c — the studio retired on his
 * word, and this flag is one of the reasons the attach road outlived it).
 * Landing this door behind it would not have been a dark landing at all — it
 * would have opened a new store on the founder's live account on the deploy
 * that shipped it, and the thing that
 * store keeps is a FULL PHOTOGRAPH of whoever is in the picture. A road that
 * keeps people's photographs earns its own switch, off by default, so that
 * opening it is a decision somebody makes rather than a side effect of where the
 * code was put.
 *
 * # Why the parent is the REPAINT scope
 *
 * The ink studio's argument, unchanged, because the destination is the same: a
 * feature taken from an attached picture reaches a render as a CROPPED
 * REFERENCE carried by the repaint recipe, and the paste road carries none. A
 * user armed here and not on the repaint road would be offered a door that
 * opens onto a wall — she could attach a picture that could never appear on her.
 *
 * # And the cleanup worker, for the reason every storage-writing flag has it
 *
 * An attachment is bytes we keep, and the bytes are a person. Without the worker
 * running, nothing deletes them when the Cast they belong to goes, and the
 * promise that a customer's picture leaves with her work becomes quietly false.
 * Refusing to boot is the honest posture (invariant 7).
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * No row, no object, no handle. The sweep clause for its table is live anyway
 * and is NOT gated on this flag — a picture attached while it was on must be
 * collected after it goes off, and a retention path that narrows with a feature
 * flag is how a customer's own photograph outlives the Cast it was promised to
 * leave with.
 */
export const CASTING_REFERENCE_ATTACH_SCOPE_ENV = "CASTING_REFERENCE_ATTACH_SCOPE";

export class CastingReferenceAttachScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REFERENCE_ATTACH_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingReferenceAttachScopeConfigurationError";
  }
}

export class CastingReferenceAttachCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REFERENCE_ATTACH_SCOPE_ENV} ${detail}`);
    this.name = "CastingReferenceAttachCoverageError";
  }
}

export function parseCastingReferenceAttachScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingReferenceAttachScopeConfigurationError();
  });
}

/**
 * Whether this user may attach a picture.
 *
 * An AND of the whole chain at the point of use, for the reason its siblings
 * carry: the boot check refuses a scope that reaches past its parent, and a boot
 * check nobody invoked is the second way a flag pair goes wrong.
 *
 * ⚠ The other half was `captureCastingReferenceLibraryEnabled` until #1577
 * slice D5 retired the library's flag; it ENDED in this same call, so the
 * answer here is unchanged for every position production has ever held.
 */
export function captureCastingReferenceAttachEnabled(userId: number): boolean {
  const child = parseCastingReferenceAttachScope(process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

/**
 * Whether the attach door is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable before migration 0043 lands. It never gates the purge
 * itself — see the header.
 */
export function castingReferenceAttachArmed(): boolean {
  return parseCastingReferenceAttachScope(process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV]).kind !== "off";
}

export function validateCastingReferenceAttachEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const child = parseCastingReferenceAttachScope(input.scope);
  if (child.kind === "off") return child;

  if (input.cleanupWorker !== "true") {
    throw new CastingReferenceAttachCoverageError(
      "cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly \"true\" — an attached "
      + "picture is bytes we keep, and nothing would ever delete them",
    );
  }

  /*
    ⚠ THIS FENCE HAS NOW MOVED TWICE AND BOTH MOVES WERE A PARENT DYING UNDER
    IT. It tracked `CASTING_REPAINT_SCOPE` until #1577 slice 4a, which
    re-parented it onto the repaint's OWN parent, the reference library; slice
    D5 retires that flag too, so it is re-parented again onto the chain root,
    `CASTING_V2_SCOPE`. A child naming a missing parent refuses boot, which is
    why this is not optional either time.

    It changes nothing at the positions production actually holds, read at the
    service by name rather than argued: attach is `users:1`, the library stood
    at `all` and `CASTING_V2_SCOPE` is `all`, so the narrowing check passes
    before and after. Even at a narrower casting scope it would hold — the
    library's own capture ENDED in `captureCastingV2Enabled`, so every user
    inside the library was already inside the casting scope.

    ⚠ But it is the WEAKER of the two wherever the dying parent was narrower
    than the surviving one, and that is stated rather than glossed, exactly as
    slice 4a stated it of itself: a child at `all` under a `users:1` library
    used to be refused here and would now pass. There is no narrower flag left
    to track, because neither the repaint's flag nor the library's exists.

    ⚠ The cleanup worker is UNTOUCHED by the re-parent and is checked four
    statements above, which is the whole reason the library's retirement
    weakens no retention promise here: what eventually deletes an attached
    photograph is the sweep, and this flag asks for it itself rather than
    inheriting the question from a parent.
  */
  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingReferenceAttachCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — it became this `
      + "flag's parent when the reference library's own flag was retired (#1577 slice D5), and "
      + "nothing below an off parent is reachable",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingReferenceAttachCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingReferenceAttachCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the hair-from-a-reference sub-flag */

/**
 * TAKING HER HAIR FROM A PICTURE — the first thing the attach door's handle is
 * actually FOR (founder ruling relayed fable-1047 §3, sequenced fable-1071 §5).
 *
 * His words: *"if i supply a reference image and say copy hair from reference it
 * asks color? style? or full look."*
 *
 * On, a `refine` may carry a `referenceId`, an ask that names hair without
 * saying which of the three is meant gets the question, and the answer routes to
 * the form his ruling gives it — colour as WORDS, style and the whole look as a
 * CROP. Off, and absent means off, `refine` refuses a `referenceId` free and no
 * question is ever composed.
 *
 * # THE FLAG IS WHAT KEEPS THE QUESTION HONEST, and that is not a formality
 *
 * D-180's condition on every question this product asks is that it **never dead
 * ends**. A chip whose road is not built is a dead end wearing a tap target, and
 * this road has three chips landing over more than one chunk. So the whole of it
 * stays behind one switch until every answer acts — which means the flag is not
 * protecting a risky feature, it is protecting a PROMISE.
 *
 * # Its parent is the ATTACH door, and there is no second candidate
 *
 * A hair take reads or cuts a picture the customer handed us, and the handle for
 * that picture is minted by `castingV2.reference.attach`. Armed here and not
 * there, a customer would meet a question about a reference she has no way to
 * supply. The attach flag in turn carries the repaint and cleanup-worker
 * parents, so this inherits both without restating them — a crop reaches a
 * render on the repaint recipe and nowhere else, and the bytes it is cut from
 * are deleted by the worker.
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * No question is composed, no reference is resolved, no picture is read, no
 * crop is cut and no row is written. A `referenceId` on a refine is refused with
 * a sentence and nothing is charged.
 */
export const CASTING_HAIR_REFERENCE_SCOPE_ENV = "CASTING_HAIR_REFERENCE_SCOPE";

export class CastingHairReferenceScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_HAIR_REFERENCE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingHairReferenceScopeConfigurationError";
  }
}

export class CastingHairReferenceCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_HAIR_REFERENCE_SCOPE_ENV} ${detail}`);
    this.name = "CastingHairReferenceCoverageError";
  }
}

export function parseCastingHairReferenceScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingHairReferenceScopeConfigurationError();
  });
}

/**
 * Whether this user may take hair from a reference.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingHairReferenceEnabled(userId: number): boolean {
  const child = parseCastingHairReferenceScope(process.env[CASTING_HAIR_REFERENCE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingReferenceAttachEnabled(userId);
}

export function validateCastingHairReferenceEnvironment(input: {
  scope: string | undefined;
  attachScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingHairReferenceScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingReferenceAttachScope(input.attachScope);
  if (parent.kind === "off") {
    throw new CastingHairReferenceCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is off — the handle a hair `
      + "take travels with is minted by the attach door, so the question would be asked about a "
      + "picture the customer has no way to supply",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingHairReferenceCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingHairReferenceCoverageError(
      `names users outside ${CASTING_REFERENCE_ATTACH_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------- the open reference TAKE sub-flag */

/**
 * WHETHER A NAMED THING MAY BE TAKEN OUT OF AN ATTACHED PICTURE — #2736's
 * slice 2, under his word of 2026-10-29 (chat, verbatim and entire: *"BUILD
 * IT"*), on the step-0 design merged on that card.
 *
 * One row is: *the customer attached a photograph, typed "wear this jacket",
 * and the jacket in their picture reached the render as a person-free cut.*
 *
 * # WHY IT IS A FLAG OF ITS OWN RATHER THAN THE ATTACH DOOR'S
 *
 * The attach door decides whether a photograph may be KEPT. This decides
 * whether a thing may be CUT OUT of one and carried to a paint engine, which is
 * a different risk with a different failure: the attach door's worst day is a
 * picture nobody can use, and this road's worst day is a stranger's face
 * arriving on somebody's cast. The fence against that is in the bytes (§4 of
 * the design, {@link cutThingFromPicture}) and it is NEW code, so it earns a
 * switch that opening is a decision somebody makes.
 *
 * # WHY THE PARENT IS THE ATTACH SCOPE
 *
 * The take's whole input is an attachment. A user armed here and not at the
 * attach door would be offered a road with nothing to walk it on — the hair
 * reference's argument clause for clause, and its own parent for the same
 * reason.
 *
 * # ⚠ IT IS NOT THE ONLY GATE, AND THE SECOND ONE IS NOT HERE
 *
 * A GARMENT take additionally lands only where the stage wall already serves
 * clothing (`CASTING_OUTFIT_EDIT_SCOPE`, through `servedSubjectsFor` —
 * `refineSubjects.ts`). **The take never widens the wall**: it rides what #2544
 * opened, and a garment ask outside that flag is refused by the wall before this
 * road is ever consulted. That gate is sited at the ask rather than duplicated
 * here, because a second copy of it is the mirror this repository has been
 * bitten by (working law 4).
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * Byte-identical to the tree before it. An attached picture an account cannot
 * take from falls through exactly as one attached outside the hair road does —
 * the picture is CONFESSED as unused rather than silently ignored (#2713's
 * `attachedPictureUnusedNote`), which is the line D-181 has required since the
 * dropped reference went unmentioned for its whole life. No cut is minted, no
 * segmenter read is bought, no source rides.
 *
 * # ⚠ NO CLEANUP-WORKER CLAUSE HERE, AND THAT IS READ AT THE PARENT RATHER
 * THAN AN OMISSION
 *
 * The cut's bytes are minted under a storage cleanup manifest
 * ({@link mintTakeCut}, the hair carrier's own road), so the worker is what
 * deletes them. It is not re-demanded on this flag because the PARENT already
 * refuses to boot without it (`validateCastingReferenceAttachEnvironment`), and
 * this child cannot be non-off while its parent is off. A second copy of that
 * refusal would be a second list that could come to disagree.
 */
export const CASTING_REFERENCE_TAKE_SCOPE_ENV = "CASTING_REFERENCE_TAKE_SCOPE";

export class CastingReferenceTakeScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REFERENCE_TAKE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingReferenceTakeScopeConfigurationError";
  }
}

export class CastingReferenceTakeCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REFERENCE_TAKE_SCOPE_ENV} ${detail}`);
    this.name = "CastingReferenceTakeCoverageError";
  }
}

export function parseCastingReferenceTakeScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingReferenceTakeScopeConfigurationError();
  });
}

/**
 * Whether this user may have a named thing taken out of their picture.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingReferenceTakeEnabled(userId: number): boolean {
  const child = parseCastingReferenceTakeScope(process.env[CASTING_REFERENCE_TAKE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingReferenceAttachEnabled(userId);
}

/*
  THE RIDE FENCE STOOD HERE AND IS DELETED IN THE COMMIT THAT LANDS THE RIDE,
  exactly as its own thrown string ordered (#2736 slice 2; the
  `INK_REFERENCE_TAKE_BUILT` precedent, clause for clause).
  `REFERENCE_TAKE_RIDE_BUILT = false` refused every non-off position while the
  cut had nowhere to ride; the ride exists now — a clause-keyed `source` on the
  wardrobe presentation clause (`PresentationSource`, `recipeAssembler.ts`),
  the escalated decision of 2026-10-29 — so an opened gate buys a cut that
  reaches the engine, and the fence's reason is discharged rather than loosened.
*/
export function validateCastingReferenceTakeEnvironment(input: {
  scope: string | undefined;
  attachScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingReferenceTakeScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingReferenceAttachScope(input.attachScope);
  if (parent.kind === "off") {
    throw new CastingReferenceTakeCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is off — the picture a take `
      + "is cut out of is attached at that door, so the road would open onto an ask with nothing "
      + "to take from",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingReferenceTakeCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingReferenceTakeCoverageError(
      `names users outside ${CASTING_REFERENCE_ATTACH_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * THE REFERENCE SELECTOR'S OWN SWITCH — whether an attached picture is READ at
 * all (#14 slice 2, the build design's §9).
 *
 * # WHAT IT GOVERNS, AND IT IS NARROWER THAN THE CARD
 *
 * One thing: whether attaching a picture also buys a READING of it — the
 * discovery variant pointed at the reference, plus one detector rectangle per
 * name it brings back. That reading's product is a bounded list of named,
 * boxed markers and NOTHING ELSE. No cut is taken, no row is minted, no byte
 * is stored, nothing reaches a render, and no customer sees a marker: the
 * surface is slice 3's and the tap's cut is slice 4's. This flag buys the
 * answer a later slice draws.
 *
 * # WHY THE PARENT IS THE ATTACH SCOPE
 *
 * The reading's whole input is an attachment, so an account armed here and not
 * at the attach door would be offered a road with nothing to walk it on — the
 * hair reference's argument and the take's, clause for clause, and the same
 * parent for the same reason.
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * Byte-identical to the tree before it. An attach proceeds exactly as it does
 * today: no text call, no detector call, no money, and the words road
 * untouched. {@link captureCastingReferenceSelectorEnabled} is the only gate,
 * and a caller that never asks reads no differently from one refused.
 *
 * # ⚠ IT BUYS PROVIDER CALLS, WHICH IS THE WHOLE REASON IT IS A FLAG
 *
 * A reading is one or two text calls plus one detect per name — measured by
 * the slice-1 court on a real reference photograph: **8.3 s for 14 names over
 * 2 crops**, and **~1.8 s per detect**, the four detects moving the fal
 * balance by less than a cent. House money, never a customer credit, and the
 * marker cap is what bounds the detect half rather than a hope.
 *
 * # ⚠ NO CLEANUP-WORKER CLAUSE HERE, AND THAT IS READ RATHER THAN OMITTED
 *
 * Nothing on this road writes a byte to storage — the reading returns names
 * and rectangles in memory. The clause the take and the hair carrier each
 * carry exists because they MINT bytes under a manifest; slice 4's mint will
 * need it and this slice has nothing for it to delete.
 */
export const CASTING_REFERENCE_SELECTOR_SCOPE_ENV = "CASTING_REFERENCE_SELECTOR_SCOPE";

export class CastingReferenceSelectorScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REFERENCE_SELECTOR_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingReferenceSelectorScopeConfigurationError";
  }
}

export class CastingReferenceSelectorCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REFERENCE_SELECTOR_SCOPE_ENV} ${detail}`);
    this.name = "CastingReferenceSelectorCoverageError";
  }
}

export function parseCastingReferenceSelectorScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingReferenceSelectorScopeConfigurationError();
  });
}

/**
 * Whether this user's attached picture is read for takeable things.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingReferenceSelectorEnabled(userId: number): boolean {
  const child = parseCastingReferenceSelectorScope(process.env[CASTING_REFERENCE_SELECTOR_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingReferenceAttachEnabled(userId);
}

export function validateCastingReferenceSelectorEnvironment(input: {
  scope: string | undefined;
  attachScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingReferenceSelectorScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingReferenceAttachScope(input.attachScope);
  if (parent.kind === "off") {
    throw new CastingReferenceSelectorCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is off — the picture this `
      + "reading reads is attached at that door, so the road would open onto an ask with nothing "
      + "to read",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingReferenceSelectorCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingReferenceSelectorCoverageError(
      `names users outside ${CASTING_REFERENCE_ATTACH_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------ the pointer-engine sub-flag (#2863) ---------------- */

/**
 * WHICH ENGINE DRAWS THE BOX ROUND A NAMED THING — `CASTING_POINTER_ENGINE_SCOPE`
 * (#2863, his ruling of 2026-10-30 on #2846 part 5's blind marks: *"yes"*).
 *
 * The pointer road asks a detector for a rectangle round a bare noun, and every
 * road that asks it goes through `RegionReader.pointer`: the face panel's found
 * rows (`pointerCut.ts`), the other-ear look (`sideByDetector`), the take
 * (`referenceTake.ts`) and the reference picker's scan (`referenceDiscovery.ts`,
 * widened onto this flag by his word on the card: *"i assume that means whatever
 * the reference picker uses will switch also"*). On, the box comes from Gemini 4
 * Argon in ONE request per picture carrying every name, with Qwen3-VL behind it
 * and today's detector behind both (`pointerBoxer.ts`).
 *
 * # Why a switch, given he said yes
 *
 * It spends on a different account (OpenRouter rather than fal), at a measured
 * 0.51¢ a scan against today's 0.16¢, and it changes what the panel outlines.
 * His yes was to the engine on his eye's evidence; the switch is so his eye on
 * his own next panel round closes it before anybody else is moved.
 *
 * # Its parent is the CHAIN ROOT, because its consumers have two different ones
 *
 * The face scan hangs from `CASTING_FACE_SCAN_SCOPE` and the reference roads
 * from `CASTING_REFERENCE_ATTACH_SCOPE`; a box asked by neither is never asked,
 * so this flag reaching past either is inert rather than dangerous — it chooses
 * an engine for a call some other gate already decided to make. What it may
 * never reach past is `CASTING_V2_SCOPE` itself.
 *
 * ⚠ **It does not refuse to boot without `OPENROUTER_API_KEY`**, on
 * `CASTING_FACE_DISCOVERY_SCOPE`'s own argument: a boxer with no transport is
 * the fallback case the road is built around — today's detector answers, and
 * nobody sees anything at all.
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * Byte-identical to the tree before it: no boxer is built, `pointer` sends
 * today's detector request name by name, and nothing reaches OpenRouter.
 */
export const CASTING_POINTER_ENGINE_SCOPE_ENV = "CASTING_POINTER_ENGINE_SCOPE";

export class CastingPointerEngineScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_POINTER_ENGINE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingPointerEngineScopeConfigurationError";
  }
}

export class CastingPointerEngineCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_POINTER_ENGINE_SCOPE_ENV} ${detail}`);
    this.name = "CastingPointerEngineCoverageError";
  }
}

export function parseCastingPointerEngineScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingPointerEngineScopeConfigurationError();
  });
}

/**
 * Whether this user's boxes are drawn by the boxer rather than today's detector.
 *
 * An AND of the chain at the point of use, like every sibling: the boot check
 * refuses a scope reaching past its parent, and a boot check nobody invoked is
 * the second way a flag pair goes wrong.
 */
export function captureCastingPointerEngineEnabled(userId: number): boolean {
  const child = parseCastingPointerEngineScope(process.env[CASTING_POINTER_ENGINE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingPointerEngineEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingPointerEngineScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingPointerEngineCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — nothing below an off parent is reachable`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingPointerEngineCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingPointerEngineCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* --------------------- the dispatch sub-flag, RETIRED (#1577 slice D4)

   `CASTING_REFINE_DISPATCH_SCOPE` stood here with its env constant, its two
   error classes, `parseCastingRefineDispatchScope`,
   `captureCastingRefineDispatchEnabled` and
   `validateCastingRefineDispatchEnvironment`. It decided whether the paid half
   of a refine stopped holding the request. It is retired on his word of
   2026-10-15 (*"yes approve the plan and switch off the six settings"*), the
   ghost audit's row D4.

   ⚠ THIS ONE IS THE ODD MEMBER OF THE SIX AND THE REASON IS WORTH KEEPING: its
   OFF arm was the DEFECT, not the old feature. Every other flag in that batch
   chose between a retired road and a current one, so retiring it deleted dead
   code. Here, off meant the request was held for the whole render — median
   121 s, p95 276 s, and 1.7% of refines answering past the observed ~305 s
   gateway wall, where the socket carrying the answer is gone before the answer
   exists, the money safe and the REASON lost. The flag was raised to FIX that
   and reached `all` on 2026-08-25, so nothing was on the off arm, and retiring
   it means the fix can no longer be switched off by a variable.

   ⚠ AND THE HELD ROAD ITSELF DID NOT DIE WITH IT, WHICH IS WHY THIS SLICE
   WAITED A FORTNIGHT. Our own measuring scripts need the awaited road — handed
   a receipt they reach the end of their work and exit, abandoning a render they
   paid for (`refineService`'s own `cannotTakeAReceipt` docblock records the
   incident). While this flag was the only door to it, a script had to borrow a
   CUSTOMER switch to describe a fact about itself. #2560 built that door on the
   CALL, #2710 put it on all sixteen exposed callers, and only then was there
   nothing left here to remove. The road survives; the question *may this
   account answer early* is what is gone.

   The parent was `CASTING_V2_SCOPE` rather than the repaint scope, because the
   swap changed WHEN the answer arrived and never what was painted — the one
   sub-flag on this road for which a paste-road customer was a legitimate
   subject. That reasoning retires with it and is kept here because the next
   flag to hang off this chain will have to answer the same question. */

/* ------------------------------------- the tattoo-from-a-reference sub-flag */

/**
 * A TATTOO TAKEN FROM A PICTURE — the gate's reference arm (founder rulings
 * relayed fable-1047 §2 and fable-1078, designed opus-822, ruled fable-1115/1116).
 *
 * His words, the second of the two:
 *
 * > *"no any tattoo request from a reference image must be respected regardless
 * > if u can see it or not, if the sleeve cuts off and you cant see the full
 * > finished product in the image refinement it should carry into the
 * > sign/angles as it will still have the reference + description"*
 *
 * On, an ask that POINTS AT AN ATTACHED PICTURE for a tattoo stops meeting the
 * ink document gate (D-137), because the picture is the document the gate was
 * always asking for. Off, and absent means off, the gate behaves exactly as it
 * has for a words ask.
 *
 * ⚠ **That used to read *"face and neck render from words, everything else
 * waits"*, and BOTH halves have moved since.** The face carve-out was RETIRED
 * ungated on 2026-08-21 (`2fdc382d`, fable-1296 §1) — a face ask passed this
 * gate and died one door later at the measured-placement door, so the gate's
 * list stopped naming a surface `INK_PLACEMENTS` does not hold. And what a
 * words ask reaches is the words road's own business, and it serves all three
 * measured placements — the neck, an upper arm and the upper chest, narrowed by
 * what the outfit covers. (`CASTING_INK_WORDS_SCOPE` decided that until #1577
 * slice D3 retired it; there is one placement list now.) This flag governs the
 * REFERENCE arm alone.
 *
 * # WHY THIS ONE NEEDED A FLAG WHEN THE RESOLVER DID NOT
 *
 * The ink document gate fires **on a live road today** — `CASTING_V2_SCOPE` is
 * `all`, and every refine passes through `refineDelta`. So unlike the rest of
 * this build, opening that arm is a behaviour change for people who did not ask
 * for one. **A live road's behaviour must never change on a flag nobody
 * flipped** (fable-1116 §3), and that is the whole reason this constant exists.
 *
 * # BOTH PARENTS, AND WHERE EACH IS ENFORCED
 *
 *   the ATTACH door     the handle. A tattoo take reads a picture the customer
 *                       handed us, and `castingV2.reference.attach` is what
 *                       mints the handle for it. Checked directly below.
 *   the REPAINT scope   the carrier. A design reaches a photograph as a cropped
 *                       reference carried by the repaint recipe, and the paste
 *                       road carries none. Enforced through the attach flag's
 *                       own coverage check rather than restated here — a second
 *                       copy of a coverage rule is the mirror law 4 forbids, and
 *                       it is the copy that drifts.
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * No placement is resolved out of anybody's sentence, no side is asked for, the
 * gate walls exactly as it did, and not one row is written.
 *
 * # AND WHAT IS TRUE WHILE IT IS ON, BEFORE THE CUTTER EXISTS
 *
 * The arm opens onto an ask that is **ANSWERED**, never onto a render. Until the
 * crop-from-photo cutter lands, a reference-documented tattoo ask reaches the
 * take and the side question and stops there. Opening the gate alone would turn
 * a wall into a tattoo rendered from words — D-137's exact forbidden render —
 * which is why the arm and the take ship in one commit (ruled fable-1116 §4).
 */
export const CASTING_INK_REFERENCE_SCOPE_ENV = "CASTING_INK_REFERENCE_SCOPE";

export class CastingInkReferenceScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_REFERENCE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkReferenceScopeConfigurationError";
  }
}

export class CastingInkReferenceCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_REFERENCE_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkReferenceCoverageError";
  }
}

export function parseCastingInkReferenceScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkReferenceScopeConfigurationError();
  });
}

/**
 * Whether this user's tattoo ask may be documented by her own picture.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingInkReferenceEnabled(userId: number): boolean {
  const child = parseCastingInkReferenceScope(process.env[CASTING_INK_REFERENCE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingReferenceAttachEnabled(userId);
}

/**
 * WHETHER A DESIGN ROW CAN EXIST AT ALL, BY EITHER ROAD — the retention sweep's
 * question about `casting_ink_designs` (0034) and the plates hanging off it
 * (0037), and only ever about whether a MISSING TABLE is tolerable.
 *
 * Two doors mint a design row and neither is the other's parent: the studio's
 * upload (`CASTING_INK_STUDIO_SCOPE`) and the take from an attached picture
 * (`CASTING_INK_REFERENCE_SCOPE`, whose parent is the attach door). So this is
 * the OR of the two rather than a second list of conditions to keep in step
 * (law 4).
 *
 * ⚠ **ONLY ONE OF THOSE TWO DOORS SURVIVES, AND THAT IS EXACTLY WHY THE OR IS
 * HERE RATHER THAN THE STUDIO FLAG ALONE** (#1158 slice 4b). The studio retires
 * on his ruling *"It retires with N2"*; `recordInkDesign`'s only remaining
 * non-test caller is `inkReferenceMint.ts`, on the reference road he HELD (Crew
 * reply #213). Armed by the studio flag alone, these tolerances would flip from
 * *throw* to *swallow* the moment that variable comes off the service in slice
 * 4c — over a table the surviving road can still write. That is a customer's
 * own photograph outliving the Cast it was promised to leave with, with no
 * failing test and no error: the same shape #203 rule 1 names, and the reason
 * the crop tolerance below already ORed the pair.
 *
 * It never gates the purge itself. A row written while a flag was on must be
 * collected after it goes off, and a retention path that narrows with a feature
 * flag is how a picture of a real person's neck outlives the Cast it was
 * promised to leave with.
 */
export function castingInkDesignArmed(): boolean {
  return castingInkStudioArmed()
    || parseCastingInkReferenceScope(process.env[CASTING_INK_REFERENCE_SCOPE_ENV]).kind !== "off";
}

/**
 * And the delivered-tattoo crop (0049), which DERIVES rather than repeating it.
 *
 * A delivery crop cannot exist without a design row — the retention sweep says
 * so in its own comment, and the row's foreign key says it in the schema — so
 * the question *"can a crop exist?"* is the question above, not a second OR
 * kept in step with it by hand. It was that second OR until #1158 slice 4b,
 * which is working law 4 caught one edit before it could drift: the design
 * store's own tolerance was armed on the studio flag alone while this one,
 * asking a STRICTLY NARROWER question, was armed on both.
 */
export function castingInkDeliveryCropArmed(): boolean {
  return castingInkDesignArmed();
}

/*
  THE TAKE-BUILT GUARD IS GONE, AND THIS IS THE COMMIT ITS OWN MESSAGE NAMED.

  `INK_REFERENCE_TAKE_BUILT` stood here from `d93849b3` and refused any non-off
  `CASTING_INK_REFERENCE_SCOPE` while nothing read a placement out of her
  sentence — because an opened gate with no take behind it is a tattoo rendered
  from words (D-137). Its own thrown string said to delete it *"in the commit
  that lands the take, and not before"*, and this is that commit:
  `inkReferenceTake.ts` reads the placement and the side, `resolveInkPlacement`
  validates them, and `refineService` ANSWERS the ask before the claim and never
  dispatches it.

  Recorded here rather than simply removed, because a control that vanishes
  without a trace is indistinguishable from one that was never wired — which is
  the reading this campaign keeps having to repair.

  **What did not arrive with the take is the QUESTION**, and that is a ruling
  rather than a debt (fable-1120 §4): pre-cutter, every answer to *"which side?"*
  leads to *"we can't paint it yet"*, which is a dead end wearing a question. It
  lands with the cutter, when it has somewhere to lead.
*/

export function validateCastingInkReferenceEnvironment(input: {
  scope: string | undefined;
  attachScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkReferenceScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingReferenceAttachScope(input.attachScope);
  if (parent.kind === "off") {
    throw new CastingInkReferenceCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is off — the picture that `
      + "documents the tattoo is attached at that door, so the gate would open for an ask with "
      + "nothing to document it and render a design from words",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkReferenceCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkReferenceCoverageError(
      `names users outside ${CASTING_REFERENCE_ATTACH_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the ink CUT sub-flag */

/**
 * WHETHER AN UPLOADED DESIGN IS CUT OUT OF ITS PICTURE BEFORE IT IS STORED —
 * build 3a.2's upload wire (`V3B_INK_AND_MARKS_DESIGN_NOTE.md` §7.12, ruled
 * fable-1130 §1 and fable-1133 §3a).
 *
 * ⚠ **THIS FLAG NOW GOVERNS NOTHING AT ALL, AND EVERYTHING BELOW DESCRIBES A
 * DOOR THAT IS GONE** (#1158, his ruling *"It retires with N2"*). The upload it
 * paced was retired in slices 1–2 — `uploadInkDesign` does not exist — and
 * slice 4a moved its one remaining dependant, `CASTING_INK_REGION_CROP_SCOPE`,
 * onto the road that actually cuts (`CASTING_INK_REFERENCE_SCOPE`). So nothing
 * reads this flag and nothing is parented on it; `captureCastingInkCutEnabled`
 * was **deleted in slice 4b** along with `captureCastingInkStudioEnabled`, and
 * what stands below it now is the BOOT FENCE and this constant, nothing else.
 *
 * ✅ **THE VARIABLE IS GONE FROM THE SERVICE — UNSET 2026-09-24, SLICE 4c, IN
 * ONE ACT WITH `CASTING_INK_STUDIO_SCOPE`.** The crash the census worried about
 * is real and it points here: it is unsetting the PARENT while this child still
 * reads `users:1`, which this fence refuses at boot. Rehearsed through the real
 * `validateEnv()` against the service's own values with that exact case as a
 * NEGATIVE control — it refused, naming this flag. Unset together, there is no
 * window. `productionFlagPositions.mts` records the pair as `off`, which is how
 * that table says *the variable is not on the service*, and the rite compares it
 * on every push.
 *
 * ⚠ **THE FENCE AND THIS CONSTANT DID NOT GO WITH IT, AND SLICE 4b'S OWN
 * PARAGRAPH HERE SAID THEY WOULD — CORRECTED AT THE CODE, 2026-09-24.** It read
 * *"those two leave together, in slice 4c, in the same act as the variable"*.
 * They cannot, and the blocker is one level up rather than in this flag:
 * `server/scopeParentChain.test.ts` holds the declared scope constants and the
 * `validate…Environment` fences equal as SETS, so the two must move together —
 * true, and it says nothing about WHEN. **`CASTING_INK_STUDIO_SCOPE_ENV` cannot
 * leave at all today**, because `castingInkStudioArmed()` reads it and that
 * reader is the retention sweep's question, which slice 4b deliberately kept
 * and ORed with the held reference road. Deleting the constant means deleting
 * that term, which is a purge-path narrowing — the exact thing 4b's whole PR
 * existed to prevent, one slice later and under a cleanup's name.
 *
 * **And the position table cannot lose a row while any reader remains**: its
 * population arm takes the union of the Atlas's flag inventory and a constant
 * scan, and the Atlas reads `process.env["X"]` as well as the constant form, so
 * inlining the string would not help either.
 *
 * ⚠ **`CASTING_TWO_PATHS_SCOPE` WAS CITED HERE AS THE WORKED PRECEDENT FOR
 * STAYING, AND IT HAS SINCE GONE THE OTHER WAY — corrected 2026-09-25, #203
 * slice 2 step (e).** This paragraph read *"unset on his word 2026-09-24, its
 * row at `off`, its fence and constant still standing"*, which was true when
 * written and is now false in every clause: the fence, the constant and the row
 * are all deleted. **The precedent it still sets is the RULE rather than the
 * outcome** — a scope leaves when NOTHING reads it, and the two-paths flag
 * reached that state while this one has not, because `castingInkStudioArmed()`
 * is still the retention sweep's question. So the sentence above stands and its
 * example has changed sides: what stops this constant is a live reader, not a
 * convention.
 *
 * So what remains is a NAMED remainder rather than a slice: the studio
 * constant, its fence and this one leave when the retention sweep's *"could a
 * design row ever have been written?"* is answered without reading a variable
 * nobody can set. That is a reading, not a deletion, and it is not folded in
 * here. The history is kept below rather than rewritten: what a retired road
 * used to decide is how the next reader understands the rows it left behind.
 *
 * Off, and absent means off, `uploadInkDesign` behaves exactly as it does today:
 * her photograph is stored unchanged, no segmenter is called, and not one thing
 * about the door moves. On, the same upload asks two measured questions of her
 * picture and what lands in `casting_ink_designs.storageKey` is **the design
 * alone, on transparency** — the bytes the plate mint reads, and the bytes every
 * later consumer inherits.
 *
 * # A FLAG RATHER THAN A STRAIGHT SWAP, and the reason is that the door is LIVE
 *
 * `CASTING_INK_STUDIO_SCOPE` was `users:1` in production when this was written
 * — the founder's own account, uploading his own designs; it is UNSET as of
 * 2026-09-24 and there is no upload. Cutting before storing changed what an
 * upload DID: it spends two segmenter calls of house money, and it can refuse
 * a picture that succeeds today (a photographed person the reader could isolate
 * no design on). Landing that unflagged would change live behaviour on the
 * deploy that shipped it, which the standing autonomy grant forbids by name.
 *
 * # WHY THE PARENT IS THE STUDIO SCOPE AND NOTHING ELSE
 *
 * The cut happens INSIDE the upload door. A user who cannot upload has nothing
 * to cut, so arming this over them is arming a step of a road they cannot enter
 * — inert, and indistinguishable from mistaken. The repaint and cleanup-worker
 * parents ride in through the studio flag's own check rather than being
 * restated here; two checks of one fact drift apart.
 *
 * # `FAL_KEY` IS GUARANTEED BY THE CHAIN, AND THIS FILE DELIBERATELY DOES NOT
 * # RE-CHECK IT — a note, because its absence looks like an oversight
 *
 * The cutter refuses rather than storing a photograph when the reader does not
 * answer: the fence, and the right direction. But it means a deployment with no
 * segmenter transport would refuse **every** upload behind this flag, with a
 * sentence about her picture rather than about our configuration.
 *
 * A `FAL_KEY` check was written here for exactly that reason and then **deleted,
 * because it could never fire**. The parent chain is
 * `CASTING_INK_CUT_SCOPE` → `CASTING_INK_STUDIO_SCOPE` → `CASTING_V2_SCOPE`,
 * and the last of
 * those refuses to boot without the transport
 * (`CastingV2TransportConfigurationError`). So no configuration exists in which
 * this flag is armed and the key is missing.
 *
 * ⚠ **THE CHAIN HAS LOST TWO LINKS AND THE ARGUMENT IS UNAFFECTED, which is the
 * only thing that had to be re-asked.** The repaint's own flag sat between the
 * studio and the library until #1577 slice 4b retired it, and
 * `CASTING_REFERENCE_LIBRARY_SCOPE` sat between the studio and the casting
 * scope until slice D5 retired that one. Both times the chain still ENDS where
 * it ended, and it is the last link that carries the transport refusal — a
 * shorter chain to the same root guarantees the same fact.
 *
 * It was found by driving the guard through `validateEnv()` itself
 * (`scripts/rehearse-ink-cut-boot-disposable.mts`) and INSISTING THE ARM ASSERT
 * ITS OWN REASON: the arm refused, and refused on `CASTING_V2_SCOPE`'s message.
 * A looser regex would have printed PROVEN over a control that does nothing —
 * which is the shape half of `CLAUDE.md`'s inert-control list has. Law 4:
 * derive, never mirror; two checks of one fact drift apart, and the one that
 * cannot fire is the one that keeps its reputation.
 *
 * The rehearsal keeps the arm, aimed at the fact rather than at this file: with
 * the flag armed and no key, boot REFUSES, naming `CASTING_V2_SCOPE`.
 *
 * It declares no fal allowance of its own. The two questions ride the shared
 * `FAL_CONCURRENCY` courtesy pool that every region read already uses, so the
 * ceiling arithmetic `assertFalBudget` refuses to boot over is untouched.
 *
 * # WHAT IS STILL TRUE WITH IT ON
 *
 * **The widening tripwire stays armed.** Its retirement is verified at the wire
 * on the bytes handed to `fetchDesignBytes`, and that arm belongs to the build
 * that mints — which fable-1133 §1 folded into the mannequin resumption sitting,
 * beside the release door, D-138 and the fence court. A flag that can be off is
 * not a structural fact, and rows written before it was flipped still hold
 * photographs.
 */
export const CASTING_INK_CUT_SCOPE_ENV = "CASTING_INK_CUT_SCOPE";

export class CastingInkCutScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_CUT_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkCutScopeConfigurationError";
  }
}

export class CastingInkCutCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_CUT_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkCutCoverageError";
  }
}

export function parseCastingInkCutScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkCutScopeConfigurationError();
  });
}

/*
  AND THE CUT'S POINT-OF-USE PREDICATE WITH IT — #1158 slice 4b.

  `captureCastingInkCutEnabled` asked whether an uploaded design was cut before
  it was stored. The upload it paced died in slices 1–2, and its one remaining
  dependant — `CASTING_INK_REGION_CROP_SCOPE` — was moved in slice 4a onto the
  road that actually cuts (`CASTING_INK_REFERENCE_SCOPE`, the reference mint).
  So it had no production caller left, and deleting it is what makes
  `captureCastingInkStudioEnabled` above callerless too.

  ⚠ **THE BOOT FENCE AND THE `*_ENV` CONSTANT DELIBERATELY STAY, AND THIS
  CORRECTS THE CENSUS'S ORDER** (`docs/specs/INK_STUDIO_RETIREMENT_2026-09-24.md`
  §8, which had them leaving here). `server/scopeParentChain.test.ts` holds the
  declared scope constants and the `validate…Environment` fences equal AS SETS —
  *"a flag with no boot check is invariant 7's 'a control that is not invoked
  does not exist', wearing an env var"* — so the declaration and its fence cannot
  die one slice apart without going red in between. And they should not: the
  variable still stands at `users:1` on the service, so the fence is a live check
  on a live value and the declaration is what keeps the deploy rite comparing it.
  Both leave in slice 4c, in the same act as the variable, and the crash the
  census feared is avoided by unsetting the CHILD and the PARENT together rather
  than by deleting a fence early.
*/

/**
 * **WHETHER THE THING SHE POINTED AT IS THE SURFACE, NOT THE PATCH** — the
 * region-crop road (approved for design fable-1183 §2, countersigned in full
 * fable-1201).
 *
 * Off, and absent means off, an upload behaves exactly as `CASTING_INK_CUT_SCOPE`
 * describes: the named region NARROWS the ink mask and what is stored is the ink
 * inside it. On, the same upload may store the REGION ITSELF, face excluded —
 * because on a heavily tattooed person the ink mask is one patch of a patchwork
 * and the surface is the only picture that holds the sleeve she means.
 *
 * # The measurement that bought it
 *
 * ```
 * S1   tattooed skin   10,779 px   140x167      one piece of a thirty-piece body
 * S1   upper arm       38,079 px   183x353      the thing she is pointing at
 * ```
 *
 * Two rescue hypotheses died at the wire first (opus-876 §2): the reader is
 * exonerated — every ink read came back `masks 1`, so there was never a second
 * mask being discarded — and asking the ink question INSIDE the region's own
 * crop returns something smaller still (2,393 px). No word and no framing that
 * court tested returns the work the customer is pointing at. The surface does.
 *
 * # ⚠ IT IS INERT BY ARITHMETIC TODAY, AND THAT IS DECLARED RATHER THAN QUIET
 *
 * ```
 * S1 upper arm    183 short edge   S2 upper arm  229 short edge   REFUSED
 * S2 upper chest  720x390          the road's first real crop     CARRIED
 * INK_DESIGN_MIN_EDGE = 256
 * ```
 *
 * ⚠ **THE INERTNESS IS PER PLACEMENT, NOT PER ROAD, and this paragraph claimed
 * otherwise for one commit.** It read *"the road refuses both of its own
 * founder specimens"* — true of the ARM, measured; false of the CHEST, which
 * nobody had asked until the real reader was driven (opus-899). `upper chest`
 * on S2 answers a 720x390 surface, clears the floor comfortably, and produces
 * a crop of the whole chest piece. **So this flag is NOT inert: armed, a chest
 * placement changes what is stored today.** The arm placement stays
 * floor-blocked, and where it blocks the inertness is total rather than a
 * smaller cut — the scoped ink cut is `ink ∩ region` and therefore inside the
 * region, so a surface under the floor guarantees the fallback is under it too
 * and the picture refuses `cutTooSmall` with the flag either way
 * (`inkReferenceCutter.test.ts` asserts that as an equality).
 *
 * The floor is still a flip precondition, because the arm — the placement his
 * own ontology example names, *"copy his right arm sleeve"* — is the one it
 * blocks.
 *
 * ⚠ **THE FLOOR QUESTION IS ANSWERED, AND THE ANSWER IS NOT A NEW CONSTANT**
 * (the floor court, opus-903; ruled fable-1210 §1). Six paid frames, one
 * design, one placement, and the reference's pixel size as the only variable:
 *
 * ```
 *   reference     delivered ink        at the frames
 *   1200x1697     73,820 / 63,712 px   the design, fully drawn
 *    183x259      17,615 / 15,688 px   a sparse strand — THE DESIGN IS GONE
 *    732x1036     26,804 / 37,066 px   the design is back
 * ```
 *
 * Non-overlapping arms — the native smallest is 3.6x the small one's largest.
 * So 256 was RIGHT, for the reason its own docblock asserted without evidence,
 * and **the picture is made to meet it instead**: `inkReferenceUpscale.ts`
 * enlarges a cut under the floor through a faithful super-resolution model
 * (never a diffusion one — that would invent strokes the customer never drew),
 * bought only for a cut that would otherwise be refused, on the shared courtesy
 * pool. The enlarging is reached ONLY through this flag, and for a user inside
 * it, it rescues both roads' small cuts rather than the surface alone.
 *
 * **So the floor is no longer a flip precondition — it is a solved problem, and
 * the remaining two below are what stand.** No floor constant moved.
 *
 * # ITS FIRST REMAINING PRECONDITION IS A FOUNDER GATE THAT NO ARM CAN CLOSE
 *
 * This road sends more of a stranger's photograph to an engine than anything
 * before it: today a photographed person contributes at most one ink patch, and
 * this contributes a face-excluded SURFACE. fable-919 §3 is the gate — **a
 * face-bearing reference must produce a plate with zero person content, at the
 * frames, in front of him.**
 *
 * The face exclusion is armed at the bytes (`subtractMask`, `overlapPixels`, and
 * the S2 positive with its S1 negative), and that arm proves PIXELS ARE ABSENT.
 * It is not the gate. Law 9: only his eyes close it. Written here rather than
 * only in a report so the gate survives seat rotation, in the place the flip
 * will be argued.
 *
 * **It does not retire the widening tripwire either** — it enlarges what that
 * tripwire is about, which is the opposite.
 *
 * # AND ITS SECOND IS THE OFFER, which is also the containment test's backstop
 *
 * The customer is to be shown the crop that will ride (fable-1183 §2c) —
 * 3a.2(b)'s surface, the same prerequisite `CASTING_INK_CUT_SCOPE` carries. On
 * this road the offer is load-bearing in a second way that fable-1201 §3 ordered
 * written down: **region masks can overlap across adjacent surfaces in a
 * contorted frame, so a borderline containment pass is survivable ONLY because
 * she sees the crop before anything rides.** Nobody may relax the offer while
 * believing the containment test stands alone.
 *
 * ⚠ **AND THE SENTENCE ABOVE WAS IN THE PRESENT TENSE UNTIL 2026-08-24, WHICH
 * CLAIMED A SURFACE THAT DOES NOT EXIST.** 3a.2(b) is unbuilt — read at the
 * code rather than remembered: the only consumer of `inkDesignImagePath`
 * anywhere in `client/` is `shownCutSurface.test.ts`, a test asserting who owns
 * the spelling of the address. The route serves the bytes
 * (`routes/inkDesignDelivery.ts`); no room draws them. **This flag nevertheless
 * stands at `users:1` in production, and that is authorised rather than
 * accidental**: it rode with the cut pair on his own yes, because the object he
 * approved is the SURFACE cut and only this flag produces one (fable-1260 §2).
 * So the offer is a condition on WIDENING and on relaxing the containment test,
 * and it is not something a customer has today.
 *
 * # The parent is the INK REFERENCE road and nothing else
 *
 * ⚠ **THIS SAID `CASTING_INK_CUT_SCOPE` UNTIL 2026-09-24 (#1158 slice 4a), AND
 * ITS REASON DIED WITH THE STUDIO'S UPLOAD.** The reason given was *"the region
 * road is an escalation of the `cut` route — it is reached only after the
 * routing has already decided to cut, so a user whose uploads are not cut has
 * no road to escalate"*. That routing was the upload door's, and the upload
 * door is gone (#1158 slices 1–2). **The one road that reads this flag today is
 * the take from an attached picture** — `defaultCutDesign`, called by
 * `inkReferenceMint.ts` as its real `cut` — and that road says in its own
 * header that **`CASTING_INK_CUT_SCOPE` IS NOT CONSULTED** there, because on it
 * there is no not-cutting position to take. So the parent named here was a
 * parent that the only surviving caller deliberately ignores.
 *
 * The parent is `CASTING_INK_REFERENCE_SCOPE`: the road that produces this
 * flag's subject is the road that gates it. Nothing moved for any account when
 * it changed — both flags stand at `users:1` and the attach door above them
 * does too, so the same one account answers true either way, driven rather than
 * argued in this flag's own suite. The attach, repaint, library and transport
 * parents ride in through the reference flag's own check rather than being
 * restated here; two checks of one fact drift apart.
 *
 * It declares no fal allowance of its own. One extra call (`face`) on the road
 * that already asks three, riding the shared `FAL_CONCURRENCY` courtesy pool, so
 * `assertFalBudget`'s ceiling arithmetic is untouched.
 */
export const CASTING_INK_REGION_CROP_SCOPE_ENV = "CASTING_INK_REGION_CROP_SCOPE";

export class CastingInkRegionCropScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_REGION_CROP_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkRegionCropScopeConfigurationError";
  }
}

export class CastingInkRegionCropCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_REGION_CROP_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkRegionCropCoverageError";
  }
}

export function parseCastingInkRegionCropScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkRegionCropScopeConfigurationError();
  });
}

/** Whether this user's cut may be the SURFACE rather than the ink inside it. */
export function captureCastingInkRegionCropEnabled(userId: number): boolean {
  const child = parseCastingInkRegionCropScope(process.env[CASTING_INK_REGION_CROP_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingInkReferenceEnabled(userId);
}

export function validateCastingInkRegionCropEnvironment(input: {
  scope: string | undefined;
  referenceScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkRegionCropScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingInkReferenceScope(input.referenceScope);
  if (parent.kind === "off") {
    throw new CastingInkRegionCropCoverageError(
      `cannot be enabled while ${CASTING_INK_REFERENCE_SCOPE_ENV} is off — the only road that cuts `
      + "is the take from her attached picture, so a user who cannot document a tattoo with a "
      + "picture has no cut to widen",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkRegionCropCoverageError(
      `cannot be "all" while ${CASTING_INK_REFERENCE_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkRegionCropCoverageError(
      `names users outside ${CASTING_INK_REFERENCE_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

export function validateCastingInkCutEnvironment(input: {
  scope: string | undefined;
  studioScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkCutScope(input.scope);
  if (child.kind === "off") return child;

  /* No `FAL_KEY` check here, and its absence is a decision rather than a gap —
     see the docblock above. The chain up to `CASTING_V2_SCOPE` already refuses
     to boot without the transport, so a check here could never fire. */
  const parent = parseCastingInkStudioScope(input.studioScope);
  if (parent.kind === "off") {
    throw new CastingInkCutCoverageError(
      `cannot be enabled while ${CASTING_INK_STUDIO_SCOPE_ENV} is off — the cut happens inside the `
      + "upload door, so a user who cannot upload has nothing to cut",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkCutCoverageError(
      `cannot be "all" while ${CASTING_INK_STUDIO_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkCutCoverageError(
      `names users outside ${CASTING_INK_STUDIO_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * **WHETHER SHE MAY CHANGE A TATTOO SHE ALREADY HAS** — the transform road
 * (founder-ordered fable-1269 §2, designed opus-940, countersigned fable-1274).
 *
 * His own words, the hour his tattoo card went live: *"Can i actually make
 * edits to the upper chest tattoo? like make it bigger or somthing now it has
 * a bounding box?"*
 *
 * # What it gates, and what it deliberately does not
 *
 * Off, and absent means off, *"make his chest tattoo bigger"* travels the road
 * it travels today: the ink facet is read, a placement is resolved out of the
 * word *"chest"*, and the render paints **a fresh design invented from her
 * prose** on a master that has no ink. That is charged and it is wrong, and it
 * is nevertheless what off must mean — a dark landing changes nothing on the
 * deploy that ships it.
 *
 * On, the same ask carries her own DELIVERED CROP as the source with one clause
 * of the instruction changed (`inkAsDelivered`), so the tattoo on the wire is
 * the tattoo on her rather than a reinvention of it.
 *
 * **Two of the road's three arms are OUTSIDE this flag and that is deliberate**
 * (granted fable-1274 §4): an ask about ink she does not have, and an ask
 * naming two changes at once, are both answered free before the claim with an
 * honest sentence. Gating an apology is how the apology stays wrong for
 * everyone outside the flag.
 *
 * # WHY THE PARENT IS THE STUDIO SCOPE
 *
 * A transform's whole content is a picture of a tattoo this product already
 * delivered, and the studio door is the road that makes a tattoo deliverable at
 * all. Armed over a user outside it, the flag would guard a lane whose subject
 * cannot exist — inert, and indistinguishable from mistaken. The repaint,
 * library and cleanup-worker parents ride in through the studio flag's own
 * check rather than being restated here; two checks of one fact drift apart.
 *
 * # It spends nothing new
 *
 * No engine call, no segmenter call, no text call. The picture already exists
 * (migration `0049`), her words are already hers, and the change is a clause
 * swap read out of her own sentence by code (`inkPriorAsk`). `assertFalBudget`
 * is untouched, and there is no new stored byte anywhere, which is why this
 * flag needs no table and no migration.
 */

/**
 * WHETHER A CAST MAY BE BORN WITH TATTOOS THE PRODUCT KNOWS ABOUT — 7b(a)
 * (design opus-1031/1040/1042, countersigned fable-1381 ruling 3 and
 * fable-1399; the write site and its three judgement calls endorsed
 * fable-1412).
 *
 * Off, and **absent means off**, the product behaves exactly as it does today:
 * the interpreter is not asked about ink at all, so an unflagged roll's prompt
 * is BYTE-IDENTICAL to today's, `statedInk` is null on every roll, and no
 * `bornInk:` row has ever been written. On, a brief that describes tattoos
 * files one words-only library row per described region, minted at the landing
 * of each candidate it produced.
 *
 * # The population is real, and it is two rolls
 *
 * Production has 207 rolls. TWO name ink, fifteen minutes apart, the same
 * text — *"Bare-chested, displaying extensive black-and-grey ornamental tattoos
 * covering most of his chest, shoulders, upper arms, and lower neck."* Both
 * have zero surviving candidates today, so this feature has **no living
 * population at all**, which is stated here rather than discovered later.
 *
 * # Why the parent is `CASTING_V2_SCOPE` and nothing narrower
 *
 * A brief-born tattoo needs no studio door, no design row, no uploaded picture
 * and no repaint: the BRIEF is the document, which is D-137's boundary met by
 * the only route that meets it without a picture. Hanging this off the ink
 * studio would gate a lane whose subject does not require it — the words road's
 * own argument, one lane over.
 *
 * # It spends nothing new
 *
 * No new engine call, no new segmenter call, no new text call, no table and no
 * migration. The reading rides the interpreter call that already runs
 * (`statedInk`, beside `statedHair` and `statedAccessories`), and the row is
 * written from what that call already answered. `assertFalBudget` is untouched.
 *
 * # ⚠ What it does NOT buy, said here rather than found
 *
 * A born tattoo is RECORDED and DISCLOSED; it is not editable and it is not
 * pixels. 7b-ii — the sign-mint that would make it a picture — is not designed
 * and not started, and waits on the fable-1296 §3 court. The row's own lane
 * says the same thing in code: `selectCarriedFeatureWords` declines it
 * `markingDiscloses`, because a tattoo under fabric has zero visible
 * consequence and carrying its words would either do nothing or fight the view
 * prompt's placement discipline (fable-1396 §2).
 */
export const CASTING_BORN_INK_SCOPE_ENV = "CASTING_BORN_INK_SCOPE";

export class CastingBornInkScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_BORN_INK_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingBornInkScopeConfigurationError";
  }
}

export class CastingBornInkCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_BORN_INK_SCOPE_ENV} ${detail}`);
    this.name = "CastingBornInkCoverageError";
  }
}

export function parseCastingBornInkScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingBornInkScopeConfigurationError();
  });
}

/** Whether this account's briefs may be read for ink, and file a row when they name it. */
export function captureCastingBornInkEnabled(userId: number): boolean {
  const child = parseCastingBornInkScope(process.env[CASTING_BORN_INK_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingBornInkEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingBornInkScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingBornInkCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — the row is minted when a CANDIDATE `
      + "lands, and a user outside casting rolls none",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingBornInkCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingBornInkCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * WHETHER SHE MAY CHANGE A TATTOO SHE ALREADY HAS (founder-ordered fable-1269
 * §2, designed opus-940, countersigned fable-1274).
 *
 * # Why the parent is `CASTING_V2_SCOPE` and NOT the studio door
 *
 * ⚠ **IT WAS THE STUDIO DOOR UNTIL 2026-09-24 AND THAT WAS WRONG ON ITS OWN
 * TERMS — #1158 slice 3.** The sentence that parented it read *"a transform's
 * whole content is a picture of a tattoo this product already delivered, so a
 * user outside that door has no subject for it"*. The first half is exactly
 * right and it is what refutes the second: **the subject is the DELIVERED
 * CROP, not the design row**, and the studio door is not what produces one.
 *
 * The words road serves every measured placement — `CASTING_INK_WORDS_SCOPE`
 * stood at `all` and is retired (#1577 slice D3) — a words-born tattoo carries
 * no design row at all (crop #1 is a delivery with `designId` NULL), and
 * `inkApplied.ts` says so in its own header — *"on D-137's road there is no
 * design at all … this is the whole record of the tattoo"*. Delivered ink is
 * counted by SLOT and valued by the crop id, with no design id anywhere in the
 * reading. **So every account already has a subject for a transform, and the
 * studio parent was gating a lane whose subject does not require it** — the
 * same mistake the words road's own fence named one flag away, in a paragraph
 * that sat directly beside the wrong one in `_core/env.ts`. ⚠ **Both of those
 * are now TOMBSTONES rather than live paragraphs** — `CASTING_INK_WORDS_SCOPE`
 * is retired (#1577 slice D3), its docblock here is deleted and its fence in
 * `_core/env.ts` is a note saying so. The reasoning stands on its own feet
 * above; what is gone is the neighbour it used to point at.
 *
 * # What moved, and what did not
 *
 * **Nothing moved for any account.** The transform stays at `users:1` and the
 * AND at the point of use is the same AND: his account had the studio door and
 * has the casting door, and no other account names this flag. What changes is
 * what a FUTURE flip may do — under the studio parent, widening this flag
 * required widening the retiring tattoo studio with it, which is a widen
 * nobody wants and the reason the two had to come apart before #1158 can unset
 * the studio flag at all.
 *
 * ⚠ **AND WHETHER A WORDS-ROAD TATTOO MAY BE TRANSFORMED IS STILL HIS
 * QUESTION, DELIBERATELY NOT ANSWERED HERE.** Today such an account meets
 * D-137's free wall; opening it turns a free refusal into a 500-credit render,
 * so it is a widen with numbers attached and not a consequence of a re-parent.
 * This commit makes the question ASKABLE; it does not answer it.
 */
export const CASTING_INK_TRANSFORM_SCOPE_ENV = "CASTING_INK_TRANSFORM_SCOPE";

export class CastingInkTransformScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_TRANSFORM_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkTransformScopeConfigurationError";
  }
}

export class CastingInkTransformCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_TRANSFORM_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkTransformCoverageError";
  }
}

export function parseCastingInkTransformScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkTransformScopeConfigurationError();
  });
}

/** Whether this user may change a tattoo she already has. */
export function captureCastingInkTransformEnabled(userId: number): boolean {
  const child = parseCastingInkTransformScope(process.env[CASTING_INK_TRANSFORM_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingInkTransformEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkTransformScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingInkTransformCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — a transform rides the crop of a tattoo `
      + "this product delivered, and a user outside casting has no render that delivered one",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkTransformCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkTransformCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/*
  ⚠ **THE TWO PATHS' FLAG STOOD HERE AND IS RETIRED — #203 slice 2 step (e),
  2026-09-25, the wardrobe/basics retirement's LAST step.**

  `CASTING_TWO_PATHS_SCOPE_ENV`, `parseCastingTwoPathsScope`,
  `captureCastingTwoPathsEnabled`, `validateCastingTwoPathsEnvironment` and both
  of their error classes are deleted, and the variable was removed from the
  production service on 2026-09-24 on his own word — Crew reply #206, card
  `switch-06-two-paths-retire`, verbatim and entire: *"Unset it"*.

  **It governed nothing by the time it went, and that was READ rather than
  assumed.** Slice 1 (`67f422b9`) closed the entrance — no toggle on either
  surface, `createRoll` takes no path, `rollService` writes the column a constant
  `null` — and step (e) deleted the born road the flag had been the door to. A
  scope whose fence still refuses a boot over a value that decides nothing is
  invariant 7 inverted: not a control that is never invoked, but one invoked
  forever on behalf of a capability that no longer exists. The next person
  reading `env.ts` would reasonably conclude that setting this variable did
  something.

  # WHAT IS DELIBERATELY KEPT, BECAUSE A RETIREMENT IS NOT A PURGE

  - **The COLUMNS.** `casting_rolls.path` and `.wardrobeLine` hold the thirteen
    production rolls cast while the paths existed, and they are the only evidence
    of which rolls predate the author road. They are not backfilled and not
    nulled — his #206 comment says so in as many words.
  - **`CASTING_PATHS`** (`shared/castingPaths.ts`) — the columns type themselves
    from it, so the vocabulary is a PREREQUISITE of the retained data rather than
    a remnant of the retired road. The card asked for that file's deletion; at
    the code it cannot go while a column declares its enum from it, and saying so
    is part of this step.
  - **The READ side** — `currentWardrobeLine` over the stored pair, live on the
    refine and Sign roads, because a historical pathed cast refined today must
    still be read as what it was born wearing.

  ⚠ **AND THE THREE `unpathed` PREDICATES ARE UNTOUCHED, ON PURPOSE.** Each of
  `refineSubjects.ts`, `wardrobeCards.ts` and the coverage owner answers
  *unpathed* for its OWN reason, and they are deliberately not folded into one:
  they agree today by arithmetic, not by design, and collapsing them is the bug
  that nearly shipped once. That folding is #180's reading, not a deletion, and
  it is not this step's.
*/

/**
 * ⚠ **THE BRIEF FIDELITY BUILD** — whether a customer's own words are RATIONED
 * on the way into her sheet (`CASTING_BRIEF_FIDELITY_BUILD.md`, countersigned
 * fable-1600; two courts, $1.12, both text-only).
 *
 * Off, and absent means off, the roll road is BYTE-IDENTICAL to today's: the
 * interpreter is told `characterNotes` must be "Under 25 words.", the reply is
 * bounded at 180 characters, and there is no skin lane. On, that sentence is
 * replaced, the bound becomes the brief's own bound, and a stated skin fact
 * gets a lane that speaks.
 *
 * # WHY THERE IS A FLAG HERE AT ALL, AND WHY IT IS AN UNCOMFORTABLE ONE
 *
 * Every other capability in this program ships dark behind a scope because the
 * road is separable. This one is not: the announced cap and the enforced bound
 * are properties of ONE interpreter call that every roll makes, so a per-user
 * branch means **two products interpreting two sets of briefs**, with the
 * census, the corpus and every future reading having to ask which one it
 * measured. That is a real cost and it is paid on purpose, for one reason:
 *
 *   **the IMAGE side is unmeasured.** Both courts under this build are TEXT —
 *   the notes and the compiled prompts. A `Character detail:` line going from
 *   ~150 to ~500 characters is more IMAGE-prompt context, and this product's
 *   own measurement is that context is not additive: a SUBSET of prompt context
 *   raised the stage wall twice as often as its superset. Three things could
 *   move and none is measured — the eight candidates' variety, the stage wall,
 *   and the provider's content checker.
 *
 * # ⚠ ITS LIFESPAN IS DECLARED SHORT, AND THE DECLARATION IS PART OF THE RULING
 *
 * (fable-1600.) It exists for that one unknown, so **it widens to `all`
 * promptly after the founder's gate rather than living at `users:1` for weeks.**
 * Two products interpreting two sets of briefs is a cost paid briefly and on
 * purpose; paid indefinitely it becomes the road the design rejected — a flag
 * that never widens is a second product nobody maintains.
 *
 * **Every brief-fidelity reading taken while this is narrow stamps which side it
 * drove.** That is the run-label lesson and this campaign has paid for it once:
 * a corpus whose before/after labels named the OUTPUT FILE and nothing else
 * cost a two-tree confusion that a control word had to catch.
 *
 * The parent is `CASTING_V2_SCOPE` and nothing narrower — what it governs is
 * the compile of a ROLL, and a user outside casting has no brief to compile.
 */
export const CASTING_BRIEF_FIDELITY_SCOPE_ENV = "CASTING_BRIEF_FIDELITY_SCOPE";

export class CastingBriefFidelityScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_BRIEF_FIDELITY_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingBriefFidelityScopeConfigurationError";
  }
}

export class CastingBriefFidelityCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_BRIEF_FIDELITY_SCOPE_ENV} ${detail}`);
    this.name = "CastingBriefFidelityCoverageError";
  }
}

export function parseCastingBriefFidelityScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingBriefFidelityScopeConfigurationError();
  });
}

/**
 * Whether this user's briefs are read without a ration.
 *
 * An AND of the chain, for `captureCastingRepaintEnabled`'s reason: the boot
 * check already refuses a scope reaching past its parent, and the same rule is
 * enforced again where it is used, because a boot check nobody invoked is the
 * second way a flag pair goes wrong.
 */
export function captureCastingBriefFidelityEnabled(userId: number): boolean {
  const fidelity = parseCastingBriefFidelityScope(process.env[CASTING_BRIEF_FIDELITY_SCOPE_ENV]);
  if (!castingV2EnabledForUser(fidelity, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingBriefFidelityEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const fidelity = parseCastingBriefFidelityScope(input.scope);
  if (fidelity.kind === "off") return fidelity;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingBriefFidelityCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — what it governs is the COMPILE of a `
      + "roll, and a user outside casting has no brief to compile",
    );
  }
  if (parent.kind === "all") return fidelity;
  if (fidelity.kind === "all") {
    throw new CastingBriefFidelityCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = fidelity.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingBriefFidelityCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return fidelity;
}

/* ======================================================================= */
/*  THE CREATIVE REGISTER — `CASTING_CREATIVE_REGISTER_SCOPE` — RETIRED     */
/* ======================================================================= */

/*
  ⚠ THE REGISTER'S WHOLE BLOCK STOOD HERE AND IS GONE — #1443, slice 2 of the
  old-lane retirement, on his word on #1398 (Crew reply #228, 2026-09-26
  23:06:38Z, verbatim and entire: *"Delete it"*), whose card puts both halves in
  one sentence: *"the old lane comes out of the product, and so does the switch
  that used to choose between the two."*

  What left: `CASTING_CREATIVE_REGISTER_SCOPE_ENV`, its two error classes
  (`CastingCreativeRegisterScopeConfigurationError`,
  `CastingCreativeRegisterCoverageError`), `parseCastingCreativeRegisterScope`,
  `captureCastingCreativeRegisterEnabled` and
  `validateCastingCreativeRegisterEnvironment`. The flag stood at `all` on
  production from 2026-09-24 (his Crew reply #201: *"Yes"*), so every account
  was already on the author road and the collapse moved nothing at the wire.

  ⚠ WHAT DID NOT LEAVE, AND MUST NOT: the word `authorRoad` still names a
  SECOND thing — `rollComposedOnAuthorRoad` in `rollProjection.ts`, which reads
  the ROW's own compiled brief and never a flag. 220 of 306 production sheets
  are read through it, for good. The manifest
  (`docs/specs/OLD_LANE_RETIREMENT_MANIFEST_2026-09-27.md`) opens on that
  finding because a retirement done by grepping the name deletes the read path
  in the same edit and goes green.

  ⚠ AND ITS ONE CHILD WAS RE-PARENTED FIRST, IN ITS OWN SLICE (#1442, merged
  and deployed 2026-09-26 23:57Z). `CASTING_CONCEPT_UPLOAD_SCOPE` named this
  flag as its parent and its boot fence THROWS when the parent is off or
  narrower; this row going absent parses as `off`, so deleting it first would
  have been a boot refusal in a loop after a deploy that reported SUCCESS —
  the `unset-a-scope-chain-child-first` class. The child's own docblock below
  carries that history.
*/

/* ------------------------------------------ the concept-upload sub-flag */

/**
 * UPLOAD A CONCEPT (#185) — `CASTING_CONCEPT_UPLOAD_SCOPE`.
 *
 * Whether a customer may hand the studio a PICTURE and get back a description
 * of the person in it, in her own brief box, to cast from. The founder's own
 * order, 2026-08-28: *"if you have a model already or concept or image you can
 * upload it the image analyzer will analyze and describe it to the authour and
 * cast it with the description ... that way its easy for someone to upload an
 * image and get a prompt to create someone similar without having to type it
 * all out."*
 *
 * Off, and absent means off, `castingV2.concept.describe` answers NOT_FOUND
 * before a byte is decoded, the config answers `conceptUploadEnabled: false`,
 * and the start page's tile stays the honest inert placeholder it is today. No
 * describer is called and no picture is read.
 *
 * ⚠ **ITS PARENT IS `CASTING_V2_SCOPE` SINCE 2026-09-27 (#1442) — THIS
 * PARAGRAPH SAID `CASTING_CREATIVE_REGISTER_SCOPE` AND IS KEPT BELOW AS THE
 * REASON, BECAUSE THE REASON IS WHY THE RE-PARENT IS HONEST.** The full
 * argument, the crash-loop it avoids, and the three positions read at the live
 * service are on `captureCastingConceptUploadEnabled` below.
 *
 * What it said, and every word of it was true while the author road was one
 * account's: *"Its parent is `CASTING_CREATIVE_REGISTER_SCOPE`, not the casting
 * scope, and the difference is his sentence rather than caution."* What the
 * description must not contradict is the LOCKED HOUSE BLOCK, and `houseBlock.ts`
 * is appended by code only on the author road; off that road there is no block
 * for a description to argue with, and *"describe it to the authour"* names the
 * road outright. **Since the register went to `all` on 2026-09-24 there is no
 * off-that-road account left for a casting-only check to admit**, so the casting
 * parent now carries that sentence rather than dropping it. The cleanup-worker
 * parent still rides in through casting's own check.
 *
 * It spends **house money and never a customer's credits** — one text call with
 * the picture inline (cents), no engine render, no segmenter read, no stored
 * byte, no table and no migration, so `assertFalBudget` is untouched. The
 * photograph is dropped when the call returns: there is nothing kept, so there
 * is nothing to purge and no stranger's picture ever reaches a public URL.
 *
 * ⚠ **The upload does ride WHOLE to the describer vendor** — the same exposure
 * the ink studio's widening tripwire governs, and acceptable on the same ground
 * while the population is his own account. **Widening past `users:1` re-opens
 * that question explicitly**, and it is named here so the next seat finds it
 * rather than deriving it.
 */
export const CASTING_CONCEPT_UPLOAD_SCOPE_ENV = "CASTING_CONCEPT_UPLOAD_SCOPE";

export class CastingConceptUploadScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_CONCEPT_UPLOAD_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingConceptUploadScopeConfigurationError";
  }
}

export class CastingConceptUploadCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_CONCEPT_UPLOAD_SCOPE_ENV} ${detail}`);
    this.name = "CastingConceptUploadCoverageError";
  }
}

export function parseCastingConceptUploadScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingConceptUploadScopeConfigurationError();
  });
}

/**
 * Captured ONCE at the door. The PARENT is captured here too rather than
 * trusted to boot — its siblings' reason: a boot check nobody invoked is the
 * second way a flag pair goes wrong.
 *
 * ⚠ **ITS PARENT IS `CASTING_V2_SCOPE` AS OF 2026-09-27, AND IT WAS
 * `CASTING_CREATIVE_REGISTER_SCOPE` UNTIL THEN — slice 1 of the old-lane
 * retirement (#1442), on his word on #1398 (Crew reply #228, verbatim and
 * entire: *"Delete it"*).** The register is being retired with the house road it
 * gated, and **a child cannot name a parent that is leaving**: the register's
 * row goes absent from the service, `parseCastingCreativeRegisterScope` reads
 * `undefined` as `off`, this child is `all`, and the boot refuses — in a loop,
 * on every restart. That is the `unset-a-scope-chain-child-first` class.
 *
 * **It is a re-parent and not a loosening, and the reason is the old parent's
 * own sentence.** What this flag's description must not contradict is the locked
 * house block, and that block *"is appended by code only on the author road"* —
 * so the register was the honest parent while the author road was one account's.
 * Since 2026-09-24 the author road is **every** account's road
 * (`CASTING_CREATIVE_REGISTER_SCOPE=all`, his reply #201: *"Yes"*), so the
 * casting parent now carries the whole of that reason: a user inside casting is
 * on the author road, and there is no longer any off-that-road account for a
 * casting-only check to admit.
 *
 * **Behaviour on production: none, and it is read rather than argued.** At the
 * live service on 2026-09-27 `CASTING_V2_SCOPE`,
 * `CASTING_CREATIVE_REGISTER_SCOPE` and `CASTING_CONCEPT_UPLOAD_SCOPE` are all
 * `all`, so this gate goes from `all AND all` to `all` — the same answer for
 * every account.
 */
export function captureCastingConceptUploadEnabled(userId: number): boolean {
  const child = parseCastingConceptUploadScope(process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingConceptUploadEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingConceptUploadScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingConceptUploadCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — the description it writes is a `
      + "brief for a roll, and a user outside casting has nothing to cast from it",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingConceptUploadCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingConceptUploadCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------- the concept reader's rich-look sub-flag */

/**
 * THE RICH LOOK, THE FACE AND HAIR LEFT FREE (#2911) —
 * `CASTING_CONCEPT_RICH_LOOK_SCOPE`.
 *
 * Whether an uploaded concept is read as a RICH LOOK — signature pieces,
 * markings and where they live, fitted hardware, the wardrobe's materials and
 * silhouette, species facts first — with the face and the hair left for each
 * render to choose, by the reader model his bench picked, instead of today's
 * short TYPE note. His words, 2026-10-31 (chat, verbatim on the card): *"i think
 * we need to loosen things up to get more detailed casts"*, *"we still need to
 * let the image engine imagine its own version but still give it details to
 * imagine"*, and on hair: *"IF we dont specify hair it will default to most
 * likley from hertiage . i think we just settle on that."*
 *
 * Off, and absent means off, **the concept reader is today's byte for byte** —
 * the same model, the same rules, the same bounds, proven at the HTTP body by
 * `conceptReaderWire.test.ts` against hashes taken on the tree before this flag
 * existed. On, the same door, the same picture handling, the same sweeps and the
 * same refusals; what moves is the model, the instruction and the length bounds
 * (`conceptDescribe.ts`, the `RICH_LOOK` reading beside today's `TYPE_NOTE`).
 *
 * # WHY THE PARENT IS THE CONCEPT-UPLOAD DOOR
 *
 * This flag chooses HOW an upload is read, so an account armed here and not at
 * the upload door would hold a switch with nothing behind it. The casting
 * parent rides in through the door's own check rather than being restated here
 * — the reference take's shape, and a second copy of that refusal is a second
 * list that can come to disagree.
 *
 * It spends house money and never a customer's credits, exactly as the door
 * does: one text call, or two on a re-ask, with the picture inline and dropped
 * when the call returns. It shares the interpreter's ONE OpenRouter allowance
 * rather than buying a second (`interpreterTextQueue`), and no fal path is
 * touched, so `assertFalBudget` is untouched too.
 */
export const CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV = "CASTING_CONCEPT_RICH_LOOK_SCOPE";

export class CastingConceptRichLookScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingConceptRichLookScopeConfigurationError";
  }
}

export class CastingConceptRichLookCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV} ${detail}`);
    this.name = "CastingConceptRichLookCoverageError";
  }
}

export function parseCastingConceptRichLookScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingConceptRichLookScopeConfigurationError();
  });
}

/**
 * Whether this user's upload is read as a rich look. An AND of the whole chain
 * at the point of use, like every sibling: the door's own capture carries the
 * casting parent, so a narrowed casting scope still shuts this.
 */
export function captureCastingConceptRichLookEnabled(userId: number): boolean {
  const child = parseCastingConceptRichLookScope(process.env[CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingConceptUploadEnabled(userId);
}

export function validateCastingConceptRichLookEnvironment(input: {
  scope: string | undefined;
  conceptUploadScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingConceptRichLookScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingConceptUploadScope(input.conceptUploadScope);
  if (parent.kind === "off") {
    throw new CastingConceptRichLookCoverageError(
      `cannot be enabled while ${CASTING_CONCEPT_UPLOAD_SCOPE_ENV} is off — it chooses how an `
      + "uploaded concept is read, and a user outside that door has no upload to read",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingConceptRichLookCoverageError(
      `cannot be "all" while ${CASTING_CONCEPT_UPLOAD_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingConceptRichLookCoverageError(
      `names users outside ${CASTING_CONCEPT_UPLOAD_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* --------------------------------------------------- the retry sub-flag */

/**
 * THE RETRY BUTTON (#122 shape 1) — whether one failed sheet slice may be
 * rendered again, same words, for what that tile itself cost, refunded again on
 * failure.
 *
 * ⚠ This sentence quoted a flat twenty until 2026-10-02, and both halves of it
 * had moved: a flat figure became the TILE'S OWN recorded price in #1601 item 2
 * (his rule — *"a single-candidate retry charges and refunds its own row's
 * `pointsCost`"*), so a roll sheet's tile is 150 and a follow sheet's is 200,
 * and the account-level constant that twenty was read from is deleted. A price
 * written as a figure where the product no longer has one is the shape #1702 is
 * about; naming the mechanism is what makes it stay true.
 *
 * His own word (2026-08-26): *"should we also allow a try option aswell?"* —
 * yes, on engine-error and didn't-arrive tiles. Off, and absent means off,
 * `castingV2.retry` answers NOT_FOUND before a row is read and the config
 * answers `retryEnabled: false`, so the tile never draws a button the door
 * would refuse. Not one line of the road runs.
 *
 * Its parent is `CASTING_V2_SCOPE` and nothing narrower: what it re-renders
 * is a slice of a ROLL, and a user outside casting has no roll to retry. It
 * is a flag rather than a plain copy change because it is a new PAID
 * procedure — and its live population on production is measured zero (every
 * failed slice ever is `content_policy`, which this shape deliberately does
 * not serve), so dark costs nobody anything and `users:1` is his to say.
 */
/**
 * THE ROLL ENGINE ON HIS ACCOUNT — GPT IMAGE 2.5 FLARE (#1079, his eye on
 * court #1068, 2026-09-22: *"honestly flare gave good results"* → *"switch to
 * flare and let me roll some ill be able to see the difference"*).
 *
 * What it governs: which engine the ROLL road (and the Retry road, which
 * re-renders a slice of a roll) sends its eight jobs to. Under scope,
 * `castingCreativeEngine(userId)` hands back the Flare engine on the SAME
 * queue and budget; off, or absent, GPT Image 2 exactly as before. Nothing a
 * customer sees names either engine — the sheet is the sheet.
 *
 * Parent is the CASTING scope alone: an engine choice is a property of a roll,
 * and a user with no roll has no engine to choose. `users:1` on production on
 * his word; wider on his eye and not before, with Flare's price and its
 * refusal rate read first (both unmeasured the day this landed).
 */
export const CASTING_ROLL_ENGINE_SCOPE_ENV = "CASTING_ROLL_ENGINE_SCOPE";

/**
 * WHICH ENGINE, when the scope above names a user. The scope says WHO rides
 * the chosen engine; this says WHICH — one variable, a closed vocabulary, so
 * a switch between the two 2.5 models is a variable change and not a build
 * (his second switch of the day, Flare → Sunburst, is why it is a value).
 * Unset while the scope is on is a boot refusal: a scope with no engine
 * behind it would silently paint on GPT Image 2 while its row says otherwise.
 */
export const CASTING_ROLL_ENGINE_MODEL_ENV = "CASTING_ROLL_ENGINE_MODEL";
const CASTING_ROLL_ENGINE_MODELS = ["flare", "sunburst"] as const;
export type CastingRollEngineModel = (typeof CASTING_ROLL_ENGINE_MODELS)[number];

class CastingRollEngineModelConfigurationError extends Error {
  constructor(raw: string | undefined) {
    super(
      `${CASTING_ROLL_ENGINE_MODEL_ENV} must be one of ${CASTING_ROLL_ENGINE_MODELS.join(", ")} while `
        + `${CASTING_ROLL_ENGINE_SCOPE_ENV} names anyone — got ${raw === undefined ? "nothing" : JSON.stringify(raw)}`,
    );
    this.name = "CastingRollEngineModelConfigurationError";
  }
}

function parseCastingRollEngineModel(raw: string | undefined): CastingRollEngineModel | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = raw.trim().toLowerCase();
  return (CASTING_ROLL_ENGINE_MODELS as readonly string[]).includes(value) ? (value as CastingRollEngineModel) : null;
}

/** The engine this user's roll renders on — a 2.5 model under scope, or null for GPT Image 2. */
export function castingRollEngineModelFor(userId: number): CastingRollEngineModel | null {
  if (!captureCastingRollEngineEnabled(userId)) return null;
  return parseCastingRollEngineModel(process.env[CASTING_ROLL_ENGINE_MODEL_ENV]);
}

class CastingRollEngineScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_ROLL_ENGINE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingRollEngineScopeConfigurationError";
  }
}

class CastingRollEngineCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_ROLL_ENGINE_SCOPE_ENV} ${detail}`);
    this.name = "CastingRollEngineCoverageError";
  }
}

function parseCastingRollEngineScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingRollEngineScopeConfigurationError();
  });
}

export function captureCastingRollEngineEnabled(userId: number): boolean {
  const child = parseCastingRollEngineScope(process.env[CASTING_ROLL_ENGINE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingRollEngineEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  model: string | undefined;
}): CastingV2Scope {
  const child = parseCastingRollEngineScope(input.scope);
  if (child.kind === "off") return child;
  if (parseCastingRollEngineModel(input.model) === null) {
    throw new CastingRollEngineModelConfigurationError(input.model);
  }
  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingRollEngineCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — there is no roll to render`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingRollEngineCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingRollEngineCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

export const CASTING_RETRY_SCOPE_ENV = "CASTING_RETRY_SCOPE";

class CastingRetryScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_RETRY_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingRetryScopeConfigurationError";
  }
}

class CastingRetryCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_RETRY_SCOPE_ENV} ${detail}`);
    this.name = "CastingRetryCoverageError";
  }
}

function parseCastingRetryScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingRetryScopeConfigurationError();
  });
}

/**
 * Whether this user may retry a failed slice. An AND of the chain at the
 * point of use, for its siblings' reason: the boot check refuses a scope
 * reaching past its parent, and a boot check nobody invoked is the second way
 * a flag pair goes wrong.
 */
export function captureCastingRetryEnabled(userId: number): boolean {
  const child = parseCastingRetryScope(process.env[CASTING_RETRY_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingRetryEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingRetryScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingRetryCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — there is no slice to retry`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingRetryCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingRetryCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* --------------------------------------------- the creation-record sub-flag */

/**
 * THE CREATION RECORD BEHIND EACH KLIEG ID (N2d-1, #2311) —
 * `CASTING_CREATION_RECORD_SCOPE`.
 *
 * Whether a cast this account signs gets a signed, independently timestamped
 * record of who made it, when, a fingerprint of its master picture and the
 * steps taken (`creationRecordService.ts`; the design is
 * `docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`). Off, and absent
 * means off, the Sign never reaches the record road and no record is built on
 * request either — not one statement runs. The certificate download (N2d-2,
 * #2312, `server/routes/creationCertificate.ts`) reads it behind this same
 * scope — off, that route answers 404 and the room draws no button; the check
 * page (N2d-3) is the later surface.
 *
 * Its parent is `CASTING_V2_SCOPE`: a record is OF a signed cast, and a user
 * outside casting has none.
 *
 * ⚠ **ON WITHOUT THE KEY REFUSES BOOT AND NAMES THE VARIABLE** (the
 * `R7_EVIDENCE_INGEST_SCOPE` shape; invariant 7). A signing feature with no
 * key must refuse, not improvise — and it must not skip quietly either,
 * because a record road that silently never signs is a control that reads as
 * live and does nothing. The key's value is never in the message.
 */
export const CASTING_CREATION_RECORD_SCOPE_ENV = "CASTING_CREATION_RECORD_SCOPE";

export class CastingCreationRecordScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_CREATION_RECORD_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingCreationRecordScopeConfigurationError";
  }
}

export class CastingCreationRecordCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_CREATION_RECORD_SCOPE_ENV} ${detail}`);
    this.name = "CastingCreationRecordCoverageError";
  }
}

function parseCastingCreationRecordScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingCreationRecordScopeConfigurationError();
  });
}

/** Captured at the point of use, the chain ANDed — its siblings' rule. */
export function captureCastingCreationRecordEnabled(userId: number): boolean {
  const child = parseCastingCreationRecordScope(process.env[CASTING_CREATION_RECORD_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingCreationRecordEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  /** The private key's raw value — validated, never echoed. */
  privateKey: string | undefined;
}): CastingV2Scope {
  const child = parseCastingCreationRecordScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingCreationRecordCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — a record is of a signed cast, and there is none`,
    );
  }
  if (parent.kind === "users") {
    if (child.kind === "all") {
      throw new CastingCreationRecordCoverageError(
        `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
      );
    }
    const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
    if (uncovered.length > 0) {
      throw new CastingCreationRecordCoverageError(
        `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
      );
    }
  }
  /* Throws `CreationRecordKeyError`, naming the variable and never its value. */
  loadCreationRecordKey(input.privateKey);
  return child;
}

/* ------------------------------------------------------- the voice sub-flag */

/**
 * VOICE — `CASTING_VOICE_SCOPE` (N4b-1, #2469; design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md`).
 *
 * Whether a signed cast this account owns can have its written voice line
 * turned into a voice you can hear, make again and keep. Off, and absent means
 * off, no design call is made, no voice is saved, no clip is recorded and no
 * `cast_voices` row is written — not one statement runs, and the room draws
 * exactly what it draws today (*"No voice yet"*).
 *
 * Its parent is `CASTING_V2_SCOPE`: a voice is OF a signed cast, and an account
 * outside casting has none to give one to.
 *
 * ⚠ **ON WITHOUT THE KEY REFUSES BOOT AND NAMES THE VARIABLE** — the
 * `CASTING_CREATION_RECORD_SCOPE` shape, and invariant 7's reasoning rather
 * than a convention. A voice road with no transport does not degrade
 * gracefully: it would offer *"Make new voices from this text"*, take the
 * press, and fail every single time — and in slice 2 that press carries a
 * price. A flag that reads as live while nothing behind it can answer is the
 * control this law exists to forbid. The key's VALUE is never in the message.
 *
 * ⚠ **AND THE FLAG DOES NOT FENCE THE ACCOUNT'S PROVIDER RATION, because it
 * cannot.** The voice-operation ceiling is per PROVIDER ACCOUNT, not per
 * customer (§5), so widening this scope does not multiply what the house can
 * spend — it divides one monthly allowance among more people. That is why the
 * design keeps the scope at his account until a plan decision is made, and it
 * is a product fact rather than something this parser can enforce: the live
 * read before every Keep (`readAllowance`) is the control, and this flag only
 * decides who can reach it.
 */
export const CASTING_VOICE_SCOPE_ENV = "CASTING_VOICE_SCOPE";

export class CastingVoiceScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_VOICE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingVoiceScopeConfigurationError";
  }
}

export class CastingVoiceCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_VOICE_SCOPE_ENV} ${detail}`);
    this.name = "CastingVoiceCoverageError";
  }
}

export class CastingVoiceTransportConfigurationError extends Error {
  constructor(variable: string) {
    super(
      `${CASTING_VOICE_SCOPE_ENV} cannot be enabled unless the voice transport (${variable}) is configured`,
    );
    this.name = "CastingVoiceTransportConfigurationError";
  }
}

export function parseCastingVoiceScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingVoiceScopeConfigurationError();
  });
}

/** Captured at the point of use, the chain ANDed — its siblings' rule. */
export function captureCastingVoiceEnabled(userId: number): boolean {
  const child = parseCastingVoiceScope(process.env[CASTING_VOICE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingVoiceEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  /** The transport credential's raw value — tested for presence, never echoed. */
  voiceKey: string | undefined;
  /** The variable's NAME, so the refusal can say which one to set. */
  voiceKeyVariable: string;
}): CastingV2Scope {
  const child = parseCastingVoiceScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingVoiceCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — a voice is of a signed cast, and there is none`,
    );
  }
  if (parent.kind === "users") {
    if (child.kind === "all") {
      throw new CastingVoiceCoverageError(
        `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
      );
    }
    const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
    if (uncovered.length > 0) {
      throw new CastingVoiceCoverageError(
        `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
      );
    }
  }
  if (!input.voiceKey) {
    throw new CastingVoiceTransportConfigurationError(input.voiceKeyVariable);
  }
  return child;
}

/* ------------------------------------------- the current-description sub-flag */

/**
 * ONE CURRENT DESCRIPTION — `CASTING_CURRENT_DESCRIPTION_SCOPE` (#2565 slice 1,
 * with #2545 folded in; his word 2026-10-16: *"okay cool im happy with the
 * build"*, closing the #801 court on round 2's A4 arm).
 *
 * Whether a paid refine for this account carries ONE natural description of
 * the cast as they are now — written by a text model from the previous version's
 * description plus this edit, never an edit list (his words on #2545: *"it must
 * read naturally into the description not as an edit list"*) — in place of the
 * "Change only …" clause. And (#2576, his word 2026-10-16: *"build it"*) a
 * Follow pressed on an EDITED version sends the face's roll brief rewritten to
 * carry the direction the edits took, chosen before the claim
 * (`followBrief.ts`); a never-edited face's Follow is untouched. A Follow
 * child's first refine is seeded from its own roll's
 * brief like any face without a description: his ruling, 2026-10-16, verbatim: *"following a cast is meant to show cousins of that direction of cast not exact replicas of the same person you followed"*.
 *
 * Off, and absent means off: no description is written, none is read, and the
 * refine prompt is byte-identical to today's.
 *
 * Its parent is `CASTING_V2_SCOPE` alone — a description is of a cast, and the
 * repaint (the one render road since #1577 slice 4b) is every refine there is.
 * It needs no key of its own: the writer rides the interpreter's OpenRouter
 * engine and queue, and an absent engine is the writer's own fallback (today's
 * prompt), never a refusal — so there is no transport to refuse boot over.
 */
export const CASTING_CURRENT_DESCRIPTION_SCOPE_ENV = "CASTING_CURRENT_DESCRIPTION_SCOPE";

class CastingCurrentDescriptionScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_CURRENT_DESCRIPTION_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingCurrentDescriptionScopeConfigurationError";
  }
}

class CastingCurrentDescriptionCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_CURRENT_DESCRIPTION_SCOPE_ENV} ${detail}`);
    this.name = "CastingCurrentDescriptionCoverageError";
  }
}

function parseCastingCurrentDescriptionScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingCurrentDescriptionScopeConfigurationError();
  });
}

/** Captured at the point of use, the chain ANDed — its siblings' rule. */
export function captureCastingCurrentDescriptionEnabled(userId: number): boolean {
  const child = parseCastingCurrentDescriptionScope(process.env[CASTING_CURRENT_DESCRIPTION_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingCurrentDescriptionEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingCurrentDescriptionScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingCurrentDescriptionCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — there is no cast to describe`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingCurrentDescriptionCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingCurrentDescriptionCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------------- the outfit-edit sub-flag */

/**
 * CLOTHING IS AN EDITABLE SUBJECT IN REFINE — `CASTING_OUTFIT_EDIT_SCOPE`
 * (#2544 slice 1; his word 2026-10-15, verbatim: *"yes allow it"*, and
 * 2026-10-16 on the money question: *"yes refine is all the same price"*).
 *
 * Whether a paid refine for this account is SERVED the `wardrobe` subject —
 * that is the whole of it. On, *"put them in a long black coat"* is an ordinary
 * refine: the interpreter is told the subject exists, the garment half of the
 * stage lexicon stops refusing a value filed under it, and the backed stage
 * refusal stops claiming that clothing comes after Sign. Off, and absent means
 * off: the subject is on offer to nobody, every garment ask meets exactly the
 * wall it has met since #203 slice 2, and **every prompt this product sends is
 * byte-identical to today's** — which is a property of the code rather than a
 * promise (`refineOpenLaneClause.test.ts` pins all four by sha256).
 *
 * ⚠ **WHAT IT NEVER OPENS IS THE SCENERY HALF.** `backdrop`, `background`,
 * `wall`, `studio`, `set`, `scene`, `location`, `prop`, `chair`, `table` and
 * `holding` refuse under every subject, served or not, at all five sites. That
 * half of the lexicon is the only thing standing between an outfit edit and a
 * paid edit that repaints the room, and the design's §4 names the arm that
 * proves it with the flag ON.
 *
 * Its parent is `CASTING_V2_SCOPE` alone — clothing is worn by a cast, and the
 * repaint has been every refine's renderer since #1577 slice 4b. It needs no
 * key of its own and no new money: an outfit edit rides the refine's price,
 * claim, settle and catastrophic-only refund unchanged (the design's §2b, his
 * word), so there is no transport and no till to refuse boot over.
 *
 * Road (the design's §8): dark → `users:1` with the §6 wall-rate measurement →
 * his eye on real edits → `all` on his word → **the flag retires** (N2's law:
 * flags go home).
 */
export const CASTING_OUTFIT_EDIT_SCOPE_ENV = "CASTING_OUTFIT_EDIT_SCOPE";

class CastingOutfitEditScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_OUTFIT_EDIT_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingOutfitEditScopeConfigurationError";
  }
}

class CastingOutfitEditCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_OUTFIT_EDIT_SCOPE_ENV} ${detail}`);
    this.name = "CastingOutfitEditCoverageError";
  }
}

function parseCastingOutfitEditScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingOutfitEditScopeConfigurationError();
  });
}

/** Captured at the point of use, the chain ANDed — its siblings' rule. */
export function captureCastingOutfitEditEnabled(userId: number): boolean {
  const child = parseCastingOutfitEditScope(process.env[CASTING_OUTFIT_EDIT_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingOutfitEditEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingOutfitEditScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingOutfitEditCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — there is no cast to dress`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingOutfitEditCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingOutfitEditCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}
