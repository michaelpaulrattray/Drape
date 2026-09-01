/**
 * Profile feature barrel.
 *
 * The five tab components (`ProfileTab`, `BillingTab`, `UsageTab`,
 * `NotificationsTab`, `SecurityTab`) were deleted with section 03 — their only
 * consumer was `ProfileSettingsModal`, which the brief replaces, and leaving
 * them exported would have left five dead surfaces one import away from being
 * revived beside the one that replaced them. Their sections now live in
 * `features/settings/sections/`.
 */
export { ProfileAvatar } from "./ProfileVisual";
