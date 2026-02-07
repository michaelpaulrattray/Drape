/**
 * Gemini Client - API client factory, safety settings, and shared utilities.
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ENV } from "../_core/env";

// ============================================================================
// CLIENT FACTORY
// ============================================================================

export const getAiClient = () => {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.");
  }
  return new GoogleGenAI({ apiKey });
};

// Explicitly disable safety filters to allow "raw" agency casting traits
export const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

// ============================================================================
// SHARED UTILITIES
// ============================================================================

export const extractMimeType = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:(.*?);base64,/);
  return match ? match[1] : 'image/jpeg';
};

export const formatGeminiError = (e: any): string => {
  const msg = e.message || e.toString();

  if (msg.includes('429')) return "Agency Quota Exceeded. The casting engine is momentarily overloaded. Please wait 10 seconds.";
  if (msg.includes('403') || msg.includes('API key')) return "Authentication Failed. Please verify your API Key billing status.";
  if (msg.includes('400')) return "Invalid Request. The casting parameters are contradictory or invalid.";
  if (msg.includes('500') || msg.includes('503')) return "Engine Offline. The servers are experiencing downtime.";
  if (msg.includes('SAFETY') || msg.includes('blocked')) return "Safety Protocols Triggered. The request was flagged by global filters.";

  return msg;
};
