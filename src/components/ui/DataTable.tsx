import { ReactNode } from "react";
import { TableSkeleton } from "./TableSkeleton";
import { EmptyState } from "./EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/design-kit/components/ui/table";

/**
 * TANDA 21 — pieza 4 de 4 del re-skin.
 *
 * API PÚBLICA BYTE-IDÉNTICA: `ColumnDef<T>` y `DataTableProps<T>` no cambian y
 * ningún consumidor se toca. Lo que cambia son las etiquetas de tabla.
 *
 * QUÉ SE ADOPTA: los `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` crudos
 * pasan a las primitivas del kit, que traen `data-slot` (enganche de estilo
 * uniforme para todo el sistema), el contenedor con scroll horizontal propio, y
 * el `[&_tr:last-child]:border-0` que hace innecesario el `divide-y` a mano.
 *
 * QUÉ SE PRESERVA A PROPÓSITO: la identidad visual de AYR viaja por `className`
 * y gana la cascada — `tailwind-merge` resuelve cada conflicto a favor del
 * último. El wrapper externo se queda SOLO con `min-h-[250px]`: el
 * `overflow-x-auto` ya lo aporta el contenedor de `Table`, y duplicarlo
 * anidaría dos scrollers.
 *
 * ⚠️ TRES CLASES DEL KIT SE NEUTRALIZAN EXPLÍCITAMENTE. Se listan porque son la
 * clase de detalle que un re-skin "no-op" esconde — pero OJO con el estado de
 * evidencia de cada una, que NO es el mismo:
 *
 *   1. `whitespace-nowrap` en `TableHead` y `TableCell`. La versión anterior
 *      dejaba envolver el texto; con `nowrap`, cualquier celda larga deja de
 *      envolver y la fila cambia de alto. Se repone `whitespace-normal`.
 *
 *   2. `has-aria-expanded:bg-muted/50` en `TableRow` — NEUTRALIZACIÓN
 *      DEFENSIVA, CON SU PREMISA REFUTADA POR MEDICIÓN. Se puso creyendo que
 *      el selector matchea por PRESENCIA del atributo (`&:has([aria-expanded])`)
 *      y que, como el trigger de `RowActionsMenu` emite `aria-expanded="false"`
 *      siempre, TODAS las filas con menú quedarían pintadas de `muted`.
 *      **Medido: falso.** Quitar la neutralización y volver a capturar dio
 *      **0.0000% en las 12 pantallas**, incluida la que tiene el menú ABIERTO.
 *      La causa exacta quedó SIN determinar — puede ser que la variante exija
 *      `[aria-expanded="true"]`, o que la clase directamente no se emita al CSS.
 *      La segunda hipótesis importaría bastante más que esta pieza, así que
 *      queda anotada como frente propio. La línea se conserva por defensiva,
 *      declarada SIN EFECTO MEDIDO — no como un fix que hizo algo.
 *
 *   3. El borde divisorio. `TableRow` trae `border-b` sin color, que caería en
 *      el `--border` del reset universal (`#dee2e5`) en vez del `slate-50` de
 *      AYR. Se repone el color en cada fila; el ancho lo pone el kit.
 *
 * `TableFooter`/`TableCaption` del kit NO se usan — esta pieza no tiene pie ni
 * leyenda, y el pie de la tabla es `TablePagination`, que es una pieza aparte.
 */

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
  width?: string;
  render: (row: T, rowNumber: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string;
  isLoading?: boolean;
  currentPage: number;
  pageSize: number;
  showRowNumber?: boolean;
  emptyState: { icon: string; title: string; description: string };
  minWidth?: string;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
}

