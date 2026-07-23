import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import ProductModal from "./ProductModal";
import type { MetallicProduct } from "@/modules/metallic-roofing/types";

// Mock del hook useFinishes
vi.mock("@/core/coils/hooks/useFinishes", () => {
  return {
    useFinishes: () => ({
      finishes: [
        { id: "GRIS", label: "Gris", active: true, lines: ["metallic-roofing"] },
      ],
      loading: false,
    }),
  };
});

vi.mock("@/lib/firebase/clientApp", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
}));

describe("ProductModal Smoke Test", () => {
  it("monta en modo edicion con un producto que tiene finish obsoleto (sin explotes TDZ)", () => {
    const dummyProduct = {
      sku: "COB035ALU",
      family: "COBERTURA",
      finish: "ALUZINC",
      finishes: [],
      thickness: 0.35,
      width: 1.0,
      widthMm: 1000,
      length: 0,
      unit: "METRO",
      displayName: "Cobertura Aluzinc",
    } as unknown as MetallicProduct;

    expect(() => {
      render(
        <ProductModal
          mode="edit"
          product={dummyProduct}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    }).not.toThrow();

    // Verificamos que se haya renderizado algo del modal, por ejemplo el titulo
    expect(screen.getByText(/Editar producto/i)).toBeInTheDocument();
  });

  it("monta en modo edicion con family PLANCHA", () => {
    const dummyProduct = {
      sku: "PL035ALU6M",
      family: "PLANCHA",
      finish: "ALUZINC",
      finishes: [],
      thickness: 0.35,
      width: 1.0,
      widthMm: 1000,
      length: 6,
      unit: "PIEZA",
      displayName: "Plancha Aluzinc 6m",
    } as unknown as MetallicProduct;

    expect(() => {
      render(
        <ProductModal
          mode="edit"
          product={dummyProduct}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    }).not.toThrow();

    expect(screen.getByText(/Editar producto/i)).toBeInTheDocument();
  });
});
