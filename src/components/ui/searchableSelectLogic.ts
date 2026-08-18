export function filterSearchableOptions<T>(
  options: T[],
  query: string,
  getSearchText: (opt: T) => string[]
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((opt) =>
    getSearchText(opt).some((field) => (field ?? "").toLowerCase().includes(normalizedQuery)),
  );
}
