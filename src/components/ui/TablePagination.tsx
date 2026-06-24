import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  totalLabel?: string;
  mode?: "pages" | "cursor";
}

export function TablePagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  totalLabel = "registros",
  mode = "pages",
}: TablePaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const isCursor = mode === "cursor";

  const isNextDisabled = isCursor
    ? currentPage * pageSize >= totalItems
    : currentPage >= totalPages;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white border-t border-slate-100 rounded-b-xl shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
      {/* IZQUIERDA: Total de registros */}
      <div className="flex-1 flex justify-start">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          {isCursor ? "MOSTRANDO " : "OPERACIONES ENCONTRADAS / "}
          {isCursor ? (
            <>
              {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, totalItems)} DE{" "}
            </>
          ) : null}
          <span className="text-blue-600 mx-1 text-sm">{totalItems}</span> {totalLabel}
        </span>
      </div>

      {/* CENTRO: Controles de página */}
      <div className="flex-1 flex justify-center min-h-[40px]">
        {(isCursor || totalPages > 1) && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
              Página <span className="font-black text-slate-800 text-sm mx-1">{currentPage}</span>
              {!isCursor && totalPages > 0 && <span className="text-slate-400 font-medium">DE {totalPages}</span>}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={isNextDisabled}
              className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* DERECHA: Selector de tamaño de página */}
      <div className="flex-1 flex justify-end">
        {onPageSizeChange && pageSizeOptions && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm cursor-pointer hover:bg-slate-50"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} ítems
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
