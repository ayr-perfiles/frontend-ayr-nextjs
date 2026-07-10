import { isThicknessWithinTolerance } from "./thicknessMatch";

describe("isThicknessWithinTolerance", () => {
  it("should return true when difference is exactly tolerance", () => {
    // Math.abs(0.40 - 0.38) in JS yields 0.020000000000000018
    expect(isThicknessWithinTolerance(0.38, 0.40)).toBe(true);
    expect(isThicknessWithinTolerance(0.42, 0.40)).toBe(true);
  });

  it("should return false when difference is strictly greater than tolerance", () => {
    expect(isThicknessWithinTolerance(0.43, 0.40)).toBe(false);
    expect(isThicknessWithinTolerance(0.37, 0.40)).toBe(false);
  });

  it("should return true when thicknesses are identical", () => {
    expect(isThicknessWithinTolerance(0.40, 0.40)).toBe(true);
  });
});
