/**
 * SETTINGS — the one account surface, replacing three of the five modals
 * (brief §4, §5).
 *
 * `ProfileSettingsModal`, `BillingModal`'s state half and `ReferralModal` all
 * end here. §10: *"Do not keep the five modals and style them alike. If a
 * separate `ProfileSettingsModal` exists at the end, this failed."*
 *
 * ## ONE state pair, not six booleans
 *
 * §2: *"One state pair for Settings — `open` and `section`. Not six booleans,
 * not one flag per retired modal. That is what makes the consolidation real
 * rather than four modals in a trench coat."* Every entry point in §2 is a call
 * to `openSettings(section)`, which is why the account menu's three rows and
 * the rail's gear can all land on the right page without three components
 * knowing about each other.
 *
 * ## The two structural rules the brief calls load-bearing
 *
 * - **The header and footer are `flex: none`; only the pane scrolls.** An
 *   action inside a scrolling pane goes below the fold, and in both cases where
 *   that happened in the prototype the most reachable remaining control was a
 *   subscription cancellation.
 * - **Sign out is at the NAV's foot, never in the footer beside Done.** It is
 *   destructive-adjacent, and a mis-click there ends the session.
 *
 * ## No Save button
 *
 * §10 forbids one, and the footer says why: fields commit as they are edited.
 * The line is not decoration — it is what stops somebody hunting for a Save
 * that is not there.
 */
import { useMemo } from "react";
import { X } from "lucide-react";

import { ModalScrim } from "@/foundation/CastingModal";
import { Button, Icon, P, BRAND_NAME } from "@/foundation";

import "./settings.css";
import { ProfileSection } from "./sections/ProfileSection";
import { UsageSection } from "./sections/UsageSection";
import { BillingSection } from "./sections/BillingSection";
import { MembersSection } from "./sections/MembersSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { SecuritySection } from "./sections/SecuritySection";

/**
 * THE SIX. §10: *"Do not add a seventh Settings section. Six is the set."*
 * Referrals are a block inside Billing precisely because a section visited
 * twice a year should not own a permanent nav row (§9).
 */
export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile", icon: P.avatar },
  { id: "usage", label: "Usage", icon: P.grid },
  { id: "billing", label: "Billing", icon: P.card },
  { id: "members", label: "Members", icon: P.people },
  { id: "notifications", label: "Notifications", icon: P.bell },
  { id: "security", label: "Security", icon: P.shield },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

export function SettingsModal({
  section,
  onSection,
  onClose,
  onSignOut,
  onChangePlan,
  onAddCredits,
  user,
  avatarUrl,
  onAvatarChange,
  planName,
  planPriceInCents,
  allowance,
  balance,
  creditsUsed,
  renewsAt,
}: {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  onClose: () => void;
  onSignOut: () => void;
  onChangePlan: () => void;
  onAddCredits: () => void;
  user: { name?: string | null; email?: string | null; authProvider?: string | null } | null;
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
  planName: string;
  planPriceInCents: number;
  allowance: number;
  balance: number;
  creditsUsed: number;
  renewsAt: Date | null;
}) {
  const pane = useMemo(() => {
    switch (section) {
      case "usage":
        return <UsageSection allowance={allowance} creditsUsed={creditsUsed} />;
      case "billing":
        return (
          <BillingSection
            planName={planName}
            planPriceInCents={planPriceInCents}
            allowance={allowance}
            balance={balance}
            renewsAt={renewsAt}
            onChangePlan={onChangePlan}
            onAddCredits={onAddCredits}
          />
        );
      case "members":
        return <MembersSection user={user} avatarUrl={avatarUrl} />;
      case "notifications":
        return <NotificationsSection />;
      case "security":
        return <SecuritySection user={user} />;
      case "profile":
      default:
        return (
          <ProfileSection user={user} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
        );
    }
  }, [
    section,
    allowance,
    creditsUsed,
    planName,
    planPriceInCents,
    balance,
    renewsAt,
    onChangePlan,
    onAddCredits,
    user,
    avatarUrl,
    onAvatarChange,
  ]);

  return (
    <ModalScrim
      label="Settings"
      scrimClassName="dp-set__scrim"
      cardClassName="dp-set__card"
      busy={false}
      onDismiss={onClose}
    >
      <header className="dp-set__head">
        <span className="dp-set__title">Settings</span>
        <span className="dp-set__workspace">
          {BRAND_NAME} · {planName} plan
        </span>
        <button
          type="button"
          className="dp-set__close"
          onClick={onClose}
          aria-label="Close settings"
        >
          <X size={15} strokeWidth={1.7} />
        </button>
      </header>

      <div className="dp-set__body">
        <nav className="dp-set__nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="dp-set__navitem"
              aria-current={entry.id === section}
              onClick={() => onSection(entry.id)}
            >
              <Icon d={entry.icon} size={14} />
              {entry.label}
            </button>
          ))}
          <button type="button" className="dp-set__signout" onClick={onSignOut}>
            Sign out
          </button>
        </nav>

        <div className="dp-set__pane">{pane}</div>
      </div>

      <footer className="dp-set__foot">
        <span className="dp-set__saveline">Changes save as you edit</span>
        <span className="dp-set__spacer" />
        <Button variant="quiet" size="small" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" size="small" onClick={onClose}>
          Done
        </Button>
      </footer>
    </ModalScrim>
  );
}
