import { expect, test, describe } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { toMillisSafe } from "./timestamps";

describe("toMillisSafe", () => {
  test("Timestamp real -> millis via .toMillis()", () => {
    const ts = Timestamp.fromMillis(1782406800000);
    expect(toMillisSafe(ts)).toBe(1782406800000);
  });

  test("objeto plano {_seconds,_nanoseconds} (shape corrupto real de sales/FFA1-1289) -> millis", () => {
    expect(toMillisSafe({ _seconds: 1782406800, _nanoseconds: 0 })).toBe(1782406800000);
  });

  test("objeto plano {seconds,nanoseconds} -> millis", () => {
    expect(toMillisSafe({ seconds: 1782406800, nanoseconds: 500000000 })).toBe(1782406800500);
  });

  test("Date -> millis", () => {
    const d = new Date(1782406800000);
    expect(toMillisSafe(d)).toBe(1782406800000);
  });

  test("number (ya millis) -> ese number", () => {
    expect(toMillisSafe(1782406800000)).toBe(1782406800000);
  });

  test("null -> null", () => {
    expect(toMillisSafe(null)).toBeNull();
  });

  test("undefined -> null", () => {
    expect(toMillisSafe(undefined)).toBeNull();
  });

  test("objeto vacio {} -> null", () => {
    expect(toMillisSafe({})).toBeNull();
  });

  test("string basura -> null", () => {
    expect(toMillisSafe("no-soy-timestamp")).toBeNull();
  });
});
