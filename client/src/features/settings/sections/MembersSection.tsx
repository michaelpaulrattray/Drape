/**
 * Settings → Members (brief §8) — THE DESIGNED STUB.
 *
 * The founder named this section himself as the example of what a stub is for:
 * *"some of the features in the modals are [not] designed yet this doesnt mean
 * we should exclude them but we should stub them so we can design the functions
 * into those places at a later date. **a good example is the invite members
 * section.**"*
 *
 * ## ⚠ THERE IS NO MEMBERSHIP IN THIS PRODUCT AT ALL
 *
 * Measured at `drizzle/schema.ts`: no members table, no teams, no workspace
 * membership, no organisation. There is a `users` table and that is the whole
 * of it — no endpoint, no surface, no data. So this is not a section with an
 * empty list; it is a section whose SUBJECT does not exist, and #365 says what
 * that means: *"Do not render an invited-members table with nothing in it,
 * which reads as **you have no colleagues yet** rather than **this is not
 * built**."*
 *
 * So the seat count is absent (there is nothing to count), the one row drawn is
 * the signed-in user — the same `useAuth` row the account chip renders, never a
 * literal, the rule `section02-guard.test.ts` already enforces on the rail's
 * stack — and every control is inert.
 *
 * **The role notes are verbatim from the brief and stay whole.** §8: *"The
 * Reviewer line is the one that sells the feature: it tells an agency they can
 * bring a client in without risk."*
 */
import { Icon, P } from "@/foundation";
import { ProfileAvatar } from "@/features/profile/ProfileVisual";

import { SettingsGroup, StubControl, StubNote } from "../parts";

const ROLE_NOTES: { role: string; note: string }[] = [
  { role: "Owner", note: "Everything, plus billing and deleting the workspace." },
  { role: "Admin", note: "Invite people, create projects, generate — no billing access." },
  {
    role: "Creator",
    note: "Generate and edit in the projects they are added to. Spends credits.",
  },
  {
    role: "Reviewer",
    note: "Open, comment, approve and download. Cannot generate, so never spends your credits — free, and the safe way to bring a client in.",
  },
];

export function MembersSection({
  user,
  avatarUrl,
}: {
  user: { name?: string | null; email?: string | null } | null;
  avatarUrl: string | null;
}) {
  return (
    <>
      <SettingsGroup
        title="Members"
        note="Bringing people into a workspace is designed and not built yet. Everything on this page is inert until it is."
      >
        <div className="dp-mem__invite" aria-disabled="true">
          <Icon d={P.people} size={14} />
          <span>name@company.com</span>
          <span className="dp-set__spacer" />
          <StubControl reason="Inviting people is not built yet">
            <StubNote>INVITE</StubNote>
          </StubControl>
        </div>

        {/* The one row that can honestly be drawn: the signed-in account. */}
        {user ? (
          <div className="dp-mem__row">
            <span className="dp-mem__tile">
              <ProfileAvatar
                src={avatarUrl}
                identity={user}
                alt={user.name ?? "You"}
                className="w-full h-full object-cover"
              />
            </span>
            <span className="dp-set__rowtext">
              <span className="dp-set__label">{user.name ?? "You"}</span>
              <span className="dp-set__note">{user.email ?? ""}</span>
            </span>
            <span className="dp-set__spacer" />
            <StubControl reason="Roles are not built yet">
              <StubNote>OWNER</StubNote>
            </StubControl>
          </div>
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title="What each role will be able to do"
        note="Written down now so the feature has a target rather than being invented later under pressure."
      >
        <div className="dp-mem__roles">
          {ROLE_NOTES.map((entry) => (
            <p className="dp-mem__role" key={entry.role}>
              <span className="dp-mem__rolename">{entry.role}</span>
              <span>— {entry.note}</span>
            </p>
          ))}
        </div>
        <p className="dp-set__note" style={{ marginTop: "var(--s-6)" }}>
          Project access is set per project — open a project&apos;s settings to choose who can
          reach it.
        </p>
      </SettingsGroup>
    </>
  );
}
