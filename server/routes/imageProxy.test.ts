import { afterEach, describe, expect, it } from "vitest";
import { isAllowedUrl } from "./imageProxy";

const originalR2PublicUrl = process.env.R2_PUBLIC_URL;

afterEach(() => {
  if (originalR2PublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
  else process.env.R2_PUBLIC_URL = originalR2PublicUrl;
});

describe("imageProxy isAllowedUrl", () => {
  it("allows S3 bucket URLs", () => {
    expect(
      isAllowedUrl("https://manus-storage.s3.us-east-1.amazonaws.com/key/img.png")
    ).toBe(true);
    expect(isAllowedUrl("https://s3.amazonaws.com/bucket/img.png")).toBe(true);
  });

  it("allows only the configured public R2 bucket host", () => {
    process.env.R2_PUBLIC_URL = "https://pub-owned-bucket.r2.dev";
    expect(isAllowedUrl("https://pub-owned-bucket.r2.dev/casting/img.png")).toBe(true);
    expect(isAllowedUrl("https://pub-someone-else.r2.dev/casting/img.png")).toBe(false);
    expect(isAllowedUrl("https://account.r2.cloudflarestorage.com/bucket/img.png")).toBe(false);
  });

  it("blocks suffix-spoofing hostnames (the .includes() bypass)", () => {
    expect(isAllowedUrl("https://s3.amazonaws.com.attacker.com/img.png")).toBe(false);
    expect(isAllowedUrl("https://evil.com/.amazonaws.com/img.png")).toBe(false);
    expect(isAllowedUrl("https://xamazonaws.com/img.png")).toBe(false);
    expect(isAllowedUrl("https://manus-storage-fake.evil.com/img.png")).toBe(false);
  });

  it("blocks internal and arbitrary hosts", () => {
    expect(isAllowedUrl("https://localhost/admin")).toBe(false);
    expect(isAllowedUrl("https://127.0.0.1/latest/meta-data")).toBe(false);
    expect(isAllowedUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedUrl("https://example.com/img.png")).toBe(false);
  });

  it("blocks non-https schemes", () => {
    expect(isAllowedUrl("http://s3.amazonaws.com/bucket/img.png")).toBe(false);
    expect(isAllowedUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedUrl("ftp://s3.amazonaws.com/img.png")).toBe(false);
  });

  it("blocks malformed URLs", () => {
    expect(isAllowedUrl("not a url")).toBe(false);
    expect(isAllowedUrl("")).toBe(false);
  });

  it("is case-insensitive on hostname", () => {
    expect(isAllowedUrl("https://Bucket.S3.AMAZONAWS.COM/img.png")).toBe(true);
  });
});
