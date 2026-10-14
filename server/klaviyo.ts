import { createModuleLogger } from "./logging/logger";
const log = createModuleLogger("klaviyo");

/**
 * Klaviyo Integration
 * 
 * Server-side helper for Klaviyo's marketing list: the waitlist and newsletter
 * profile sync, and nothing else.
 *
 * ⚠ **NO EMAIL A CUSTOMER WAITS FOR GOES THROUGH HERE ANY MORE — #2481,
 * his ruling 2026-10-14.** The referral invite and the account-frozen notice
 * were Klaviyo events (a `trackEvent` that fired a Flow), production never had
 * `KLAVIYO_PRIVATE_KEY`, so neither had ever been delivered, while the screens
 * said they had. Both now send through `server/mail.ts` (Resend) with their
 * words in the bundle. The two Klaviyo templates prescribed for them
 * (`server/scripts/setupKlaviyoReferralFlow.mjs`,
 * `docs/klaviyo-account-frozen-flow-setup.md`) are no longer reached by any
 * code and still carry the retired FormaStudio brand.
 */

const KLAVIYO_API_URL = "https://a.klaviyo.com/api";
const KLAVIYO_API_VERSION = "2024-10-15";

/**
 * Get Klaviyo private API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
  if (!apiKey) {
    throw new Error("KLAVIYO_PRIVATE_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Common headers for Klaviyo API requests
 */
function getHeaders(): Record<string, string> {
  return {
    "Authorization": `Klaviyo-API-Key ${getApiKey()}`,
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/vnd.api+json",
    "revision": KLAVIYO_API_VERSION,
  };
}

export interface CreateProfileResponse {
  success: boolean;
  profileId?: string;
  error?: string;
  isNew?: boolean;
}

/**
 * Simple newsletter signup - creates/updates profile with email subscription consent
 * This is the recommended approach for newsletter signups
 */
export async function newsletterSignup(
  email: string,
  source: string = "website_footer",
  firstName?: string
): Promise<CreateProfileResponse> {
  try {
    // Use the profiles endpoint with subscription data
    const response = await fetch(`${KLAVIYO_API_URL}/profiles`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: email,
            ...(firstName ? { first_name: firstName } : {}),
            properties: {
              signup_source: source,
              signup_date: new Date().toISOString(),
            },
          },
        },
      }),
    });

    // 201 = new profile created, 409 = profile already exists (which is fine)
    if (response.status === 201) {
      const data = await response.json();
      return {
        success: true,
        profileId: data.data?.id,
        isNew: true,
      };
    } else if (response.status === 409) {
      // Profile already exists - this is fine for newsletter signup
      return {
        success: true,
        isNew: false,
      };
    } else if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error({ err: response.status, errorData }, "[Klaviyo] Newsletter signup error:");
      return {
        success: false,
        error: `Klaviyo API error: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      profileId: data.data?.id,
    };
  } catch (error) {
    log.error({ err: error }, "[Klaviyo] Newsletter signup failed:");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test the Klaviyo API connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${KLAVIYO_API_URL}/lists`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API returned status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
