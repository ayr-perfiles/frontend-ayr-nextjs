import { useTableData } from "./useTableData";
import { renderHook, act } from "@testing-library/react";
import { expect, test, describe } from "vitest";

interface Item {
  id: string;
  name: string;
  category: string;
}

const mockData: Item[] = [
  { id: "1", name: "Apple", category: "Fruit" },
  { id: "2", name: "Banana", category: "Fruit" },
  { id: "3", name: "Carrot", category: "Vegetable" },
  { id: "4", name: "Date", category: "Fruit" },
  { id: "5", name: "Eggplant", category: "Vegetable" },
  { id: "6", name: "Fig", category: "Fruit" },
  { id: "7", name: "Grape", category: "Fruit" },
];

describe("useTableData", () => {
  test("should paginate data", () => {
    const { result } = renderHook(() =>
      useTableData({ data: mockData, pageSize: 2 })
    );

    expect(result.current.pageItems.length).toBe(2);
    expect(result.current.pageItems[0].name).toBe("Apple");

    act(() => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.pageItems[0].name).toBe("Carrot");
  });

  test("should search data (case-insensitive)", () => {
    const { result } = renderHook(() =>
      useTableData({
        data: mockData,
        searchFields: ["name"],
        pageSize: 10,
      })
    );

    act(() => {
      result.current.setSearchValue("BAN"); // should match Banana
    });

    expect(result.current.pageItems.length).toBe(1);
    expect(result.current.pageItems[0].name).toBe("Banana");
    expect(result.current.totalFiltered).toBe(1);
  });

  test("should filter data by predicate", () => {
    const { result } = renderHook(() =>
      useTableData({
        data: mockData,
        filters: {
          cat: (row, val) => row.category === val,
        },
        pageSize: 10,
      })
    );

    act(() => {
      result.current.setFilterValue("cat", "Vegetable");
    });

    expect(result.current.totalFiltered).toBe(2);
    expect(result.current.pageItems.every((i) => i.category === "Vegetable")).toBe(true);
  });

  test("should reset page when search or filter changes", () => {
    const { result } = renderHook(() =>
      useTableData({ data: mockData, pageSize: 2 })
    );

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.setSearchValue("Apple");
    });
    expect(result.current.currentPage).toBe(1);
  });
});
