export const COOKIE_NAME = "app_session_id";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Public base URL for static app assets re-hosted on R2 (logos, swatches,
// textures). Override with VITE_ASSETS_BASE_URL (full URL including /assets)
// so production points at its own bucket — the CSP img-src only allows the
// bucket in R2_PUBLIC_URL, so a mismatched bucket gets blocked by the browser.
// Falls back to the dev bucket when unset.
const DEV_ASSETS_BASE_URL = 'https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev/assets';

export const ASSETS_BASE_URL =
  (typeof window === 'undefined'
    ? process.env.VITE_ASSETS_BASE_URL
    : import.meta.env.VITE_ASSETS_BASE_URL) || DEV_ASSETS_BASE_URL;
