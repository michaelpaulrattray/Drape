/**
 * Application Router — slim index that combines all feature routers.
 *
 * Each feature router lives under server/routes/<feature>.ts
 * Admin sub-routers are further split under server/routes/admin/
 * The executeApprovedAdminAction helper lives in server/lib/adminActions.ts
 */
import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routes/auth";
import { creditsRouter, pointsRouter } from "./routes/credits";
import { waitlistRouter } from "./routes/waitlist";
import { newsletterRouter } from "./routes/newsletter";
import { modelsRouter } from "./routes/models";
import { profileRouter } from "./routes/profile";
import { registryRouter } from "./routes/registry";
import { generationRouter } from "./routes/generation";
import { billingRouter } from "./routes/billing";
import { usageRouter } from "./routes/usage";
import { adminRouter } from "./routes/admin";
import { moderatorRouter } from "./routes/moderator";
import { moderatorExportsRouter } from "./routes/moderatorExports";
import { moderatorAttachmentsRouter } from "./routes/moderatorAttachments";
import { moderatorReconciliationRouter } from "./routes/moderatorReconciliation";
import { referralRouter } from "./routes/referral";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  credits: creditsRouter,
  points: pointsRouter,
  waitlist: waitlistRouter,
  models: modelsRouter,
  generation: generationRouter,
  profile: profileRouter,
  registry: registryRouter,
  billing: billingRouter,
  usage: usageRouter,
  newsletter: newsletterRouter,
  admin: adminRouter,
  moderator: moderatorRouter,
  moderatorExports: moderatorExportsRouter,
  moderatorAttachments: moderatorAttachmentsRouter,
  moderatorReconciliation: moderatorReconciliationRouter,
  referral: referralRouter,
});

export type AppRouter = typeof appRouter;
