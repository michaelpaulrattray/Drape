import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const composerDir = path.join(
  root,
  "server",
  "casting",
  "evidence",
  "composer",
);

function read(file: string): string {
  return fs.readFileSync(path.join(composerDir, file), "utf8");
}

describe("R7-7D D3 pure composer contract", () => {
  it("pins the closed recipe, Pro engine, Economy probe, and three-image budget", () => {
    const recipe = read("inkAddRecipe.ts");
    const composer = read("inkComposer.ts");
    const probe = read("inkProbe.ts");
    expect(recipe).toContain('INK_ADD_IMAGE_ENGINE = IMAGE_PRO');
    expect(recipe).toContain('INK_ADD_PROBE_MODEL = TEXT_ECONOMY');
    expect(recipe).toContain('"front_upper_torso"');
    expect(composer).toContain('images.length > 3');
    expect(probe).toContain('images.length > 3');
  });

  it("keeps D3 disconnected from routes, credits, DB, storage, snapshots, and ordinary identity verification", () => {
    const sources = fs.readdirSync(composerDir)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map(read)
      .join("\n");
    expect(sources).not.toMatch(
      /from\s+["'][^"']*(?:routes|db\/|storage|credits|snapshot|atomicCredits)[^"']*["']/i,
    );
    expect(sources).not.toMatch(
      /verifyViewIdentity|deductPoints|recordRefund|storagePut|storageDelete|getDb|protectedProcedure|publicProcedure/,
    );
  });

  it("fails probe unknown closed and permits only one included retry", () => {
    const probe = read("inkProbe.ts");
    const retry = read("inkRetryDecision.ts");
    expect(probe).toContain('overallOutcome: overall(checks)');
    expect(retry).toContain('outcome: "unknown"');
    expect(retry).toContain('nextAttemptNumber: 2');
    expect(retry).toContain("EVIDENCE_CANDIDATE_MAX_ATTEMPTS");
  });

  it("pins the provider schema for the fail-closed authorization gate", () => {
    const authorization = read("inkAuthorization.ts");
    const intent = fs.readFileSync(path.join(
      root,
      "server",
      "casting",
      "evidence",
      "inkAddIntent.ts",
    ), "utf8");
    expect(authorization).toContain("responseSchema: {");
    expect(authorization).toContain('confidence: "integer_0_100"');
    expect(authorization).toContain("...INK_TEXT_PROVIDER_CONFIG");
    expect(intent).toContain("Object.entries(request.responseSchema)");
    expect(intent).toContain("required: Object.keys(properties)");
    expect(intent).not.toContain("additionalProperties");
    expect(intent).toContain("thinkingBudget: request.thinkingBudget");
    expect(intent).toContain("maxOutputTokens: request.maxOutputTokens");
    const candidate = fs.readFileSync(path.join(
      root,
      "server",
      "casting",
      "evidence",
      "inkCandidateGeneration.ts",
    ), "utf8");
    expect(candidate).toContain("buildInkProbeProviderConfig(request)");
    expect(candidate).toContain("thinkingBudget: request.thinkingBudget");
    expect(candidate).toContain("maxOutputTokens: request.maxOutputTokens");
  });

  it("keeps provider diagnostics metadata-only", () => {
    const telemetry = read("inkProviderTelemetry.ts");
    expect(telemetry).toContain("extractInkProviderTelemetry");
    expect(telemetry).not.toMatch(
      /\bdescriptor\b|providerResponse|\.message\b|\.stack\b|\.body\b/,
    );
    expect(telemetry).not.toContain("node:fs");
  });

  it("keeps the calibration recorder local, allowlisted, and free of private payload fields", () => {
    const calibration = read("inkCalibration.ts");
    expect(calibration).toContain("createInkCalibrationRecorder");
    expect(calibration).not.toMatch(
      /userId|modelId|storageKey|imageUrl|descriptor|providerResponse|probeProse/,
    );
    expect(calibration).not.toMatch(/node:fs|writeFile|appendFile/);
  });
});
