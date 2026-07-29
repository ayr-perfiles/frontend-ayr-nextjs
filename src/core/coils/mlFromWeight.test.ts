import { describe, it, expect } from "vitest";
import { computeMlFromWeight } from "./mlFromWeight";

describe("computeMlFromWeight", () => {
  it("computes ML correctly (anchored mm-directo test)", () => {
    // 5000 / (1200 * 0.3 * 0.008) = 5000 / 2.88 = 1736.1111...
    const result = computeMlFromWeight(5000, 1200, 0.3, 0.008);
    expect(result).toBeCloseTo(1736.11, 2);
  });

  it("returns null when densityFactor is 0", () => {
    expect(computeMlFromWeight(5000, 1200, 0.3, 0)).toBeNull();
  });

  it("returns null when factor is <= 0", () => {
    expect(computeMlFromWeight(5000, 1200, 0, 0.008)).toBeNull();
    expect(computeMlFromWeight(5000, 0, 0.3, 0.008)).toBeNull();
  });

  it("returns 0 when weight is 0", () => {
    expect(computeMlFromWeight(0, 1200, 0.3, 0.008)).toBe(0);
  });
});
