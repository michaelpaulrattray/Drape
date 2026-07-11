import { type ModelPreferences } from "@/features/casting/constants";
import { generateRandomPreferences as sharedRandomPreferences } from "@shared/castingOptions";

// ============ Utility Functions ============

// One randomizer, shared with the server's random-intent parser path (R2/D-14)
export const generateRandomPreferences = (): Partial<ModelPreferences> =>
  sharedRandomPreferences() as Partial<ModelPreferences>;
