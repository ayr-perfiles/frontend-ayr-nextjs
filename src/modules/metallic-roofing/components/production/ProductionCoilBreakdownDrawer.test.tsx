import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionCoilBreakdownDrawer } from "./ProductionCoilBreakdownDrawer";

describe("ProductionCoilBreakdownDrawer Render", () => {
  it("muestra el chip formateado correctamente para COT", () => {
    const mockLog = {
      sku: "CALAMINA-TR4",
      status: "ACTIVE",
      perCoilBreakdown: [],
      source: {
        type: "QUOTE",
        id: "COT-BBV1-316",
        label: "COT-BBV1-316",
      },
    };
    
    render(
      <ProductionCoilBreakdownDrawer 
        log={mockLog} 
        productName="Test Product" 
        onClose={vi.fn()} 
      />
    );
    
    expect(screen.getByText("BBV1-316")).toBeDefined();
  });

  it("muestra el chip formateado correctamente para C", () => {
    const mockLog = {
      sku: "CALAMINA-TR4",
      status: "ACTIVE",
      perCoilBreakdown: [],
      source: {
        type: "QUOTE",
        id: "C-000023",
        label: "C-000023",
      },
    };
    
    render(
      <ProductionCoilBreakdownDrawer 
        log={mockLog} 
        productName="Test Product" 
        onClose={vi.fn()} 
      />
    );
    
    expect(screen.getByText("C-000023")).toBeDefined();
  });
});
