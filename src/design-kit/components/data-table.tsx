import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { getStrings } from "../strings/es";
import { cn } from "../lib/utils";

export type DataTableColumn<T> = {
  /** Identificador estable de la columna; se usa como `key` de React. */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "start" | "center" | "end";
  /** Clases aplicadas a la cabecera y a las celdas: anchos, `hidden md:table-cell`… */
  className?: string;
  /** Cabecera solo para lectores de pantalla (columna de acciones, por ejemplo). */
  srOnlyHeader?: boolean;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Qué mostrar sin filas. Por defecto, una fila con el texto "sin resultados". */
  empty?: ReactNode;
  /** Envoltura con borde redondeado y scroll horizontal. */
  bordered?: boolean;
  className?: string;
};

const alignClass = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

/**
 * Envoltura de tabla que GSM repite en todos sus listados: borde redondeado,
 * scroll horizontal, cabeceras alineables y un estado vacío integrado.
 *
 * Es puramente de presentación: no ordena, no pagina ni consulta datos. Para la
 * paginación, `PaginationNav`; el formato de cada celda lo decide `cell`.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  bordered = true,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn(bordered && "overflow-x-auto rounded-xl border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(column.align && alignClass[column.align], column.className)}
              >
                {column.srOnlyHeader ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground h-24 text-center"
              >
                {empty ?? getStrings().common.noResults}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.align && alignClass[column.align], column.className)}
                  >
                    {column.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
