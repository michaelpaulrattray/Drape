/**
 * WHAT EVERY TYPED FIELD ACCEPTS — declared once, imported by the router that
 * enforces it AND the box that stops you typing past it.
 *
 * # Why this file exists
 *
 * A `maxLength={N}` on a client input is a second copy of a number the server's
 * zod schema owns. The product had **eighteen** of them; two derived (the refine
 * pair, `080ffe6d`) and sixteen were hand-typed, with nothing in the suite
 * comparing a single one against the schema it shadows.
 *
 * That was filed as a drift RISK. It is not a risk — it is a thing that has
 * already happened, twice, and the second one was live for six months:
 *
 *   - `RedeemCodeModal` capped at 16 while `referral.redeem` accepted 20. Free
 *     only by luck about a format nobody involved was looking at.
 *   - the referral refusal named `FORMA-XXXXXX`, a prefix retired by the rebrand
 *     commit that had both files open and reported *"All 952 tests passing"*
 *     (`0efe3f9f` is the repair).
 *
 * **A cap is not a number, it is a set of places that must agree** — and the
 * places have to be COUNTED before the number is trusted. Counting them is what
 * found the two defects above; this file is what stops the count being needed
 * again.
 *
 * # Why ONE module and not one per domain
 *
 * `shared/refineLimits.ts` set the precedent of a per-domain file and it stays
 * separate, because it holds derived ARITHMETIC (a typing allowance, a composed
 * wire length) rather than a number — that is a contract with behaviour, not an
 * entry in a list.
 *
 * These sixteen are plain numbers across nine unrelated domains. Nine new files
 * to hold one or two constants each is ceremony that costs the reader the one
 * thing this file is FOR: being able to see every cap in the product at once,
 * and notice when two of them disagree about the same idea. §9's note below is
 * a finding that only exists because they are in one place.
 *
 * # The rule going forward
 *
 * A new typed field declares its cap HERE and both sides import it. A bare
 * `maxLength={<number>}` anywhere under `client/src` fails
 * `server/clientInputCaps.test.ts`, which sweeps for the shape rather than
 * walking a list somebody typed — because a list cannot know that `renameCast`'s
 * 60 is written in two client files, and the sweep found exactly that.
 */

/* ── Announcements (admin banner) ─────────────────────────────────────────
   Read by `server/routes/admin/announcements.ts` — TWICE each, on create and
   on update — and by `BannerManagement`. The server's own second copy is the
   reason the constant has to be what BOTH schemas import: fixing the client
   mirror alone would leave a mirror standing where nothing looks. */
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_MESSAGE_MAX_LENGTH = 2000;

/* ── Boards ───────────────────────────────────────────────────────────────
   `server/routes/boards.ts`, create and update, and `BoardHeader`. */
export const BOARD_NAME_MAX_LENGTH = 128;

/* ── Casting V2: a Cast's name ────────────────────────────────────────────
   ONE idea, FIVE places: `castingV2.renameCast` and `castingV2.sign` on the
   server, and `RenameCastDialog`, `CastingRoom` and `SignConfirm` on the
   client. **Two client files typed this number for one procedure** — which is
   why the arm sweeps for the shape instead of pairing sites to schemas. */
export const CAST_NAME_MAX_LENGTH = 60;

/* ── Legacy casting: a model's name ───────────────────────────────────────
   `server/routes/models.ts` and `CastProfilePanel`.

   ⚠ IT DISAGREES WITH `CAST_NAME_MAX_LENGTH` ABOVE — 128 against 60, for what
   a customer would call the same thing: the name of one of their casts. That
   is NOT repaired here and nothing about it changes: narrowing it could refuse
   a name somebody already has, and widening the V2 one is a product call about
   how long a name should be. **It is written down because a file holding every
   cap in the product is the only place this was ever going to be visible**,
   and it was not visible before. */
export const LEGACY_MODEL_NAME_MAX_LENGTH = 128;

/* ── Moderation: freeze / unfreeze ────────────────────────────────────────
   TWO server fields on TWO procedures — `moderatorReconciliation.freezeAccount`
   takes a `reason`, `unfreezeAccount` takes `notes` — and they are declared
   apart because they ARE apart, however equal they look today.

   ⚠ One client field submits to whichever the button chose
   (`UserInvestigationWidgets`), so it cannot name either constant: it takes
   `Math.min` of the two, at the call site, where the fact that it has two
   destinations is visible. `ReconciliationSubTab` names the unfreeze one
   alone, because that is the only place it can go. */
export const FREEZE_REASON_MAX_LENGTH = 500;
export const UNFREEZE_NOTES_MAX_LENGTH = 500;

/* ── Profile ──────────────────────────────────────────────────────────────
   `server/routes/profile.ts` and `ProfileTab`. */
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 100;
export const PROFILE_BIO_MAX_LENGTH = 500;

/* ── Wardrobe: a saved outfit ─────────────────────────────────────────────
   `server/routes/wardrobe.ts` (`outfits.save`) and `LayersPanel`. */
export const OUTFIT_NAME_MAX_LENGTH = 128;

/* ── Invite codes (admin) ─────────────────────────────────────────────────
   `server/routes/admin/inviteCodes.ts` and `AdminInviteCodes`. The code is
   admin-typed and free-form, which is why it is 32 rather than a format
   length — unlike a referral code, nothing mints it. */
export const INVITE_CODE_MAX_LENGTH = 32;
export const INVITE_CODE_NOTE_MAX_LENGTH = 256;

/* ── Access codes (login) ─────────────────────────────────────────────────
   `server/routes/access.ts`, on `validate` and `redeem` both, and `Login`. */
export const ACCESS_CODE_MAX_LENGTH = 64;
