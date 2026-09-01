import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/design-kit/components/ui/pagination";
import { Button } from "@/design-kit/components/ui/button";

/**
 * TANDA 21 — pieza 3 de 4 del re-skin.
 *
 * API PÚBLICA BYTE-IDÉNTICA: `TablePaginationProps` no cambia y ningún
 * consumidor se toca.
 *
 * QUÉ SE ADOPTA, y qué se gana: los controles pasan a vivir dentro de
 * `Pagination`/`PaginationContent`/`PaginationItem`, que aportan la semántica
 * que la versión anterior NO tenía — `<nav role="navigation"
 * aria-label="pagination">` con una lista real de ítems, en vez de un `<div>`
 * suelto. Las dos flechas pasan al `Button` del kit, que agrega
 * `focus-visible` ring y `disabled:pointer-events-none` sobre el
 * `disabled:opacity-50` que ya había.
 *
 * QUÉ NO SE USA, medido y declarado: `PaginationLink`/`PaginationPrevious`/
 * `PaginationNext` del kit renderizan un `<a>` y esperan un `href` — son
 * href-driven, para paginación por ruta. Esta pieza es callback-driven
 * (`onPageChange`) sobre estado de cliente; usarlos obligaría a emitir un `<a>`
 * sin `href`, que no es focusable ni es un botón. Se usan los CONTENEDORES del
 * kit y `Button` para lo clickeable. (La divergencia estaba medida desde el
 * recon del kit en la Tanda 16; acá se confirma leyendo `pagination.tsx`.)
 *
 * EL `<select>` DE TAMAÑO NO SE TOCA, y el motivo no es pereza: el `Select` del
 * kit es Radix, que reemplaza el `<select>` nativo por un listbox en portal.
 * Eso (a) cambia el DOM de un control que ya es accesible de fábrica y (b)
 * importa 3 íconos nuevos de `lucide-react`, lo que dejaría incompleto el mock
 * enumerado de `TablePagination.test.tsx` y pondría ese archivo en rojo por el
 * harness. Se declara como no adoptado, no se disimula.
 */

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

const ARROW_CLASSES =
  "w-10 h-10 bg-white text-slate-600 rounded-xl border border-slate-200 shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed";

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
          <Pagination className="mx-0 w-auto">
            <PaginationContent className="gap-3">
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Página anterior"
                  className={ARROW_CLASSES}
                >
                  <ChevronLeft size={20} className="size-5" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
                  Página <span className="font-black text-slate-800 text-sm mx-1">{currentPage}</span>
                  {!isCursor && totalPages > 0 && <span className="text-slate-400 font-medium">DE {totalPages}</span>}
                </div>
              </PaginationItem>

              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={isNextDisabled}
                  aria-label="Página siguiente"
                  className={ARROW_CLASSES}
                >
                  <ChevronRight size={20} className="size-5" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
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
