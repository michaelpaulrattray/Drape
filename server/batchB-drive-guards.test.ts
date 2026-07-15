/**
 * Batch B final review round B — the mutating drive's safety gates, proven by
 * actually running the script as a child process (the guards execute in their
 * real order, and every refusal here happens BEFORE mysql.createConnection —
 * the refusal messages asserted below are emitted only by the pre-connection
 * guard block at the top of the script).
 *
 * No database is contacted: each case is engineered to refuse at the gates.
 * The override URL is a syntactically plausible PUBLIC Railway proxy URL —
 * exactly the shape a one-off production `DATABASE_URL` override would have —
 * with fake credentials pointing at an address that is never dialed.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = join(__dirname, "..");
const script = join("scripts", "drive-batchB-status.mts");

/** Run the drive with a controlled env; return { status, output }. */
function runDrive(envOverrides: Record<string, string | undefined>) {
  try {
    const stdout = execFileSync("npx", ["tsx", script], {
      cwd: repoRoot,
      env: { ...process.env, ...envOverrides },
      encoding: "utf-8",
      shell: true, // npx is npx.cmd on Windows
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    return { status: 0, output: stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? -1, output: `${err.stdout ?? ""}\n${err.stderr ?? ""}` };
  }
}

describe("drive-batchB-status guards (child-process, no DB contact)", () => {
  it("refuses without the explicit fixture opt-in", () => {
    const res = runDrive({ DRIVE_ALLOW_DB_FIXTURES: undefined });
    expect(res.status).toBe(2);
    expect(res.output).toContain("REFUSED");
    expect(res.output).toContain("DRIVE_ALLOW_DB_FIXTURES");
  });

  it("refuses a PUBLIC Railway-style DATABASE_URL override BEFORE any connection", () => {
    // The exact bypass the review named: `.env` supplies the local app id,
    // but the shell still carries a one-off production MYSQL_PUBLIC_URL.
    // That URL contains no 'railway.internal' and passes every pattern
    // check — only the positive .env-equality binding catches it.
    const res = runDrive({
      DRIVE_ALLOW_DB_FIXTURES: "1",
      DATABASE_URL: "mysql://root:notreal@containers-us-west-99.railway.app:6033/railway",
    });
    expect(res.status).toBe(2);
    expect(res.output).toContain("REFUSED");
    // The pre-connection binding guard's message — not a connection error,
    // and no credential value is echoed
    expect(res.output).toContain("does not match the repository .env DATABASE_URL");
    expect(res.output).not.toContain("notreal");
    expect(res.output).not.toContain("containers-us-west-99");
  });

  it("refuses a non-loopback VERIFY_BASE_URL before any connection", () => {
    const res = runDrive({
      DRIVE_ALLOW_DB_FIXTURES: "1",
      VERIFY_BASE_URL: "https://drape-production-0232.up.railway.app",
    });
    expect(res.status).toBe(2);
    expect(res.output).toContain("REFUSED");
    expect(res.output).toContain("loopback");
  });

  it("refuses a non-local app identity", () => {
    const res = runDrive({
      DRIVE_ALLOW_DB_FIXTURES: "1",
      VITE_APP_ID: "drape-production",
    });
    expect(res.status).toBe(2);
    expect(res.output).toContain("REFUSED");
  });
}, 120_000);
