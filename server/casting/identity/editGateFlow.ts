import { TRPCError } from "@trpc/server";
import type { AuthorizedIdentityPatch } from "./identityTypes";
import { verifyIdentityEdit, type IdentityGateVerdict } from "./editGate";
import { REFUSAL_COPY } from "./refusalCopy";
import type { RawGenerationResult, UploadedGenerationResult } from "../aiService";

export interface GatedIdentityGenerationInput {
  sourceImage: string;
  patch: AuthorizedIdentityPatch;
  frame: "HEADSHOT" | "FULL_BODY";
  modelName: string | null;
  generate: (attempt: 1 | 2) => Promise<RawGenerationResult>;
  resetRejectedSession: () => void;
  upload: (candidate: RawGenerationResult) => Promise<UploadedGenerationResult>;
  verify?: typeof verifyIdentityEdit;
  onVerdict?: (attempt: 1 | 2, verdict: IdentityGateVerdict) => void;
}

export interface GatedIdentityGenerationResult extends UploadedGenerationResult {
  engineUsed?: string;
  attempts: number;
  verdicts: IdentityGateVerdict[];
}

async function checkedVerdict(
  verify: typeof verifyIdentityEdit,
  input: Pick<GatedIdentityGenerationInput, "sourceImage" | "patch" | "frame">,
  candidate: RawGenerationResult,
): Promise<IdentityGateVerdict> {
  const callVerifier = async (): Promise<IdentityGateVerdict> => {
    try {
      return await verify({
        sourceImage: input.sourceImage,
        candidateImage: candidate.imageBase64,
        patch: input.patch,
        frame: input.frame,
      });
    } catch {
      return { ok: false, checked: false, violations: [] };
    }
  };
  const first = await callVerifier();
  if (first.checked) return first;
  return callVerifier();
}

/** Generate in memory, fail closed, and persist only a passing candidate. */
export async function runGatedIdentityGeneration(
  input: GatedIdentityGenerationInput,
): Promise<GatedIdentityGenerationResult> {
  const verify = input.verify ?? verifyIdentityEdit;
  const verdicts: IdentityGateVerdict[] = [];

  const firstCandidate = await input.generate(1);
  const firstVerdict = process.env.IDENTITY_GATE_FORCE_FAIL_FIRST === "1"
    ? { ok: false, checked: true, violations: ["overall.facialIdentity" as const] }
    : await checkedVerdict(verify, input, firstCandidate);
  verdicts.push(firstVerdict);
  input.onVerdict?.(1, firstVerdict);
  if (firstVerdict.checked && firstVerdict.ok) {
    try {
      const uploaded = await input.upload(firstCandidate);
      return { ...uploaded, engineUsed: firstCandidate.engineUsed, attempts: 1, verdicts };
    } catch (error) {
      input.resetRejectedSession();
      throw error;
    }
  }
  if (!firstVerdict.checked) {
    input.resetRejectedSession();
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFUSAL_COPY.identityVerificationUnavailable,
    });
  }

  input.resetRejectedSession();
  const secondCandidate = await input.generate(2);
  const secondVerdict = await checkedVerdict(verify, input, secondCandidate);
  verdicts.push(secondVerdict);
  input.onVerdict?.(2, secondVerdict);
  if (secondVerdict.checked && secondVerdict.ok) {
    try {
      const uploaded = await input.upload(secondCandidate);
      return { ...uploaded, engineUsed: secondCandidate.engineUsed, attempts: 2, verdicts };
    } catch (error) {
      input.resetRejectedSession();
      throw error;
    }
  }

  // A rejected retry must not seed the next request's chat context.
  input.resetRejectedSession();
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: secondVerdict.checked
      ? REFUSAL_COPY.identityDrift(input.modelName)
      : REFUSAL_COPY.identityVerificationUnavailable,
  });
}
