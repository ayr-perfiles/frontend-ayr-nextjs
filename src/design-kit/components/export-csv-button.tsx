"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { csvDateStamp, downloadCsv, toCsv, type CsvColumn } from "../lib/csv";
import { getStrings } from "../strings/es";

type ExportCsvButtonProps<T> = {
  rows: T[];
  columns: CsvColumn<T>[];
  /** Sin extensión: se le añade la fecha y `.csv`. */
  fileName: string;
  label?: string;
  variant?: "outline" | "secondary" | "ghost" | "default";
  size?: "default" | "sm";
  disabled?: boolean;
};

/**
 * Descarga las filas que ya están en el cliente como CSV (con BOM, para que
 * Excel respete los acentos). Se deshabilita solo cuando no hay nada que
 * exportar. Requiere `<Toaster />` montado para el aviso de éxito.
 */
export function ExportCsvButton<T>({
  rows,
  columns,
  fileName,
  label,
  variant = "outline",
  size = "default",
  disabled,
}: ExportCsvButtonProps<T>) {
  const t = getStrings().common;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || rows.length === 0}
      data-testid="export-csv"
      onClick={() => {
        downloadCsv(`${fileName}-${csvDateStamp()}.csv`, toCsv(rows, columns));
        toast.success(`${t.exportCsv}: ${rows.length}`);
      }}
    >
      <Download aria-hidden />
      {label ?? t.exportCsv}
    </Button>
  );
}
