/**
 * THE SMALL COPY DIES WITH ITS PICTURE (#1389).
 *
 * A signed view's thumbnail is a DERIVED key, so no database row names it and
 * no cleanup could ever be pointed at it by the record. It is swept at
 * `storageDelete` — the one exported deletion primitive — so every caller
 * inherits it: the storage cleanup worker, the mint's own rollback, permanent
 * Cast deletion.
 *
 * ⚠ **The arm that matters most is the one asserting a NON-view is untouched.**
 * The failure this design has to avoid is not a missed thumbnail; it is
 * doubling the request count of a bulk sweep for a derivative that has never
 * existed. That is a negative control, and without it a blanket "always delete
 * two" would pass every other arm in this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: any[] = [];

vi.mock("@aws-sdk/client-s3", () => {
  class DeleteObjectCommand {
    constructor(public input: any) {}
  }
  class PutObjectCommand {
    constructor(public input: any) {}
  }
  class GetObjectCommand {
    constructor(public input: any) {}
  }
  class HeadObjectCommand {
    constructor(public input: any) {}
  }
  class ListObjectsV2Command {
    constructor(public input: any) {}
  }
  class S3Client {
    async send(command: any) {
      sent.push(command);
      if (command instanceof DeleteObjectCommand && command.input.Key === FAILING_KEY) {
        const error: any = new Error("refused");
        error.name = "AccessDenied";
        error.$metadata = { httpStatusCode: 403 };
        throw error;
      }
      return {};
    }
  }
  return {
    S3Client,
    DeleteObjectCommand,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
  };
});

const FAILING_KEY = "casting-v2/casts/op-9/views/failing.png";
const VIEW_KEY = "casting-v2/casts/op-7/views/2f1c9e4a.png";

let storageDelete: typeof import("./storage").storageDelete;

beforeEach(async () => {
  sent.length = 0;
  process.env.R2_ENDPOINT = "https://example.invalid";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_PUBLIC_URL = "https://pub-x.r2.dev";
  process.env.R2_ACCESS_KEY_ID = "id";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  vi.resetModules();
  ({ storageDelete } = await import("./storage"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function deletedKeys(): string[] {
  return sent.map((command) => command.input?.Key).filter(Boolean);
}

describe("storageDelete sweeps a signed view's small copy", () => {
  it("deletes the derivative as well as the picture", async () => {
    const result = await storageDelete(VIEW_KEY);
    expect(result).toEqual({ success: true });
    expect(deletedKeys()).toEqual([`${VIEW_KEY}.thumb.jpg`, VIEW_KEY]);
  });

  it("leaves a key that is not a signed view entirely alone", async () => {
    await storageDelete("wardrobe/garments/abc.png");
    expect(deletedKeys()).toEqual(["wardrobe/garments/abc.png"]);
  });

  it("does not recurse when handed a derivative directly", async () => {
    await storageDelete(`${VIEW_KEY}.thumb.jpg`);
    expect(deletedKeys()).toEqual([`${VIEW_KEY}.thumb.jpg`]);
  });

  it("normalises a leading slash the same way the picture's own delete does", async () => {
    await storageDelete(`/${VIEW_KEY}`);
    expect(deletedKeys()).toEqual([`${VIEW_KEY}.thumb.jpg`, VIEW_KEY]);
  });

  /*
    ⚠ A MISSING THUMBNAIL IS THE NORMAL CASE, NOT A FAILURE — every view signed
    before this shipped has none. Letting the sweep's outcome reach the result
    would make a correct deletion look broken to the cleanup worker, which
    counts and retries on exactly this value.
  */
  it("still reports success when the sweep itself is refused", async () => {
    const result = await storageDelete(FAILING_KEY.replace("failing.png", "ok.png"));
    expect(result).toEqual({ success: true });
  });

  it("still classifies the PICTURE's own failure, unchanged", async () => {
    const result = await storageDelete(FAILING_KEY);
    expect(result).toEqual({ success: false, errorCode: "AccessDenied", retryable: false });
  });
});
