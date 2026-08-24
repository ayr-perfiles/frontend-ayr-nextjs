import React from "react";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";

interface SalesFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  onClear: () => void;
  businessLine: string;
  setBusinessLine: (val: "ALL" | "drywall" | "roofing" | "metallic-roofing" | "trading" | "services") => void;
  sunatFilter: string;
  setSunatFilter: (val: string) => void;
}

export function SalesFilters(props: SalesFiltersProps) {
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    onClear,
    businessLine,
    setBusinessLine,
    sunatFilter,
    setSunatFilter,
  } = props;

  const filterGroups: FilterGroup[] = [
    {
      id: "status",
      label: "Estado",
      layout: "list",
      value: statusFilter,
      onChange: (v) => setStatusFilter(v as string),
      options: [
        // Frente #9-B.1: cotizaciones (QUOTATION/CONVERTED, incl. perchas COT-*) viven en
        // /admin/quotations desde #9-A — sacadas de acá para que /admin/sales no pueda
        // volver a mostrarlas ni por filtro. "Todas" sigue trayendo COMPLETED+VOIDED
        // (whitelist de buildListStatusFilter, sin tocar).
        { value: "ALL", label: "Todas las Operaciones" },
        { value: "COMPLETED", label: "Ventas Cerradas" },
      ],
    },
    {
      id: "businessLine",
      label: "Línea de Negocio",
      layout: "grid",
      value: businessLine,
      onChange: (val) => setBusinessLine(val as any),
      options: [
        { value: "ALL", label: "Todas" },
        { value: "drywall", label: "Drywall", cls: "text-blue-600" },
        { value: "roofing", label: "UPVC", cls: "text-emerald-600" },
        { value: "metallic-roofing", label: "Aluzinc", cls: "text-zinc-600" },
        { value: "trading", label: "Reventa", cls: "text-amber-600" },
        { value: "services", label: "Servicios", cls: "text-violet-600" },
      ],
    },
    {
      id: "sunat",
      label: "Estado SUNAT",
      layout: "grid-2",
      value: sunatFilter,
      onChange: (v) => setSunatFilter(v as string),
      options: [
        { value: "ALL", label: "Todos" },
        { value: "ACEPTADO", label: "Aceptado", cls: "text-emerald-600" },
        { value: "RECHAZADO", label: "Rechazado", cls: "text-red-600" },
        { value: "PENDIENTE", label: "Pendiente", cls: "text-blue-600" },
        { value: "BAJA_ACEPTADA", label: "Anulado", cls: "text-slate-500" },
        { value: "NO_EMITIDO", label: "No Emitido", cls: "text-slate-400" },
      ],
    },
  ];

  const handleClearAll = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("ALL");
    setBusinessLine("ALL");
    setSunatFilter("ALL");
    setSearchTerm("");
    onClear();
  };

  return (
    <TableFilters
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Buscar cliente, documento o correlativo...",
        onClear: () => setSearchTerm(""),
      }}
      filterGroups={filterGroups}
      dateRange={{
        startDate,
        endDate,
        setStartDate,
        setEndDate,
      }}
      onClearAll={handleClearAll}
    />
  );
}
