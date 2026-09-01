/**
 * UserCard — THE account menu. Name and balance, the three account rows,
 * the staff group for privileged roles, then Sign out.
 *
 * Rendered by `AppChrome.tsx` into `Topbar`'s `account.menu` slot — the
 * topbar's avatar chip is its only live consumer since section 02 moved the
 * account out of the rail's foot. Role gating mirrors the server: Admin needs
 * `role === 'admin'` (adminProcedure), Moderation shows for admins and
 * moderators (moderatorProcedure).
 *
 * ---------------------------------------------------------------------------
 * ## Section 04 (`.../drape-redesign/04-account-menu.md`, #374)
 *
 * Set from the prototype (`design_handoff_studio/Klieg Studio.dc.html:179-202`)
 * rather than adjusted toward it — §3's own instruction, because *"a menu is a
 * place where 1px per row compounds visibly."*
 *
 * ⚠ **THE BRIEF'S §1 TABLE COMPARES THIS FILE AGAINST HIS OWN DRAWING AND
 * CALLS THE DRAWING A FILE.** Its right-hand column is headed *"The topbar's
 * inline menu"*; the topbar renders THIS component and has no inline menu. Read
 * at the artifacts (#374, and the table is corrected in the brief itself):
 * every row of that column is the PROTOTYPE — `Owner · Klieg Studio` verbatim,
 * a shield for Admin, a list for Moderation — and two of the five are
 * impossible for any code file, because the only other account menu in the tree
 * (`StudioSlimHeader.tsx`) has no staff group at all.
 *
 * **The defect it reports is real all the same**: two account menus exist and
 * they have drifted. His answer settles what to do about the other one —
 * *"legacy casting studio is getting retired thats the answer it doesnt need a
 * new menu"* — so `StudioSlimHeader`'s is FROZEN, not ported and not deleted,
 * and it dies with `DrapeStudio` at N8. `accountMenuPopulation.test.ts` is the
 * arm that stops a THIRD one growing.
 *
 * What changed here, and why each one:
 *
 *  - **No avatar in the identity block** (§2a). You just clicked the avatar to
 *    open this; repeating it 30px below costs the width that makes the two
 *    lines fit.
 *  - **`1,240 credits · Owner`** — balance in mono because it is a measured
 *    number, `credits · Owner` in the sans face. A bare balance duplicated the
 *    chip in the same bar; pairing it with the role answers *what can I spend*
 *    and *what am I allowed to do* in one line, which is the pair the avatar
 *    cannot say. **No workspace name** — it is in the topbar's project chip and
 *    the Settings header already, so it is the one of the three that can go.
 *    ⚠ `Owner` is a stub and is declared as one: `WORKSPACE_ROLE_LABEL`.
 *  - **Every row carries an icon, Sign out included** (§2b), and they come from
 *    the house set at `Icon`'s fixed 1.7 stroke — the hand-set `strokeWidth`
 *    is gone with the Lucide import. His own reversal, verbatim: *"I first
 *    specified icons on the staff rows only … That was wrong twice over"* —
 *    nobody infers a category from an absence, and the `STAFF` heading does
 *    that job explicitly. With all six iconed, the count pill becomes the ONLY
 *    thing marking a staff row, which is exactly right: the pill means *there
 *    is work waiting*.
 *  - **Settings draws `P.cog`, not `P.settings`.** ⚠ §2b asks for a fresh
 *    `icons.tsx` in which `P.settings` is a cog and the two-slider mark has
 *    become `P.filters`. **That drop has not arrived** — both copies of his
 *    icon file still have `settings` as the two-slider mark and neither has a
 *    `filters` key — so using `P.settings` here would ship the filter/settings
 *    collision the brief is warning against. The cog he means is `P.cog`, put
 *    there by his own #382 (*"it should be a cog like in the top bar profile
 *    drop down menu"* — this menu), and `P.settings` stays the unused fallback
 *    his #373 word preserved.
 *
 * ⚠ **THE COUNT PILLS ARE STILL PROP-DRIVEN AND NOTHING PASSES THEM.** The look
 * is proven (`section00b-guard.test.ts`) and it omits at zero rather than
 * rendering `(0)`. The NUMBERS are section 01's — they need a server reader that
 * does not exist (pending change requests + unanswered Crew cards; audit rows
 * above `info` in 24h) — and §4 says in as many words: *"Do not add a query to
 * this component for the staff numbers. They arrive as props."*
 *
 * ---------------------------------------------------------------------------
 * ## Section 00b, still binding
 *
 *  - `fontWeight: 600` is never used; the foundation says so about itself.
 *  - The `<style>` block is gone — the hover lives in `foundation.css` as
 *    `.dp-menuitem`, once, shared with `LobbyUtilityMenu`. That sharing is why
 *    section 04's departures from the shared grammar are scoped to
 *    `.dp-account-menu` rather than written into the row itself.
 *  - The staff group has a `STAFF` heading; `Moderator` reads `Moderation`, so
 *    both labels name a place.
 */
