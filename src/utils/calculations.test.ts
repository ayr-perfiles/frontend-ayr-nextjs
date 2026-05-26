// src/utils/calculations.test.ts
import { describe, it, expect } from "vitest";
import { calculateExpectedPiecesByDensity } from "./calculations";

describe("calculateExpectedPiecesByDensity", () => {
  describe("cálculos correctos con datos válidos", () => {
    it("debe calcular correctamente para bobina estándar de drywall", () => {
      // Bobina típica: 1000kg, fleje de 121mm, espesor 0.45mm, pieza 3m
      const result = calculateExpectedPiecesByDensity(
        1000, // weightKg
        121, // widthMm
        0.45, // thicknessMm
        3.0, // pieceLengthM
      );

      // Cálculo manual:
      // metricFactor = 7.85 / 1000 = 0.00785
      // totalMeters = 1000 / (0.45 × 121 × 0.00785) = 2338.85m
      // piezas = floor(2338.85 / 3.0) = 779 piezas
      expect(result).toBe(779);
    });

    it("debe calcular para parante P64 (fleje ancho)", () => {
      // Fleje más ancho: 149mm
      const result = calculateExpectedPiecesByDensity(1000, 149, 0.45, 3.0);

      // totalMeters = 1000 / (0.45 × 149 × 0.00785) ≈ 1900.5m
      // piezas = floor(1900.5 / 3.0) = 633 piezas
      expect(result).toBe(633);
    });

    it("debe calcular para espesor mayor (calibre 20)", () => {
      // Espesor mayor: 0.90mm
      const result = calculateExpectedPiecesByDensity(
        1000,
        121,
        0.9, // doble espesor
        3.0,
      );

      // totalMeters = 1000 / (0.90 × 121 × 0.00785) = 1169.42m
      // Con doble espesor, debe dar la mitad de piezas (~389)
      expect(result).toBe(389);
    });

    it("debe manejar largo de pieza no estándar (2.44m)", () => {
      // Largo de 8 pies = 2.44m
      const result = calculateExpectedPiecesByDensity(1000, 121, 0.45, 2.44);

      // totalMeters = 2338.85m (mismo que caso estándar)
      // Más piezas porque cada una es más corta
      expect(result).toBeGreaterThan(779); // más que el estándar de 3m
      expect(result).toBe(958);
    });
  });

  describe("validaciones de entrada", () => {
    it("debe retornar 0 si el peso es 0", () => {
      const result = calculateExpectedPiecesByDensity(0, 121, 0.45, 3.0);
      expect(result).toBe(0);
    });

    it("debe retornar 0 si el espesor es 0 (división por cero)", () => {
      const result = calculateExpectedPiecesByDensity(1000, 121, 0, 3.0);
      expect(result).toBe(0);
    });

    it("debe retornar 0 si el ancho es 0", () => {
      const result = calculateExpectedPiecesByDensity(1000, 0, 0.45, 3.0);
      expect(result).toBe(0);
    });

    it("debe retornar 0 si el largo de pieza es 0", () => {
      const result = calculateExpectedPiecesByDensity(1000, 121, 0.45, 0);
      expect(result).toBe(0);
    });

    it("debe retornar 0 si hay valores negativos", () => {
      expect(calculateExpectedPiecesByDensity(1000, -121, 0.45, 3.0)).toBe(0);
      expect(calculateExpectedPiecesByDensity(1000, 121, -0.45, 3.0)).toBe(0);
      expect(calculateExpectedPiecesByDensity(1000, 121, 0.45, -3.0)).toBe(0);
      expect(calculateExpectedPiecesByDensity(-100, 121, 0.45, 3.0)).toBe(0);
    });
  });

  describe("casos extremos", () => {
    it("debe manejar bobinas muy pesadas (5000kg)", () => {
      const result = calculateExpectedPiecesByDensity(5000, 121, 0.45, 3.0);
      // 5× el resultado base: 779 × 5 = 3895, pero calculemos exacto:
      // totalMeters = 5000 / (0.45 × 121 × 0.00785) = 11698.96m
      // piezas = floor(11698.96 / 3) = 3899
      expect(result).toBe(3899);
      expect(result).toBeGreaterThan(0);
    });

    it("debe manejar flejes muy angostos (60mm)", () => {
      const result = calculateExpectedPiecesByDensity(1000, 60, 0.45, 3.0);
      // Fleje más angosto = más metros = más piezas
      expect(result).toBeGreaterThan(780);
    });

    it("debe manejar espesor muy delgado (0.30mm)", () => {
      const result = calculateExpectedPiecesByDensity(1000, 121, 0.3, 3.0);
      // totalMeters = 1000 / (0.30 × 121 × 0.00785) = 3508.27m
      // Espesor menor = más metros = más piezas
      expect(result).toBe(1169);
    });

    it("debe redondear hacia abajo (piezas enteras)", () => {
      // Caso donde da exactamente X.99 piezas → debe truncar a X
      const result = calculateExpectedPiecesByDensity(1000, 121, 0.45, 3.001);
      const withSlightlyLonger = calculateExpectedPiecesByDensity(
        1000,
        121,
        0.45,
        3.0,
      );

      // Una diferencia de 1mm no alcanza para cambiar el piso en este rango
      // Con 3.001m: floor(2339.79 / 3.001) = floor(779.67) = 779
      // Con 3.0m:   floor(2339.79 / 3.000) = floor(779.93) = 779
      expect(result).toBeLessThanOrEqual(withSlightlyLonger);
      expect(result).toBe(779);
      expect(withSlightlyLonger).toBe(779);
    });
  });

  describe("validación contra límite físico (5% tolerancia)", () => {
    it("debe respetar el límite del 5% en validación backend", () => {
      const expected = calculateExpectedPiecesByDensity(1000, 121, 0.45, 3.0); // 779
      const maxAllowed = Math.ceil(expected * 1.05); // 818

      // El sistema debe rechazar reportes > 818 piezas
      expect(maxAllowed).toBe(818);
      expect(expected).toBe(779);
    });
  });
});
