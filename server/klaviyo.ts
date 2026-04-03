import { createModuleLogger } from "./logging/logger";
const log = createModuleLogger("klaviyo");

/**
 * Klaviyo Integration
 * 
 * Server-side helper for Klaviyo API operations including
 * profile creation and newsletter subscriptions.
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

export interface ProfileAttributes {
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  properties?: Record<string, unknown>;
}

export interface CreateProfileResponse {
  success: boolean;
  profileId?: string;
  error?: string;
  isNew?: boolean;
}

/**
 * Create or update a profile in Klaviyo
 * Uses the POST /api/profile-import endpoint which handles both create and update
 */
export async function createOrUpdateProfile(
  attributes: ProfileAttributes
): Promise<CreateProfileResponse> {
  try {
    const response = await fetch(`${KLAVIYO_API_URL}/profile-import`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: attributes.email,
            first_name: attributes.first_name,
            last_name: attributes.last_name,
            phone_number: attributes.phone_number,
            properties: attributes.properties || {},
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error({ err: response.status, errorData }, "[Klaviyo] API error:");
      return {
        success: false,
        error: `Klaviyo API error: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      profileId: data.data?.id,
      isNew: response.status === 201,
    };
  } catch (error) {
    log.error({ err: error }, "[Klaviyo] Request failed:");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
 * Track a custom event in Klaviyo (triggers Flows for transactional emails)
 */
export async function trackEvent(
  email: string,
  metricName: string,
  properties: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${KLAVIYO_API_URL}/events`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: {
              data: {
                type: "metric",
                attributes: { name: metricName },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: { email },
              },
            },
            properties,
            time: new Date().toISOString(),
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error({ err: response.status, errorData }, `[Klaviyo] trackEvent(${metricName}) error:`);
      return { success: false, error: `Klaviyo API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    log.error({ err: error }, `[Klaviyo] trackEvent(${metricName}) failed:`);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send a referral invite email via Klaviyo event (triggers a Flow)
 * Set up a Klaviyo Flow triggered by "Referral Invite Sent" metric
 */
export async function sendReferralInviteEmail(params: {
  inviteeEmail: string;
  referrerName: string;
  referralLink: string;
  rewardCredits: number;
}): Promise<{ success: boolean; error?: string }> {
  // Create/update the invitee profile first
  await createOrUpdateProfile({
    email: params.inviteeEmail,
    properties: {
      referral_invite_received: true,
      referred_by: params.referrerName,
    },
  });

  // Fire the event to trigger the Klaviyo Flow
  return trackEvent(params.inviteeEmail, "Referral Invite Sent", {
    referrer_name: params.referrerName,
    referral_link: params.referralLink,
    reward_credits: params.rewardCredits,
    invite_date: new Date().toISOString(),
  });
}

/**
 * Send account frozen notification email via Klaviyo event (triggers a Flow)
 * Set up a Klaviyo Flow triggered by "Account Frozen" metric.
 * Use the same email template styling as the referral invite flow for brand consistency.
 */
export async function sendAccountFrozenEmail(params: {
  userEmail: string;
  userName: string;
  freezeReason: string;
  frozenBy: string;
  supportUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Ensure the profile exists in Klaviyo with latest info
  await createOrUpdateProfile({
    email: params.userEmail,
    first_name: params.userName,
    properties: {
      account_frozen: true,
      last_freeze_date: new Date().toISOString(),
    },
  });

  // Fire the event to trigger the Klaviyo Flow
  return trackEvent(params.userEmail, "Account Frozen", {
    user_name: params.userName,
    freeze_reason: params.freezeReason,
    frozen_by: params.frozenBy,
    frozen_date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    support_url: params.supportUrl || "https://drape.ai/support",
    app_name: "Drape",
  });
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