import { useLocation } from 'wouter';
import { Icon, P, WORKSPACE_ROLE_LABEL } from '@/foundation';
import { showsMenuCount } from '@/foundation/menuCount';

interface UserCardProps {
  userName: string;
  creditsBalance: number;
  role?: string | null;
  /** Pending change requests + unanswered Crew cards. Omitted at zero. See §01. */
  adminCount?: number;
  /** Audit entries above `info` in the last 24h. Omitted at zero. See §01. */
  moderationCount?: number;
  onOpenSettings: () => void;
  /** #267 — Settings at its Members section. Never a modal of its own. */
  onOpenMembers: () => void;
  onOpenBilling: () => void;
  onLogout: () => void;
}

export function UserCard({
  userName,
  creditsBalance,
  role,
  adminCount,
  moderationCount,
  onOpenSettings,
  onOpenMembers,
  onOpenBilling,
  onLogout,
}: UserCardProps) {
  const [, navigate] = useLocation();
  const isAdmin = role === 'admin';
  const isModerator = isAdmin || role === 'moderator';

  return (
    <div className="dp-menu">
      <div className="dp-menu__identity">
        <span className="dp-menu__name">{userName}</span>
        <span className="dp-menu__meta">
          <span className="dp-menu__balance">{creditsBalance.toLocaleString()}</span>
          <span>credits · {WORKSPACE_ROLE_LABEL}</span>
        </span>
      </div>

      {/*
        #267 — HIS THREE LABELS, and the binding clause under them: *"all three
        open the SAME Settings modal at different sections, so none of them may
        be wired to an individual modal now — every one added is one more to
        unpick later."* Section 03 is what made that possible; before it there
        was no sectioned modal to point at.

        ⚠ **`Share Drape` IS GONE AND ITS DESTINATION IS NOT.** `ReferralModal`
        is deleted; referrals are a block inside Billing (brief §9, *"referral
        credits are billing"*), which `Billing & credits` opens. Removing the
        row is the consolidation, not a capability loss — his own list for this
        menu names three items and this is not one of them.
      */}
      <UserMenuItem glyph={P.cog} label="Settings" onClick={onOpenSettings} />
      <UserMenuItem glyph={P.people} label="Members & invites" onClick={onOpenMembers} />
      <UserMenuItem glyph={P.card} label="Billing & credits" onClick={onOpenBilling} />

      {isModerator && (
        <>
          <div className="dp-menugroup">
            <span className="dp-menugroup__label">STAFF</span>
            <span className="dp-menugroup__rule" aria-hidden="true" />
          </div>
          {isAdmin && (
            <UserMenuItem
              glyph={P.grid}
              label="Admin"
              count={adminCount}
              onClick={() => navigate('/admin/overview')}
            />
          )}
          <UserMenuItem
            glyph={P.shield}
            label="Moderation"
            count={moderationCount}
            onClick={() => navigate('/moderator')}
          />
        </>
      )}

      <UserMenuItem glyph={P.exit} label="Sign out" onClick={onLogout} accent />
    </div>
  );
}

interface UserMenuItemProps {
  /** A path from the house set. Never a Lucide component — `Icon` fixes stroke. */
  glyph: string;
  label: string;
  onClick: () => void;
  /** Rendered as a pill on the right. Omitted at zero — never `(0)`. */
  count?: number;
  accent?: boolean;
}

function UserMenuItem({ glyph, label, onClick, count, accent }: UserMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dp-menuitem${accent ? ' dp-menuitem--accent' : ''}`}
    >
      <Icon d={glyph} size={13} />
      <span className="dp-menuitem__label">{label}</span>
      {showsMenuCount(count) ? <span className="dp-menucount">{count}</span> : null}
    </button>
  );
}
