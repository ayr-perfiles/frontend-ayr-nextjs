import React from "react";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";

interface UserFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  roleFilter: string;
  setRoleFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  isSearching: boolean;
}

export function UserFilters({
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  isSearching,
}: UserFiltersProps) {
  const filterGroups: FilterGroup[] = [
    {
      id: "role",
      label: "Nivel de Acceso",
      value: roleFilter,
      onChange: (v) => setRoleFilter(v),
      options: [
        { value: "ALL", label: "Todos los Niveles" },
        { value: "ADMIN", label: "Gerencia (Admin)" },
        { value: "SUPERVISOR", label: "Jefes de Planta" },
        { value: "OPERATOR", label: "Operarios" },
      ],
      layout: "list",
    },
    {
      id: "status",
      label: "Estado del Acceso",
      value: statusFilter,
      onChange: (v) => setStatusFilter(v),
      options: [
        { value: "ALL", label: "Todos" },
        { value: "ACTIVE", label: "Activos" },
        { value: "INACTIVE", label: "Suspendidos" },
      ],
      layout: "list",
    },
  ];

  const handleClearAll = () => {
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setSearchTerm("");
  };

  return (
    <TableFilters
      search={{
        value: searchTerm,
        onChange: (val) => setSearchTerm(val.toLowerCase()),
        placeholder: "Buscar por correo electrónico...",
        isSearching,
      }}
      filterGroups={filterGroups}
      onClearAll={handleClearAll}
    />
  );
}
