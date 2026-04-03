export { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

/**
 * Returns the login page URL.
 * Previously pointed to Manus OAuth portal; now uses local login page.
 */
export const getLoginUrl = () => "/login";
