/**
 * VTO Generation — Service 2: Multi-Garment Virtual Try-On
 *
 * Takes a model image + array of garments and generates a photorealistic
 * dressed result. Supports layering, full-look overrides, tattoo preservation,
 * and incremental compositing (swap one garment without regenerating all).
 *
 * Gemini model: gemini-3-pro-image-preview (image generation)
 * Queue lane: IMAGE (heavy, ~30-60s)
 * Credit cost: 5 points (full VTO), 3 points (incremental)
 */
import {
  getAiClient,
  SAFETY_SETTINGS,
  withImageQueue,
  toInlinePart,
  diagnoseResponse,
  uploadBase64ToS3,
  sanitizeDescription,
  sortByLayerPriority,
  getImageAspectBucket,
  type GarmentForVTO,
} from "./utils";
import { createModuleLogger } from "../logging/logger";
import type { TattooMap } from "./tattooAnalysis";

export type { TattooMap };

const log = createModuleLogger("wardrobe/vtoGeneration");

// ── Narrative Builder ──────────────────────────────────────────────────────

function buildGarmentNarrative(
  sortedGarments: GarmentForVTO[],
  fullLookOverridden: boolean,
  fullLookRemainingZones: string[],
  individualSlots: Set<string>,
): { narrative: string; imageMap: string } {
  let imageCounter = 2;
  const garmentSentences: string[] = [];
  const imageNotes: string[] = [];

  for (const g of sortedGarments) {
    const label =
      g.description && !g.description.startsWith("Analyzing")
        ? sanitizeDescription(g.description)
        : g.type;
    const style = g.styleNote ? ` Styling: ${g.styleNote}.` : "";

    // FULL LOOK — no overrides
    if (g.type === "full_look" && !fullLookOverridden) {
      imageNotes.push(`Image ${imageCounter}: Complete outfit reference photo`);
      garmentSentences.push(
        `Dress the model in the complete outfit shown in Image ${imageCounter}. ` +
          `Reproduce every garment from this image onto the model — matching the exact fabric ` +
          `texture, weight, construction details (buttons, lapels, zippers, seams, hardware), ` +
          `and how each piece is worn on the body (open, closed, draped, tucked). ` +
          `The garments must look like the same physical items, not simplified versions.${style}`,
      );
      imageCounter++;
      continue;
    }

    // FULL LOOK — with overrides (remaining zones)
    if (g.type === "full_look" && fullLookOverridden) {
      const zones = fullLookRemainingZones
        .map((s) => s.toUpperCase())
        .join(" and ");
      imageNotes.push(`Image ${imageCounter}: Outfit reference for ${zones}`);
      garmentSentences.push(
        `For ${zones}: use Image ${imageCounter} from the outfit reference.${style}`,
      );
      imageCounter++;
      continue;
    }

    // Override of full look
    if (fullLookOverridden && g.type !== "full_look") {
      imageNotes.push(
        `Image ${imageCounter}: ${label} (replaces ${g.type} from outfit)`,
      );
      garmentSentences.push(
        `Replace the ${g.type} with the ${label} shown in Image ${imageCounter}.${style}`,
      );
      imageCounter++;
      continue;
    }

    // Standard garment — check for layering
    const sameCategory = sortedGarments.filter((sg) => sg.type === g.type);
    let layerNote = "";
    if (sameCategory.length > 1) {
      const idx = sameCategory.indexOf(g);
      if (idx === 0) {
        layerNote =
          " as the inner layer (worn closest to the body, partially visible under outer layers)";
      } else if (idx === sameCategory.length - 1) {
        const innerLabels = sameCategory
          .slice(0, -1)
          .map((sg) =>
            sg.description && !sg.description.startsWith("Analyzing")
              ? sanitizeDescription(sg.description)
              : sg.type,
          )
          .join(" and ");
        layerNote = ` as the outer layer (worn OVER the ${innerLabels})`;
      } else {
        layerNote = " as a middle layer";
      }
    }

    imageNotes.push(`Image ${imageCounter}: ${label}`);
    garmentSentences.push(
      `Apply the ${label} from Image ${imageCounter}${layerNote}.${style}`,
    );
    imageCounter++;
  }

  // Preserved slots
  const activeSlotSet = new Set(sortedGarments.map((g) => g.type));
  const implicitlyCovered = activeSlotSet.has("full_look")
    ? new Set(["tops", "bottoms", "shoes", "accessories"])
    : new Set<string>();
  const preserved = (["tops", "bottoms", "shoes", "accessories"] as const).filter(
    (s) => !activeSlotSet.has(s) && !implicitlyCovered.has(s),
  );

  if (preserved.length > 0) {
    garmentSentences.push(
      `Keep the model's existing ${preserved.join(", ")} exactly as shown in Image 1.`,
    );
  }

  // Stacking note
  const slotCounts: Record<string, number> = {};
  sortedGarments.forEach((g) => {
    slotCounts[g.type] = (slotCounts[g.type] || 0) + 1;
  });
  if (Object.values(slotCounts).some((c) => c > 1)) {
    garmentSentences.push(
      `Where layers overlap, the inner layer should only peek through at ` +
        `necklines, hems, cuffs, and openings — not sit on top of the outer layer.`,
    );
  }

  return {
    narrative: garmentSentences.join(" "),
    imageMap: imageNotes.map((n) => `- ${n}`).join("\n"),
  };
}

