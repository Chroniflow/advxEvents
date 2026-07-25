import { describe, expect, it } from "vitest";

import { inspectImage } from "../../src/worker/uploads/validate";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("inspectImage", () => {
  it("accepts a PNG whose signature matches its MIME type", () => {
    expect(inspectImage(png(1200, 800), "image/png")).toMatchObject({
      contentType: "image/png",
      width: 1200,
      height: 800,
    });
  });

  it("rejects a mismatched declared MIME type", () => {
    expect(() => inspectImage(png(100, 100), "image/jpeg")).toThrow(
      "Image type does not match file content",
    );
  });

  it("rejects unsupported SVG content", () => {
    expect(() =>
      inspectImage(new TextEncoder().encode("<svg></svg>"), "image/svg+xml"),
    ).toThrow("Unsupported image type");
  });

  it("rejects excessive dimensions", () => {
    expect(() => inspectImage(png(12_001, 800), "image/png")).toThrow(
      "Image dimensions exceed limit",
    );
  });
});
