/**
 * Vars the server cannot run without. Each entry explains what breaks when
 * it is missing, because several of these fail silently at request time
 * rather than at boot (e.g. an empty VITE_APP_ID makes verifySession reject
 * every login with no error surfaced to the user).
 */
const REQUIRED_VARS: Record<string, string> = {
  DATABASE_URL: "all database access",
  JWT_SECRET: "session cookies cannot be signed or verified",
  VITE_APP_ID:
    "session JWTs are issued with an empty appId and verifySession silently rejects every login",
  GEMINI_API_KEY: "all image generation",
  STRIPE_SECRET_KEY: "billing",
  STRIPE_WEBHOOK_SECRET: "Stripe webhook signature verification",
  R2_ENDPOINT: "file storage (generated images, garments, avatars)",
  R2_BUCKET: "file storage (generated images, garments, avatars)",
  R2_PUBLIC_URL: "served image URLs cannot be built",
  R2_ACCESS_KEY_ID: "file storage uploads/deletes",
  R2_SECRET_ACCESS_KEY: "file storage uploads/deletes",
};

/** Optional vars that degrade a feature when absent — warn, don't exit. */
const OPTIONAL_VARS: Record<string, string> = {
  RESEND_API_KEY: "signup verification emails cannot be sent",
  GOOGLE_CLIENT_ID: "Google OAuth login is unavailable",
  GOOGLE_CLIENT_SECRET: "Google OAuth login is unavailable",
  VITE_STRIPE_PUBLISHABLE_KEY: "client-side Stripe checkout is unavailable",
};

/**
 * Fail loudly at boot if a required env var is missing.
 * Called from server/_core/index.ts before anything else starts.
 */
export function validateEnv(): void {
  const missing = Object.entries(REQUIRED_VARS).filter(
    ([key]) => !process.env[key]
  );

  if (missing.length > 0) {
    const details = missing
      .map(([key, consequence]) => `  - ${key}: ${consequence}`)
      .join("\n");
    throw new Error(
      `Missing required environment variable(s):\n${details}\n` +
        `Set them in .env at the repo root (see CLAUDE.md for the full list).`
    );
  }

  for (const [key, consequence] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      console.warn(`[Env] ${key} is not set — ${consequence}`);
    }
  }
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Cloudflare R2 storage (S3-compatible)
  r2Endpoint: process.env.R2_ENDPOINT ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "",
  r2PublicUrl: process.env.R2_PUBLIC_URL ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Stripe configuration
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
};
