/**
 * The paid calibration run (plan §K M3).
 *
 * Phased on purpose. The NBP likeness gate runs first because it is the actual
 * decision; if it fails, nothing after it matters and the run stops with the
 * evidence already on disk.
 *
 * Every result is written to the manifest the moment it lands, so a crash or a
 * ceiling abort never re-spends on resume.
 */
import fs from "node:fs";
import path from "node:path";

import {
  buildEngines,
  describeFailure,
  loadManifest,
  readFalBalanceUsd,
  saveManifest,
  SpendGuard,
  type CallRecord,
  type Manifest,
} from "./run.mts";

type PlannedCall = {
  phase: string;
  id: string;
  provider: string;
  description: string;
  costUsd: number;
};

type Options = {
  plan: PlannedCall[];
  outDir: string;
  ceilingUsd: number;
  imagesVia: "fal" | "openrouter";
  concurrency: number;
  briefs: ReadonlyArray<{ id: string; cohort: string; text: string }>;
  canonicalViews: readonly string[];
  revisions: readonly string[];
  sheetSize: `${number}x${number}`;
  sheetQuality: "low" | "medium" | "high";
  candidatesPerRoll: number;
};

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/**
 * Pinned per §E — the interpreter id is recorded per roll, so it is pinned here.
 *
 * §E.1 names Kimi K3 for the treatment stage and lists "is K3 actually servable
 * on OpenRouter?" as an M3 verification item, with permission to substitute an
 * inexpensive alternative if not. Verified 2026-07-30: `moonshotai/kimi-k3` is
 * listed and served, so the A/B runs the model the plan specifies rather than a
 * stand-in.
 */
const INTERPRETER_MODEL = "anthropic/claude-sonnet-5";
const TREATMENT_MODEL = "moonshotai/kimi-k3";

/**
 * The normalized framing block. §E.1 is explicit that the deterministic adapter
 * owns framing, camera, crop and neutral wardrobe — the treatment stage may
 * vary character-side dimensions only. Both A/B paths share this verbatim, or
 * the comparison would be measuring framing drift instead of diversity.
 */
const FRAMING = [
  "Studio casting frame: single subject, centred, waist-up, shot on a neutral mid-grey seamless backdrop.",
  "Even soft key light, no coloured gels, no props, no text, no logos.",
  "Neutral plain clothing appropriate to the character. Natural expression, eyes to camera.",
  "Photographic realism unless the brief specifies another visual style.",
].join(" ");