// ── Full VTO Generation ────────────────────────────────────────────────────

export interface VTOParams {
  modelImageUrl: string;
  garments: GarmentForVTO[];
  tattooMap?: TattooMap;
  userId: string;
  sessionId: string;
}

export interface VTOResult {
  resultUrl: string; // S3 URL of the dressed result
}

/**
 * Generate a full virtual try-on result — dress the model in all provided garments.
 */
export async function generateVirtualTryOn(
  params: VTOParams,
): Promise<VTOResult> {
  return withImageQueue(async () => {
    const ai = getAiClient();

    const sortedGarments = sortByLayerPriority(params.garments);
    const modelPart = await toInlinePart(params.modelImageUrl);

    // Detect full_look override scenario
    const hasFullLook = sortedGarments.some((g) => g.type === "full_look");
    const individualSlots = new Set(
      sortedGarments.filter((g) => g.type !== "full_look").map((g) => g.type),
    );
    const fullLookOverridden = hasFullLook && individualSlots.size > 0;
    const fullLookRemainingZones = fullLookOverridden
      ? (["tops", "bottoms", "shoes", "accessories"] as const).filter(
          (s) => !individualSlots.has(s),
        )
      : [];

    // Build garment image parts
    const garmentParts = await Promise.all(
      sortedGarments.map(async (g) => {
        // Accessories: prefer flat-lay (isolated) over crop
        if (g.type === "accessories" && g.isolatedPreviewUrl) {
          return toInlinePart(g.isolatedPreviewUrl);
        }
        // Standard: original crop → source image → flat-lay
        if (g.imageUrl) return toInlinePart(g.imageUrl);
        if (g.sourceImageUrl) return toInlinePart(g.sourceImageUrl);
        if (g.isolatedPreviewUrl) return toInlinePart(g.isolatedPreviewUrl);
        throw new Error(`Garment ${g.id} has no image source`);
      }),
    );

    // Build narrative prompt
    const { narrative, imageMap } = buildGarmentNarrative(
      sortedGarments,
      fullLookOverridden,
      fullLookRemainingZones as string[],
      individualSlots,
    );

    const garmentNarrative = `Image reference guide:\n${imageMap}\n\n${narrative}`;

    const tattooInstruction = params.tattooMap
      ? params.tattooMap.promptFragment
      : `For tattoos and skin markings: reproduce them exactly where they appear in Image 1, and nowhere else. When in doubt, show clean skin matching the model's natural tone — never invent tattoos.`;

    const prompt = `You are a virtual try-on system creating photorealistic fashion images.

Image 1 is the model. This person's face, body, skin, tattoos, pose, and background are sacred — reproduce them exactly. Do not alter, regenerate, or reinterpret anything about this person. Think of Image 1 as a locked layer that you are dressing.

${garmentNarrative}

CRITICAL: Every garment listed above MUST be visible in the output. Do not omit any garment. If multiple garments share the same body zone, layer them — inner beneath outer. Never choose one garment over another.

Reproduce each garment as if it is the exact same physical item from the reference — same fabric weight and drape, same construction (buttons, zippers, lapels, pockets, seams), same color and pattern. A heavy wool coat must look heavy, not thin. A structured blazer must have structure, not hang flat. Do not simplify garments.

${tattooInstruction}

Where garments meet, apply realistic physics. Pant hems drape over footwear. Tucked shirts bunch naturally at the waistband. Jackets drape over what's beneath them. No floating gaps between garment zones.

If any garment reference image contains a person or other clothing items, extract ONLY the target garment described in the instructions above. Ignore all other items in the reference photo.

Frame the output as a full-body shot from head to toe with a slight margin above the head and below the feet. Do not crop the head or feet. Match the framing and camera distance of Image 1.

Return the composite image.`;

    const contents = [{ text: prompt }, modelPart, ...garmentParts];

    const aspectRatio = await getImageAspectBucket(params.modelImageUrl);
    const chat = ai.chats.create({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const response = await chat.sendMessage({ message: contents });
    const diagnosis = diagnoseResponse(response);

    if (!diagnosis.imageBase64) {
      if (diagnosis.isSafetyBlock) {
        throw new Error(
          `SAFETY_BLOCK:${diagnosis.finishReason || diagnosis.blockReason || "unknown"}`,
        );
      }
      throw new Error(
        `VTO Generation failed. Reason: ${diagnosis.finishReason || "no image returned"}`,
      );
    }

    const resultUrl = await uploadBase64ToS3(
      diagnosis.imageBase64,
      `wardrobe/${params.userId}/vto-results`,
    );

    log.info(
      `VTO generated for session ${params.sessionId} with ${sortedGarments.length} garments`,
    );
    return { resultUrl };
  }, "vto-generation");
}

// ── Incremental Composite ──────────────────────────────────────────────────

export interface IncrementalParams {
  previousResultUrl: string;
  modelImageUrl: string;
  changedGarments: GarmentForVTO[];
  changedSlots: string[];
  allGarments: GarmentForVTO[];
  tattooMap?: TattooMap;
  isStyleRefresh?: boolean;
  userId: string;
  sessionId: string;
}

/**
 * Incrementally update a VTO result — swap specific garments or apply
 * styling changes without regenerating the entire outfit.
 */
export async function incrementalComposite(
  params: IncrementalParams,
): Promise<VTOResult> {
  return withImageQueue(async () => {
    const ai = getAiClient();

    const prevResultPart = await toInlinePart(params.previousResultUrl);
    const modelPart = await toInlinePart(params.modelImageUrl);

    const tattooFragment = params.tattooMap
      ? params.tattooMap.promptFragment
      : "";

    // Style refresh — only change HOW garments are worn, not which garments
    if (params.isStyleRefresh) {
      const prompt = `You are applying STYLING ADJUSTMENTS to a virtual try-on result.

Image 1: The original model (reference for identity/pose).
Image 2: The CURRENT result — keep this as the base.

TASK: Apply ONLY these styling changes to the garments in Image 2. Do NOT change which garments are worn. Do NOT replace any garment. Only adjust HOW they are worn.

STYLING CHANGES:
${params.changedGarments.map((g) => `- ${g.shortName || g.type}: ${g.styleNote}`).join("\n")}

RULES:
- Keep the model's identity, pose, and background exactly as in Image 1.
- Keep ALL garments exactly as they appear in Image 2.
- ONLY modify the physical styling (tucking, rolling, unbuttoning, cuffing, etc) as described above.
- If a style note says "Tuck in", show the garment tucked into the waistband.
- If a style note says "Roll sleeves", show the sleeves rolled up.
- Do not alter fabric, color, fit, or garment identity — only the physical arrangement.
${tattooFragment}

Return the updated image with styling changes applied.`;

      const aspectRatio = await getImageAspectBucket(params.modelImageUrl);
      const chat = ai.chats.create({
        model: "gemini-3-pro-image-preview",
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const response = await chat.sendMessage({
        message: [{ text: prompt }, modelPart, prevResultPart],
      });
      const diagnosis = diagnoseResponse(response);

      if (!diagnosis.imageBase64) {
        if (diagnosis.isSafetyBlock) {
          throw new Error(
            `SAFETY_BLOCK:${diagnosis.finishReason || diagnosis.blockReason || "unknown"}`,
          );
        }
        throw new Error(
          `Style refresh failed. Reason: ${diagnosis.finishReason || "no image returned"}`,
        );
      }

      const resultUrl = await uploadBase64ToS3(
        diagnosis.imageBase64,
        `wardrobe/${params.userId}/vto-results`,
      );
      return { resultUrl };
    }

    // Garment swap — replace specific slots
    const changedGarmentParts = await Promise.all(
      params.changedGarments.map(async (g) => {
        let part;
        if (g.imageUrl) part = await toInlinePart(g.imageUrl);
        else if (g.sourceImageUrl) part = await toInlinePart(g.sourceImageUrl);
        else if (g.isolatedPreviewUrl)
          part = await toInlinePart(g.isolatedPreviewUrl);
        if (!part) throw new Error(`Garment ${g.id} missing image data`);
        return { garment: g, part };
      }),
    );

    const changeList = params.changedSlots.join(", ");
    const contextList = params.allGarments
      .map((g) => sanitizeDescription(g.description || g.type))
      .join(", ");

    const prompt = `You are updating a virtual try-on session.

Image 1: The original model (reference for identity/pose).
Image 2: The PREVIOUS result (reference for the outfit state).
Images 3+: The NEW garments to swap in.

TASK: Update the outfit in Image 2 by replacing the ${changeList} with the new provided garments.
Keep all other garments (not in ${changeList}) exactly as they appear in Image 2.
Keep the model's identity, pose, and background exactly as in Image 1.

NEW GARMENTS to apply:
${changedGarmentParts.map((d, i) => `Image ${3 + i}: ${sanitizeDescription(d.garment.description || d.garment.type)} (${d.garment.type})`).join("\n")}

CONTEXT (Full Outfit):
The final look should consist of: ${contextList}.

${tattooFragment}

Merge the new garments realistically with the existing outfit in Image 2. Handle layering correctly. Return the updated image.`;

    const contents = [
      { text: prompt },
      modelPart,
      prevResultPart,
      ...changedGarmentParts.map((d) => d.part),
    ];

    const aspectRatio = await getImageAspectBucket(params.modelImageUrl);
    const chat = ai.chats.create({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const response = await chat.sendMessage({ message: contents });
    const diagnosis = diagnoseResponse(response);

    if (!diagnosis.imageBase64) {
      if (diagnosis.isSafetyBlock) {
        throw new Error(
          `SAFETY_BLOCK:${diagnosis.finishReason || diagnosis.blockReason || "unknown"}`,
        );
      }
      throw new Error(
        `Incremental composite failed. Reason: ${diagnosis.finishReason || "no image returned"}`,
      );
    }

    const resultUrl = await uploadBase64ToS3(
      diagnosis.imageBase64,
      `wardrobe/${params.userId}/vto-results`,
    );

    log.info(
      `Incremental composite for session ${params.sessionId}, changed: ${changeList}`,
    );
    return { resultUrl };
  }, "vto-incremental");
}
