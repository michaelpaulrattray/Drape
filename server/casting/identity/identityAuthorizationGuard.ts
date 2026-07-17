import { TRPCError } from "@trpc/server";
import type {
  AuthorizedIdentityPatch,
  GenerationAuthorization,
} from "./identityTypes";
import { REFUSAL_COPY } from "./refusalCopy";

/** Identity-class authorization without its typed patch is an invalid
 * internal state. It must refuse before audit creation, credits, or image
 * generation rather than silently falling through to the image-only door. */
export function requireIdentityPatch(
  authorization: GenerationAuthorization,
): AuthorizedIdentityPatch | undefined {
  if (authorization.class !== "identity") return undefined;
  if (authorization.identityPatch) return authorization.identityPatch;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: REFUSAL_COPY.identityAuthorizationUnavailable,
  });
}