async function callOpenRouterText(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<{ text: string; servedModel?: string }> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!response.ok) {
    throw new Error(`${model} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  return { text: payload.choices?.[0]?.message?.content ?? "", servedModel: payload.model };
}

export async function execute(options: Options): Promise<void> {
  const falKey = process.env.FAL_KEY!;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  fs.mkdirSync(path.join(options.outDir, "images"), { recursive: true });
  const manifestFile = path.join(options.outDir, "manifest.json");

  const balanceBefore = await readFalBalanceUsd(falKey);
  const manifest: Manifest = loadManifest(manifestFile) ?? {
    startedAt: new Date().toISOString(),
    transport: { images: options.imagesVia, text: "openrouter" },
    balanceBeforeUsd: balanceBefore,
    balanceAfterUsd: null,
    calls: {},
  };
  const done = Object.keys(manifest.calls).length;
  if (done > 0) console.log(`[calibration] resuming — ${done} call(s) already recorded\n`);

  const engines = buildEngines({
    falKey,
    openrouterKey,
    imagesVia: options.imagesVia,
    concurrency: options.concurrency,
  });

  let aborted = false;
  const guard = new SpendGuard(options.ceilingUsd, () => {
    aborted = true;
  });
  // Anything already recorded was already paid for; count it so a resumed run
  // cannot quietly spend the ceiling a second time.
  for (const record of Object.values(manifest.calls)) {
    const planned = options.plan.find((call) => call.id === record.id);
    if (planned) guard.reserve(planned.costUsd, `resumed:${record.id}`);
  }

  const record = (entry: CallRecord) => {
    manifest.calls[entry.id] = entry;
    saveManifest(manifestFile, manifest);
  };

  async function runImage(
    call: PlannedCall,
    produce: () => Promise<{ bytes: Buffer; latencyMs: number; provenance: { model: string; providerRef?: string } }>,
  ): Promise<Buffer | null> {
    if (manifest.calls[call.id]?.status === "ok") {
      const existing = manifest.calls[call.id];
      return existing.file ? fs.readFileSync(path.join(options.outDir, existing.file)) : null;
    }
    guard.reserve(call.costUsd, call.id);
    const dispatchedAt = Date.now();
    try {
      const result = await produce();
      const file = path.join("images", `${call.id.replace(/[:/]/g, "_")}.png`);
      fs.writeFileSync(path.join(options.outDir, file), result.bytes);
      record({
        id: call.id,
        phase: call.phase,
        status: "ok",
        provider: call.provider,
        model: result.provenance.model,
        providerRef: result.provenance.providerRef,
        latencyMs: result.latencyMs,
        bytes: result.bytes.length,
        file,
        dispatchedAt,
      });
      console.log(`  ok   ${call.id.padEnd(28)} ${String(result.latencyMs).padStart(6)}ms`);
      return result.bytes;
    } catch (error) {
      const { failureClass, message } = describeFailure(error);
      record({
        id: call.id,
        phase: call.phase,
        status: "failed",
        provider: call.provider,
        failureClass,
        error: message,
        dispatchedAt,
      });
      console.log(`  FAIL ${call.id.padEnd(28)} ${failureClass}: ${message.slice(0, 80)}`);
      return null;
    }
  }

  const find = (id: string) => options.plan.find((call) => call.id === id);

  /* ------------------------------------------------------- phase: nbp gate */

  const anchorCall = find("anchor");
  if (anchorCall && !aborted) {
    console.log("\n[phase nbp] the go/no-go: can the identity engine hold a signed face?\n");
    const anchorBrief = options.briefs[0];
    const anchorBytes = await runImage(anchorCall, () =>
      engines.creative.generateCandidate({
        prompt: `${anchorBrief.text}. ${FRAMING}`,
        size: options.sheetSize,
        quality: options.sheetQuality,
      }),
    );

    if (anchorBytes) {
      const anchor = { bytes: anchorBytes, contentType: "image/png" };
      // Views run sequentially: the point is likeness, and sequential runs make
      // per-view latency readable rather than tangled with queue contention.
      for (const view of options.canonicalViews) {
        if (aborted) break;
        const call = find(`view:${view}`);
        if (!call) continue;
        await runImage(call, () =>
          engines.identity.generateView({
            prompt:
              `Keep this exact person's face, hair, build and skin unchanged. ${FRAMING}`,
            references: [anchor],
            resolution: "2K",
            viewAngle: view,
          }),
        );
      }
      for (const [index, revision] of options.revisions.entries()) {
        if (aborted) break;
        const call = find(`revision:${index + 1}`);
        if (!call) continue;
        await runImage(call, () =>
          engines.identity.editWithReferences({
            prompt:
              `Keep this exact person's identity unchanged. Apply only this change: ${revision}. ${FRAMING}`,
            references: [anchor],
            resolution: "2K",
          }),
        );
      }
    } else {
      console.log("  anchor failed — skipping the identity phase, nothing to hold.");
    }
  }

  /* ---------------------------------------------------------- phase: sheet */

  const sheetCalls = options.plan.filter((call) => call.phase === "sheet");
  if (sheetCalls.length > 0 && !aborted) {
    console.log("\n[phase sheet] eight candidates from one brief — diversity and framing\n");
    const brief = options.briefs[0];
    const startedAt = Date.now();
    // Parallel on purpose: this is where effective throughput gets measured,
    // which is the number §H.8's concurrency budget needs.
    await Promise.all(
      sheetCalls.map((call) =>
        runImage(call, () =>
          engines.creative.generateCandidate({
            prompt: `${brief.text}. ${FRAMING}`,
            size: options.sheetSize,
            quality: options.sheetQuality,
          }),
        ),
      ),
    );
    console.log(
      `  sheet wall-clock: ${((Date.now() - startedAt) / 1000).toFixed(1)}s for ${sheetCalls.length} parallel candidates`,
    );
  }

  /* ------------------------------------------------------------- phase: ab */

  const abCalls = options.plan.filter((call) => call.phase === "ab");
  if (abCalls.length > 0 && !aborted) {
    console.log("\n[phase ab] Claude-only vs Claude+Kimi treatments\n");
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY required for the text stages");

    for (const brief of options.briefs) {
      if (aborted) break;

      // Path A: the interpreter alone. Its output is a compiled brief; the
      // adapter owns all technical detail either way.
      let intent = brief.text;
      const intentCall = find(`intent:${brief.id}`);
      if (intentCall && manifest.calls[intentCall.id]?.status !== "ok") {
        guard.reserve(intentCall.costUsd, intentCall.id);
        try {
          const { text, servedModel } = await callOpenRouterText(
            openrouterKey,
            INTERPRETER_MODEL,
            "You compile a casting brief into one vivid, concrete description of a single character. Reply with the description only — no preamble, no lists, under 60 words.",
            brief.text,
          );
          intent = text.trim() || brief.text;
          record({
            id: intentCall.id,
            phase: "ab",
            status: "ok",
            provider: "openrouter-text",
            model: servedModel ?? INTERPRETER_MODEL,
            dispatchedAt: Date.now(),
          });
          fs.writeFileSync(path.join(options.outDir, `intent-${brief.id}.txt`), intent, "utf8");
        } catch (error) {
          const { message } = describeFailure(error);
          record({
            id: intentCall.id,
            phase: "ab",
            status: "failed",
            provider: "openrouter-text",
            error: message,
            dispatchedAt: Date.now(),
          });
          console.log(`  FAIL intent:${brief.id} ${message.slice(0, 100)}`);
        }
      } else if (fs.existsSync(path.join(options.outDir, `intent-${brief.id}.txt`))) {
        intent = fs.readFileSync(path.join(options.outDir, `intent-${brief.id}.txt`), "utf8");
      }

      // Path B: eight authored treatments varying character-side dimensions.
      let treatments: string[] = [];
      const treatmentCall = find(`treatments:${brief.id}`);
      if (treatmentCall && !aborted) {
        guard.reserve(treatmentCall.costUsd, treatmentCall.id);
        try {
          const { text, servedModel } = await callOpenRouterText(
            openrouterKey,
            TREATMENT_MODEL,
            `You are a casting director. Given a character brief, propose exactly ${options.candidatesPerRoll} DISTINCT interpretations of the same character. Vary only personality, energy, age within the brief, and unlocked styling — never framing, camera, crop, wardrobe formality or background. Reply as ${options.candidatesPerRoll} lines, one per interpretation, no numbering.`,
            intent,
          );
          treatments = text
            .split("\n")
            .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
            .filter(Boolean)
            .slice(0, options.candidatesPerRoll);
          record({
            id: treatmentCall.id,
            phase: "ab",
            status: treatments.length === options.candidatesPerRoll ? "ok" : "failed",
            provider: "openrouter-text",
            model: servedModel ?? TREATMENT_MODEL,
            error:
              treatments.length === options.candidatesPerRoll
                ? undefined
                : `expected ${options.candidatesPerRoll} treatments, parsed ${treatments.length}`,
            dispatchedAt: Date.now(),
          });
          fs.writeFileSync(
            path.join(options.outDir, `treatments-${brief.id}.txt`),
            treatments.join("\n"),
            "utf8",
          );
        } catch (error) {
          const { message } = describeFailure(error);
          record({
            id: treatmentCall.id,
            phase: "ab",
            status: "failed",
            provider: "openrouter-text",
            error: message,
            dispatchedAt: Date.now(),
          });
          console.log(`  FAIL treatments:${brief.id} ${message.slice(0, 100)}`);
        }
      }

      // §E.1's fail-safe: fewer than eight surviving treatments means path B
      // falls back to path A entirely for this brief, and the report says so.
      const pathBUsable = treatments.length === options.candidatesPerRoll;

      for (const pathName of ["A", "B"] as const) {
        if (aborted) break;
        const calls = abCalls.filter((call) => call.id.startsWith(`ab:${brief.id}:${pathName}:`));
        await Promise.all(
          calls.map((call, index) => {
            const prompt =
              pathName === "A" || !pathBUsable
                ? `${intent}. ${FRAMING}`
                : `${treatments[index]}. ${FRAMING}`;
            return runImage(call, () =>
              engines.creative.generateCandidate({
                prompt,
                size: options.sheetSize,
                quality: options.sheetQuality,
              }),
            );
          }),
        );
      }
      console.log(`  ${brief.id}: path B ${pathBUsable ? "used treatments" : "FELL BACK to path A"}`);
    }
  }

  /* ---------------------------------------------------------- phase: voice */

  if (options.plan.some((call) => call.phase === "voice") && !aborted) {
    console.log("\n[phase voice] is prompt-based voice design reachable through fal?\n");
    const candidates = [
      "fal-ai/elevenlabs/voice-design",
      "fal-ai/elevenlabs/tts/multilingual-v2",
      "fal-ai/elevenlabs/sound-effects",
    ];
    const found: Array<{ endpoint: string; reachable: boolean; note: string }> = [];
    for (const endpoint of candidates) {
      try {
        const response = await fetch(
          `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(endpoint)}`,
        );
        found.push({
          endpoint,
          reachable: response.ok,
          note: response.ok ? "schema published" : `HTTP ${response.status}`,
        });
      } catch (error) {
        found.push({ endpoint, reachable: false, note: String(error).slice(0, 80) });
      }
    }
    fs.writeFileSync(
      path.join(options.outDir, "voice-probe.json"),
      `${JSON.stringify(found, null, 2)}\n`,
      "utf8",
    );
    for (const entry of found) {
      console.log(`  ${entry.reachable ? "yes" : "no "}  ${entry.endpoint}  (${entry.note})`);
    }
  }

  /* ------------------------------------------------------------ accounting */

  manifest.balanceAfterUsd = await readFalBalanceUsd(falKey);
  saveManifest(manifestFile, manifest);

  const records = Object.values(manifest.calls);
  const ok = records.filter((entry) => entry.status === "ok");
  const failed = records.filter((entry) => entry.status === "failed");
  const measured =
    manifest.balanceBeforeUsd !== null && manifest.balanceAfterUsd !== null
      ? manifest.balanceBeforeUsd - manifest.balanceAfterUsd
      : null;

  console.log("\n[calibration] complete");
  console.log(`  calls: ${ok.length} ok, ${failed.length} failed`);
  console.log(`  estimated dispatch spend: $${guard.spent.toFixed(2)}`);
  console.log(
    measured === null
      ? "  measured fal spend: unavailable"
      : `  measured fal spend: $${measured.toFixed(4)} (balance ${manifest.balanceBeforeUsd} → ${manifest.balanceAfterUsd})`,
  );
  if (aborted) console.log("  RUN ABORTED at the spend ceiling — resume to continue.");
  console.log(`  artifacts: ${options.outDir}\n`);
}
