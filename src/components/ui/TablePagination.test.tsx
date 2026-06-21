import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TablePagination } from "./TablePagination";
import React from "react";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronLeft: () => <div data-testid="chevron-left" />,
  ChevronRight: () => <div data-testid="chevron-right" />,
}));

describe("TablePagination", () => {
  const defaultProps = {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    onPageChange: vi.fn(),
    pageSizeOptions: [10, 25, 50],
    onPageSizeChange: vi.fn(),
  };

  it("renders total items and page size selector even with 1 row", () => {
    render(<TablePagination {...defaultProps} totalItems={1} totalLabel="registros" />);
    
    expect(screen.getByText(/OPERACIONES ENCONTRADAS/i)).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText(/registros/i)).toBeDefined();
    expect(screen.getByText("Mostrar:")).toBeDefined();
    
    // Pagination controls should NOT be visible
    expect(screen.queryByText(/Página/i)).toBeNull();
    expect(screen.queryByTestId("chevron-left")).toBeNull();
  });

  it("renders pagination controls when there are multiple pages", () => {
    render(<TablePagination {...defaultProps} totalItems={30} pageSize={10} />);
    
    expect(screen.getByText(/Página/i)).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText(/DE 3/i)).toBeDefined();
    expect(screen.getByTestId("chevron-left")).toBeDefined();
    expect(screen.getByTestId("chevron-right")).toBeDefined();
  });

  it("uses custom totalLabel", () => {
    render(<TablePagination {...defaultProps} totalItems={5} totalLabel="ítems" />);
    // Use regex to find "ítems" anywhere in the text
    expect(screen.getAllByText(/ítems/i).length).toBeGreaterThan(0);
  });
});
