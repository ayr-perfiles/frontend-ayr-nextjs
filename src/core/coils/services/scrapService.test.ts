import { describe, it, expect } from "vitest";
import {
  validateScrapRequest,
  calculateScrapCost,
  calculateNewWeight,
  determineCoilStatusAfterScrap,
} from "@/core/coils/domain/scrap";

describe("Merma de Bobina — Fase 1 (dominio puro)", () => {
  // ── Cálculo de costo ────────────────────────────────────────────────────

  describe("calculateScrapCost", () => {
    it("calcula costo: 50 kg × 3.25 S/kg = 162.50 S/", () => {
      expect(calculateScrapCost(50, 3.25)).toBe(162.5);
    });

    it("redondea a 2 decimales: 10.123 kg × 2.999 S/kg", () => {
      expect(calculateScrapCost(10.123, 2.999)).toBe(30.36);
    });

    it("retorna 0 cuando pricePerKg es 0", () => {
      expect(calculateScrapCost(100, 0)).toBe(0);
    });

    it("retorna 0 cuando scrapWeightKg es 0 (caso borde, no debe llegar a este punto)", () => {
      expect(calculateScrapCost(0, 5)).toBe(0);
    });
  });

  // ── Cálculo de peso resultante ──────────────────────────────────────────

  describe("calculateNewWeight", () => {
    it("resta correctamente: 1000 - 50 = 950", () => {
      expect(calculateNewWeight(1000, 50)).toBe(950);
    });

    it("permite resultado negativo (no bloquea): 10 - 15 = -5", () => {
      expect(calculateNewWeight(10, 15)).toBe(-5);
    });

    it("redondea a 2 decimales", () => {
      expect(calculateNewWeight(100.005, 0.003)).toBe(100.0);
    });
  });

  // ── Estado de la bobina post-merma ──────────────────────────────────────

  describe("determineCoilStatusAfterScrap", () => {
    it("mantiene AVAILABLE si peso queda positivo", () => {
      expect(determineCoilStatusAfterScrap(50, "AVAILABLE")).toBe("AVAILABLE");
    });

    it("pasa a PROCESSED si peso queda exactamente en 0", () => {
      expect(determineCoilStatusAfterScrap(0, "AVAILABLE")).toBe("PROCESSED");
    });

    it("pasa a PROCESSED si peso queda negativo", () => {
      expect(determineCoilStatusAfterScrap(-5, "AVAILABLE")).toBe("PROCESSED");
    });

    it("mantiene IN_PROGRESS si peso queda positivo", () => {
      expect(determineCoilStatusAfterScrap(200, "IN_PROGRESS")).toBe(
        "IN_PROGRESS",
      );
    });
  });

  // ── Validación de rol ADMIN ─────────────────────────────────────────────

  describe("validateScrapRequest — rol", () => {
    it("rechaza OPERATOR con mensaje en español", () => {
      expect(() =>
        validateScrapRequest(10, "Borde de slitting", "OPERATOR"),
      ).toThrow("Solo un ADMIN puede registrar merma de bobina");
    });

    it("rechaza SUPERVISOR", () => {
      expect(() =>
        validateScrapRequest(10, "Despunte", "SUPERVISOR"),
      ).toThrow("ADMIN");
    });

    it("rechaza null (sin sesión)", () => {
      expect(() => validateScrapRequest(10, "Motivo", null)).toThrow("ADMIN");
    });

    it("permite ADMIN sin lanzar error", () => {
      expect(() =>
        validateScrapRequest(10, "Merma de borde", "ADMIN"),
      ).not.toThrow();
    });
  });

  // ── Validación de peso ──────────────────────────────────────────────────

  describe("validateScrapRequest — peso", () => {
    it("rechaza scrapWeightKg = 0", () => {
      expect(() => validateScrapRequest(0, "Motivo", "ADMIN")).toThrow(
        "mayor a 0 kg",
      );
    });

    it("rechaza scrapWeightKg negativo", () => {
      expect(() => validateScrapRequest(-5, "Motivo", "ADMIN")).toThrow(
        "mayor a 0 kg",
      );
    });

    it("acepta scrapWeightKg > 0", () => {
      expect(() =>
        validateScrapRequest(0.01, "Motivo", "ADMIN"),
      ).not.toThrow();
    });
  });

  // ── Validación de motivo ────────────────────────────────────────────────

  describe("validateScrapRequest — motivo", () => {
    it("rechaza reason vacío", () => {
      expect(() => validateScrapRequest(10, "", "ADMIN")).toThrow(
        "obligatorio",
      );
    });

    it("rechaza reason solo espacios", () => {
      expect(() => validateScrapRequest(10, "   ", "ADMIN")).toThrow(
        "obligatorio",
      );
    });

    it("acepta reason con texto válido", () => {
      expect(() =>
        validateScrapRequest(10, "Despunte inicial", "ADMIN"),
      ).not.toThrow();
    });
  });
});
