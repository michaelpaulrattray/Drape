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
      console.error("[Klaviyo] API error:", response.status, errorData);
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
    console.error("[Klaviyo] Request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Subscribe a profile to a specific list
 */
export async function subscribeToList(
  listId: string,
  email: string,
  source?: string
): Promise<CreateProfileResponse> {
  try {
    const response = await fetch(`${KLAVIYO_API_URL}/profile-subscription-bulk-create-jobs`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            profiles: {
              data: [
                {
                  type: "profile",
                  attributes: {
                    email: email,
                    subscriptions: {
                      email: {
                        marketing: {
                          consent: "SUBSCRIBED",
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
          relationships: {
            list: {
              data: {
                type: "list",
                id: listId,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Klaviyo] Subscribe error:", response.status, errorData);
      return {
        success: false,
        error: `Klaviyo API error: ${response.status}`,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Klaviyo] Subscribe request failed:", error);
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
  source: string = "website_footer"
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
      console.error("[Klaviyo] Newsletter signup error:", response.status, errorData);
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
    console.error("[Klaviyo] Newsletter signup failed:", error);
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
