import { ReactNode } from "react";
import { TableSkeleton } from "./TableSkeleton";
import { EmptyState } from "./EmptyState";

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
      <div className={`overflow-x-auto min-h-[250px]`}>
        <table className={`w-full text-left ${minWidth} border-collapse`}>
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              {showRowNumber && (
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-12">
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-4 text-xs font-bold text-slate-500 uppercase tracking-wider ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.width || ""} ${col.headerClassName || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={totalColumns}>
                  <EmptyState {...emptyState} />
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const rowNumber = (currentPage - 1) * pageSize + index + 1;
                const customClassName = getRowClassName ? getRowClassName(row) : "";
                
                return (
                  <tr
                    key={getRowKey(row, index)}
                    onClick={() => onRowClick?.(row)}
                    className={`group transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${customClassName || "hover:bg-blue-50/20"}`}
                  >
                    {showRowNumber && (
                      <td className="p-4 text-center">
                        <span className="text-xs font-bold text-slate-400">
                          {rowNumber}
                        </span>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`p-4 text-sm font-medium text-slate-600 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        } ${col.cellClassName || ""}`}
                      >
                        {col.render(row, rowNumber)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
            {isLoading && data.length > 0 && (
               <tr>
                <td colSpan={totalColumns} className="p-4 text-center">
                   <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                     Actualizando...
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

