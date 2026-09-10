/**
 * HYPERFINE, PINNED AND VERIFIED (#35, the toolbelt remainder).
 *
 * The house already has this shape once — `scripts/workflow-lint.sh` fetches
 * actionlint and zizmor at a pinned version with a sha256 checked before the
 * bytes are trusted. This is that pattern for the Machinist's benchmark tool,
 * moved into node for one reason: the seat that needs it runs on **Windows**,
 * and the archives differ by platform (`.tar.gz` on linux, `.zip` on windows).
 * A shell script would have to translate paths between Git Bash and Windows to
 * hand the binary to a node caller; node does not.
 *
 * # Why hyperfine and not a timer around `spawnSync`
 *
 * The fidelity law. Warmup runs, outlier detection, shell-spawn compensation
 * and the statistics are the whole difficulty of benchmarking a command, and
 * they are exactly what a hand-rolled timer approximates badly. A `Date.now()`
 * either side of one run is the convenient substitute that caps the ceiling of
 * everything built on it.
 *
 * # ⚠ TWO PLATFORMS ARE PINNED, AND THE REST ARE REFUSED RATHER THAN GUESSED
 *
 * `x86_64-pc-windows-msvc` (this machine, where shifts run) and
 * `x86_64-unknown-linux-gnu` (ubuntu runners). Both checksums below were taken
 * from the downloaded bytes on 2026-09-10, not copied from a page. Any other
 * platform gets a named refusal telling the reader to add its pin the same
 * way — a checksum nobody verified is worse than an unsupported platform,
 * because it looks like coverage.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { statIfPresent } from "./listedEntry.mts";

export const HYPERFINE_VERSION = "1.20.0";

export type HyperfinePin = {
  readonly asset: string;
  readonly sha256: string;
  /** the file name inside the archive */
  readonly binary: string;
};

/** Keyed `${platform}-${arch}` as node reports them. */
export const HYPERFINE_PINS: Readonly<Record<string, HyperfinePin>> = {
  "win32-x64": {
    asset: `hyperfine-v${HYPERFINE_VERSION}-x86_64-pc-windows-msvc.zip`,
    sha256: "2508c549b049b1d4342d08edc1cb42bfac169082b6e3069431b5bab9822dbb32",
    binary: "hyperfine.exe",
  },
  "linux-x64": {
    asset: `hyperfine-v${HYPERFINE_VERSION}-x86_64-unknown-linux-gnu.tar.gz`,
    sha256: "63ad53934062118f5b0be11785e0bb1603d4b91667d1921f2fd8df9a8712040a",
    binary: "hyperfine",
  },
};

export function pinFor(platform: string, arch: string): HyperfinePin {
  const key = `${platform}-${arch}`;
  const pin = HYPERFINE_PINS[key];
  if (!pin) {
    throw new Error(
      `hyperfine: no pinned build for ${key}. Pinned: ${Object.keys(HYPERFINE_PINS).join(", ")}. ` +
        `Add one by downloading the release asset, taking its sha256 from the BYTES you ` +
        `downloaded, and adding a row to HYPERFINE_PINS — never from a checksum you did not compute.`,
    );
  }
  return pin;
}

export function downloadUrl(pin: HyperfinePin): string {
  return `https://github.com/sharkdp/hyperfine/releases/download/v${HYPERFINE_VERSION}/${pin.asset}`;
}

/**
 * The gate on the bytes. Separate from the download so it can be driven
 * directly — working law 3: a backstop whose only test runs through the thing
 * that usually behaves is untested.
 */
export function assertChecksum(bytes: Uint8Array, expected: string, what: string): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `hyperfine: checksum mismatch for ${what} — expected ${expected}, got ${actual}. ` +
        `Refusing to run bytes that are not the pinned release.`,
    );
  }
}

/**
 * bsdtar reads BOTH `.tar.gz` and `.zip`, and ships in Windows' System32 as
 * well as on every linux runner — so one extraction path covers both archives.
 * On Windows the absolute path is used deliberately: Git Bash puts a GNU `tar`
 * on PATH which cannot read a zip, and picking that one up would fail only on
 * a developer machine.
 */
function tarBinary(): string {
  return process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
}

function findFile(root: string, name: string): string | null {
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    /* ENOENT-tolerant, like every other walk in `scripts/` (#589): an entry can
       leave between the listing and the stat. */
    const stat = statIfPresent(full);
    if (!stat) continue;
    if (stat.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry === name) {
      return full;
    }
  }
  return null;
}

export type EnsureOptions = {
  readonly cacheDir: string;
  /** injected in tests; defaults to a real fetch of the pinned release */
  readonly download?: (url: string) => Promise<Uint8Array>;
  readonly platform?: string;
  readonly arch?: string;
  readonly log?: (line: string) => void;
};

/**
 * Return a path to a verified hyperfine, downloading it once if the cache is
 * empty. The cached copy is keyed by VERSION, so bumping the pin fetches
 * afresh rather than running last month's binary from a stale cache.
 */
export async function ensureHyperfine(options: EnsureOptions): Promise<string> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const log = options.log ?? (() => {});
  const pin = pinFor(platform, arch);

  const versioned = path.join(options.cacheDir, `hyperfine-${HYPERFINE_VERSION}`);
  const cached = path.join(versioned, pin.binary);
  if (existsSync(cached)) return cached;

  log(`hyperfine: fetching v${HYPERFINE_VERSION} for ${platform}-${arch} (once)`);
  const download =
    options.download ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`hyperfine: download failed — ${response.status} ${response.statusText}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    });

  const bytes = await download(downloadUrl(pin));
  assertChecksum(bytes, pin.sha256, pin.asset);

  const scratch = mkdtempSync(path.join(tmpdir(), "drape-hyperfine-"));
  try {
    const archive = path.join(scratch, pin.asset);
    writeFileSync(archive, bytes);
    const extracted = spawnSync(tarBinary(), ["-xf", archive, "-C", scratch], { stdio: "pipe" });
    if (extracted.status !== 0) {
      throw new Error(
        `hyperfine: could not extract ${pin.asset} — ${extracted.stderr?.toString().trim()}`,
      );
    }
    // The archive's internal layout is not promised by the project, so the
    // binary is found rather than assumed to sit at a path.
    const found = findFile(scratch, pin.binary);
    if (!found) {
      throw new Error(`hyperfine: ${pin.binary} not found inside ${pin.asset}`);
    }
    mkdirSync(versioned, { recursive: true });
    copyFileSync(found, cached);
    if (platform !== "win32") chmodSync(cached, 0o755);
    return cached;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Read a cached binary's own version string — used to prove the pin took. */
export function reportedVersion(binary: string): string {
  const result = spawnSync(binary, ["--version"], { encoding: "utf8" });
  return (result.stdout ?? "").trim();
}

