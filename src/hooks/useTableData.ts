import { useState, useMemo, useEffect } from "react";

interface UseTableDataProps<T> {
  data: T[];
  pageSize?: number;
  searchFields?: (keyof T | ((row: T) => string))[];
  filters?: { [filterId: string]: (row: T, value: string) => boolean };
}

export function useTableData<T>({
  data,
  pageSize: initialPageSize = 15,
  searchFields = [],
  filters = {},
}: UseTableDataProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<{ [filterId: string]: string }>({});

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, filterValues]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // 1. Search filter
      if (searchValue && searchFields.length > 0) {
        const searchMatches = searchFields.some((field) => {
          const value = typeof field === "function" ? field(row) : String(row[field]);
          return value.toLowerCase().includes(searchValue.toLowerCase());
        });
        if (!searchMatches) return false;
      }

      // 2. Custom predicates (AND)
      for (const filterId in filterValues) {
        const filterVal = filterValues[filterId];
        const predicate = filters[filterId];

        // Convención: 'ALL', 'TODOS' o vacío ignora el filtro
        if (
          filterVal &&
          filterVal !== "ALL" &&
          filterVal !== "TODOS" &&
          predicate
        ) {
          if (!predicate(row, filterVal)) return false;
        }
      }

      return true;
    });
  }, [data, searchValue, filterValues, searchFields, filters]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const setFilterValue = (id: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [id]: value }));
  };

  return {
    pageItems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchValue,
    setSearchValue,
    filterValues,
    setFilterValue,
    totalFiltered: filteredData.length,
  };
}
