export const COOKIE_NAME = "app_session_id";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Public base URL for static app assets re-hosted on R2 (logos, swatches,
// textures). Point at the production bucket / custom domain at cutover.
export const ASSETS_BASE_URL = 'https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev/assets';
