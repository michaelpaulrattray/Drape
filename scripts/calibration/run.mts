/**
 * The paid half of the M3 calibration harness (plan §K M3, §E.1, §H.9).
 *
 * Separated from the planner so the cost arithmetic can be read, reviewed and
 * dry-run without any of the machinery that spends money being loaded.
 *
 * TRANSPORT (founder decision, 2026-07-30): images run through fal. That was
 * §H.9's documented contingency — "a single-transport variant exists if
 * OpenRouter disappoints" — promoted to primary because fal billing is the one
 * we can reliably top up. OpenRouter stays as the text transport (the Claude
 * interpreter and the Kimi treatment stage) and as the image fallback. The
 * adapter boundary is what makes that a config change rather than a redesign.
 */
import fs from "node:fs";
import path from "node:path";

import { createFalCreativeEngine } from "../../server/providers/falImages";
import { createFalIdentityEngine } from "../../server/providers/falQueue";
import { readFalBalanceUsd } from "../../server/providers/falTransport";
import { createOpenRouterCreativeEngine } from "../../server/providers/openrouterImages";
import { ProviderQueue } from "../../server/providers/providerQueue";
import { ProviderError, type CreativeEngine } from "../../server/providers/types";

export type CallRecord = {
  id: string;
  phase: string;
  status: "ok" | "failed";
  provider: string;
  model?: string;
  providerRef?: string;
  latencyMs?: number;
  bytes?: number;
  file?: string;
  failureClass?: string;
  error?: string;
  /** Wall-clock at dispatch, so throughput can be derived honestly. */
  dispatchedAt: number;
};

export type Manifest = {
  startedAt: string;
  transport: { images: string; text: string };
  balanceBeforeUsd: number | null;
  balanceAfterUsd: number | null;
  calls: Record<string, CallRecord>;
};

export function loadManifest(file: string): Manifest | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
}

export function saveManifest(file: string, manifest: Manifest): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/**
 * Guards the run. Cost is counted at DISPATCH because a submitted request is
 * spend — fal can cancel a queued one, but we must not rely on winning that
 * race. Crossing the ceiling stops the run rather than finishing the plan.
 */
export class SpendGuard {
  private dispatchedUsd = 0;

  constructor(
    private readonly ceilingUsd: number,
    private readonly onAbort: () => void,
  ) {}

  reserve(costUsd: number, label: string): void {
    if (this.dispatchedUsd + costUsd > this.ceilingUsd) {
      this.onAbort();
      throw new Error(
        `Spend ceiling reached before "${label}": ` +
          `$${this.dispatchedUsd.toFixed(2)} dispatched, $${costUsd.toFixed(2)} next, ` +
          `ceiling $${this.ceilingUsd.toFixed(2)}. Run stopped.`,
      );
    }
    this.dispatchedUsd += costUsd;
  }

  get spent(): number {
    return this.dispatchedUsd;
  }
}

export type Engines = {
  creative: CreativeEngine;
  identity: ReturnType<typeof createFalIdentityEngine>;
  imagesTransport: "fal" | "openrouter";
};

export function buildEngines(options: {
  falKey: string;
  openrouterKey?: string;
  imagesVia: "fal" | "openrouter";
  concurrency: number;
}): Engines {
  const queue = new ProviderQueue({
    name: `${options.imagesVia}-images`,
    concurrency: options.concurrency,
    maxQueueDepth: 256,
  });

  const creative =
    options.imagesVia === "fal"
      ? createFalCreativeEngine({ apiKey: options.falKey, queue })
      : createOpenRouterCreativeEngine({ apiKey: options.openrouterKey!, queue });

  return {
    creative,
    identity: createFalIdentityEngine({
      apiKey: options.falKey,
      queue: new ProviderQueue({ name: "fal-identity", concurrency: 4, maxQueueDepth: 64 }),
    }),
    imagesTransport: options.imagesVia,
  };
}

export function describeFailure(error: unknown): { failureClass: string; message: string } {
  if (error instanceof ProviderError) {
    return { failureClass: error.failureClass, message: error.message };
  }
  return { failureClass: "unknown", message: error instanceof Error ? error.message : String(error) };
}

export { readFalBalanceUsd };
