/**
 * Settings → Notifications (brief §5).
 *
 * ## ⚠ EVERY TOGGLE HERE IS INERT, AND THAT IS THE HONEST BUILD
 *
 * BRIEF-RECONCILIATION Q3, measured: there is **no notification-preference
 * store anywhere in the product** — no table in `drizzle/schema.ts`, no
 * procedure on any router, no reader. A toggle that flips and forgets on reload
 * is worse than one that never claimed to remember, and it is exactly the
 * *"control that looks functional and does nothing"* his placeholder law names.
 *
 * So the section is drawn in full, with the brief's copy and its defaults —
 * **including `Product news` defaulting OFF**, which is the one line in this
 * section doing real work: *"Opting people into marketing by default is the
 * kind of small dishonesty that costs more trust than the emails are worth."*
 * The defaults matter now rather than later, because when the store is built it
 * will be built to match what this page has been promising.
 */
import { SettingsGroup, SettingsRow, SettingsToggle, StubNote } from "../parts";

const NOT_BUILT = "Notification settings are not built yet";

const ROWS: { label: string; note: string; on: boolean }[] = [
  { label: "Render finished", note: "When a generation completes or fails", on: true },
  {
    label: "Comments and approvals",
    note: "When someone reacts to a frame you made",
    on: true,
  },
  {
    label: "Someone joins a project",
    note: "New members added to projects you are in",
    on: false,
  },
  { label: "Credits running low", note: "At 20% and again at 5% remaining", on: true },
  { label: "Product news", note: "New models and features, roughly monthly", on: false },
];

export function NotificationsSection() {
  return (
    <SettingsGroup
      title="Notifications"
      note={
        <>
          Nothing here is switched on yet — the studio has no place to remember these
          choices. <StubNote>NOT BUILT YET</StubNote>
        </>
      }
    >
      {ROWS.map((row) => (
        <SettingsRow key={row.label} label={row.label} note={row.note}>
          <SettingsToggle on={row.on} reason={NOT_BUILT} />
        </SettingsRow>
      ))}
    </SettingsGroup>
  );
}
