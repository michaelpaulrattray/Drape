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

/* -- Casting V2: who a cast is on camera, and how they sound --------------
   N2b (#1242). ONE idea, THREE places: `castingV2.editCastPersonaField` on the
   server, and the two inline fields on `CastingRoom`.

   The sizes are THE CUSTOMER'S ceiling, not the drafter's. The drafted lines are two
   sentences and one line -- his specimen runs to 175 and 75 characters -- so
   these are roughly double, because a cap sized to our own output would refuse
   a customer a longer sentence than the one we wrote them for no reason a
   customer could see. They are a bound against a paste, not a style rule: the
   craft (camera-visible, baseline then exception) lives in the drafter's
   instruction, where his brief puts it, and never in a refusal at the keyboard.

   ⚠ The personality is the longer of the two ON PURPOSE and the two are
   declared apart rather than sharing one number: they are two different things
   -- two sentences against one line -- and a single shared cap would be the
   kind of accidental equality this file exists to make visible.

   ⚠ **AND "THE CUSTOMER'S CEILING, NOT THE DRAFTER'S" WAS A HOLE, NOW CLOSED
   -- a FOURTH place reads these numbers** (the relay's finding 3 on PR #2114).
   `castPersona.ts`'s `fitToCap` bounds the DRAFTED line by them too, at a
   sentence end. Nothing bounded the drafter before, so a long reply was stored
   and drawn and then a one-word change to it could not be saved: the edit
   procedure refused it at the cap, and the textarea's `maxLength` would not
   even let it be typed. **A line we write must be a line the customer can
   edit**, so the sentence above is still true of the CRAFT -- the drafter is
   not style-checked against these -- and no longer true of the LENGTH.

   ⚠ **AND BOTH NUMBERS MOVED ON 2026-10-09 (#2136), MEASURED RATHER THAN
   GUESSED -- 400/200 WERE CUTTING THE EXACT HALVES HE ASKED FOR.** His craft
   corrections gave each line two jobs: the personality's second sentence is
   TIMING, and the voice's second part is PERFORMANCE STYLE (pace, how much is
   said, how a question is answered). Because `fitToCap` cuts at a SENTENCE
   END, a line one character over the cap loses its whole second sentence --
   which is precisely the half his correction added, so the old caps deleted
   the feature while looking like a tidy bound.

   Driven through the real reader on three of his own production casts (Pigman,
   Henry, Rina), the same frame and brief on both arms:

     today's instruction   personality 155-254   voice  92-132   nothing cut
     his craft rules       personality 348-474   voice 258-303   personality
                                                                 cut 2 of 3,
                                                                 voice cut 3 of 3

   So the ceilings are set above the measured maximum with headroom, not at it:
   a cap that merely fits today's three casts would cut the fourth. His own
   Pigman specimen (323 / 215) sits inside both, which is the card's own
   done-when. ⚠ The specimen figures quoted higher up this block -- 175 and 75
   -- are the ORIGINAL N2b specimen's and are kept because the "roughly double"
   reasoning above was built on them; they are not the shape being drafted now.

   ⚠ The drafted lines now run LONGER than his specimen (348-474 against 323),
   and that is reported to him rather than silently trimmed by an instruction
   he did not ask for: a cut line loses a whole job, a long line only reads
   long, and which of those is worse is his eye's call (law 9). */
export const CAST_PERSONALITY_MAX_LENGTH = 500;
export const CAST_VOICE_MAX_LENGTH = 320;

/* -- Casting V2: the customer's own sentence, "say it your way" ----------
   #2197 (the Personality card) and #2205 (the Voice card). ONE number for
   both doors, on purpose and unlike the pair above: what it bounds is the
   SAME thing on both cards -- one sentence typed the way the customer would
   say it to a friend -- where the two lines above are two different shapes.
   #2205's own note: *"two different limits on two halves of one idea is the
   machinery showing through."*

   His two examples run to 98 and 57 characters ("Basically a tired old
   bouncer who's seen everything and stopped being surprised." / "Sounds like a
   tired blues singer who smokes too much."). 400 is four times the longer one:
   a bound against a paste, never a style rule, so a customer who says two
   sentences instead of one is not refused for it. It bounds the house-paid
   call's input as well -- this is the only customer text that rides the
   translation. Read by `castingV2.translateOwnWords` and
   `castingV2.editCastPersonaField`'s `ownWords`. */
export const CAST_PERSONA_OWN_WORDS_MAX_LENGTH = 400;

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

/* ── Admin: suspend / role change / IP block — the reason ─────────────────
   Three procedures, three fields, one each: `admin.users.suspendUser`,
   `rolesRouter.changeUserRole` and `ipBlockingRouter.blockIP`. Declared apart
   for the same reason the freeze pair is: they ARE apart, and equal today.

   Read by `server/routes/admin/{users,roles,ipBlocking}.ts` and by the four
   dialogs that submit them (`UserActionModals`, `AuditActionModals` — suspend
   is typed in two places). Until #816 each router hand-typed `500` beside the
   constants above and no dialog capped at all, which is the drift this file's
   header names. */
export const SUSPEND_REASON_MAX_LENGTH = 500;
export const ROLE_CHANGE_REASON_MAX_LENGTH = 500;
export const IP_BLOCK_REASON_MAX_LENGTH = 500;

/* ── Admin: a credit adjustment — the reason ──────────────────────────────
   `admin.users.adjustCredits`, the one staff reason that moves MONEY: it lands
   on the audit row, the admin action log and the immutable log beside the
   amount. Read by `server/routes/admin/users.ts` and by `CreditModal`
   (`UserActionModals`). Until #816's last row the router hand-typed `500` and
   the dialog had no cap at all — the same drift as the three above. */
export const CREDIT_ADJUST_REASON_MAX_LENGTH = 500;

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
