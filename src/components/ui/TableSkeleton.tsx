const COL_WIDTHS = ["w-24", "w-40", "w-32", "w-20", "w-28", "w-16", "w-20"];

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  const widths = COL_WIDTHS.slice(0, columns);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex gap-6 px-6 py-3 bg-slate-50 border-b border-slate-100">
        {widths.map((w, i) => (
          <div key={i} className={`h-2.5 bg-slate-200 rounded ${w}`} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-6 px-6 py-4 border-b border-slate-50 last:border-0">
          {widths.map((w, colIdx) => (
            <div
              key={colIdx}
              className={`h-4 bg-slate-100 rounded ${w} ${colIdx % 2 === 0 ? "opacity-80" : "opacity-60"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