/** Filas que no son de datos (header, emptyState, aviso de refetch). */
const PLAIN_ROW = "border-b-0 hover:bg-transparent has-aria-expanded:bg-transparent";

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  currentPage,
  pageSize,
  showRowNumber = true,
  emptyState,
  minWidth = "min-w-[950px]",
  onRowClick,
  getRowClassName,
}: DataTableProps<T>) {
  const totalColumns = columns.length + (showRowNumber ? 1 : 0);

  if (isLoading && data.length === 0) {
    return <TableSkeleton rows={7} columns={totalColumns} />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="min-h-[250px]">
        <Table className={`text-left ${minWidth} border-collapse`}>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="border-slate-100 hover:bg-transparent has-aria-expanded:bg-transparent">
              {showRowNumber && (
                <TableHead className="p-4 h-auto whitespace-normal text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-12">
                  #
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`p-4 h-auto whitespace-normal text-xs font-bold text-slate-500 uppercase tracking-wider ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.width || ""} ${col.headerClassName || ""}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && data.length === 0 ? (
              <TableRow className={PLAIN_ROW}>
                <TableCell colSpan={totalColumns} className="p-0 whitespace-normal">
                  <EmptyState {...emptyState} />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => {
                const rowNumber = (currentPage - 1) * pageSize + index + 1;
                const customClassName = getRowClassName ? getRowClassName(row) : "";

                return (
                  <TableRow
                    key={getRowKey(row, index)}
                    onClick={() => onRowClick?.(row)}
                    className={`group border-slate-50 has-aria-expanded:bg-transparent transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${customClassName || "hover:bg-blue-50/20"}`}
                  >
                    {showRowNumber && (
                      <TableCell className="p-4 whitespace-normal text-center">
                        <span className="text-xs font-bold text-slate-400">
                          {rowNumber}
                        </span>
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`p-4 whitespace-normal text-sm font-medium text-slate-600 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        } ${col.cellClassName || ""}`}
                      >
                        {col.render(row, rowNumber)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
            {isLoading && data.length > 0 && (
              <TableRow className={PLAIN_ROW}>
                <TableCell colSpan={totalColumns} className="p-4 whitespace-normal text-center">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    Actualizando...
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * EJEMPLO DE USO INTEGRADO (PLANTILLA):
 *
 * import { DataTable, ColumnDef } from "@/components/ui/DataTable";
 * import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
 * import { TablePagination } from "@/components/ui/TablePagination";
 * import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";
 * import { useTableData } from "@/hooks/useTableData";
 * import { Edit, Trash, Eye } from "lucide-react";
 *
 * const MyListPage = () => {
 *   const {
 *     pageItems, currentPage, setCurrentPage, pageSize, setPageSize, searchValue, setSearchValue,
 *     filterValues, setFilterValue, totalFiltered
 *   } = useTableData<MyType>({
 *     data: allData,
 *     searchFields: ['name', 'code', (r) => r.customer.name],
 *     filters: {
 *       status: (row, val) => row.status === val
 *     }
 *   });
 *
 *   const columns: ColumnDef<MyType>[] = [
 *     {
 *       key: 'name',
 *       header: 'Nombre',
 *       render: (row) => <span className="font-bold">{row.name}</span>
 *     },
 *     {
 *       key: 'actions',
 *       header: 'Acciones',
 *       align: 'center',
 *       width: 'w-20',
 *       render: (row) => {
 *         const actions: RowAction[] = [
 *           { id: 'view', label: 'Ver Detalle', icon: <Eye size={16}/>, onClick: () => handleView(row) },
 *           { id: 'edit', label: 'Editar', icon: <Edit size={16}/>, onClick: () => handleEdit(row), section: 'danger' },
 *           { id: 'delete', label: 'Eliminar', icon: <Trash size={16}/>, onClick: () => handleDelete(row), variant: 'danger', section: 'danger' },
 *         ];
 *         return <RowActionsMenu items={actions} />;
 *       }
 *     }
 *   ];
 *
 *   return (
 *     <div className="space-y-4">
 *       <TableFilters
 *         search={{ value: searchValue, onChange: setSearchValue, placeholder: "Buscar..." }}
 *         filterGroups={[
 *           {
 *             id: 'status',
 *             label: 'Estado',
 *             value: filterValues.status || 'ALL',
 *             onChange: (v) => setFilterValue('status', v),
 *             options: [
 *               { value: 'ALL', label: 'Todos' },
 *               { value: 'ACTIVE', label: 'Activos' },
 *               { value: 'INACTIVE', label: 'Inactivos' }
 *             ],
 *             layout: 'list'
 *           }
 *         ]}
 *       />
 *       <DataTable
 *         columns={columns}
 *         data={pageItems}
 *         getRowKey={(r) => r.id}
 *         currentPage={currentPage}
 *         pageSize={pageSize}
 *         emptyState={{ icon: 'Package', title: 'Sin datos', description: 'No hay elementos para mostrar.' }}
 *       />
 *       <TablePagination
 *         currentPage={currentPage}
 *         pageSize={pageSize}
 *         totalItems={totalFiltered}
 *         onPageChange={setCurrentPage}
 *         pageSizeOptions={[15, 30, 50]}
 *         onPageSizeChange={setPageSize}
 *       />
 *     </div>
 *   );
 * };
 */
