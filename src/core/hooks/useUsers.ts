"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { fetchUsersPaginated, AppUser } from "@/services/userService";

export interface UsersFilters {
  pageSize: number;
  searchTerm: string;
  roleFilter: string;
  statusFilter: string;
}

type Cursor = QueryDocumentSnapshot<DocumentData> | null;

export function useUsers(filters: UsersFilters) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.searchTerm);

  const firstDocRef = useRef<Cursor>(null);
  const lastDocRef = useRef<Cursor>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.searchTerm), 400);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const loadData = useCallback(
    async (dir: "first" | "next" | "prev" = "first") => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchUsersPaginated({
          pageSize: filters.pageSize,
          searchTerm: debouncedSearch,
          roleFilter: filters.roleFilter,
          statusFilter: filters.statusFilter,
          direction: dir,
          cursorDoc: dir === "next" ? lastDocRef.current : dir === "prev" ? firstDocRef.current : null,
        });
        setUsers(res.users);
        firstDocRef.current = (res.firstDoc ?? null) as Cursor;
        lastDocRef.current = (res.lastDoc ?? null) as Cursor;
        setTotalCount(res.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar usuarios");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, filters.pageSize, filters.roleFilter, filters.statusFilter],
  );

  useEffect(() => {
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
    void loadData("first");
  }, [loadData]);

  const hasNextPage = users.length === filters.pageSize;

  const nextPage = useCallback(() => {
    if (!hasNextPage) return;
    setCurrentPage((p) => p + 1);
    void loadData("next");
  }, [hasNextPage, loadData]);

  const prevPage = useCallback(() => {
    if (currentPage <= 1) return;
    setCurrentPage((p) => p - 1);
    void loadData("prev");
  }, [currentPage, loadData]);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
    void loadData("first");
  }, [loadData]);

  return { users, loading, error, totalCount, currentPage, hasNextPage, nextPage, prevPage, refresh };
}
