import React from "react";
import { Building2, MapPin, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";

export interface Customer {
  id: string;
  name: string;
  address?: string;
  contactIds?: string[];
}

interface CustomerTableProps {
  customers: Customer[];
  isLoading: boolean;
  currentPage: number;
  pageSize: number;
}

export function CustomerTable({
  customers,
  isLoading,
  currentPage,
  pageSize,
}: CustomerTableProps) {
  const router = useRouter();

  const columns: ColumnDef<Customer>[] = [
    {
      key: "name",
      header: "Razón Social / Documento",
      render: (customer) => (
        <div className="flex flex-col">
          <p className="font-black text-slate-800 text-sm flex items-center gap-2">
            <Building2 size={16} className="text-blue-500" />{" "}
            {customer.name}
          </p>
          <p className="text-xs font-bold text-slate-400 mt-0.5 ml-6">
            {customer.id}
          </p>
        </div>
      ),
    },
    {
      key: "address",
      header: "Dirección Fiscal",
      render: (customer) => (
        <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
          <MapPin size={14} className="text-slate-400" />{" "}
          {customer.address || "No registrada"}
        </p>
      ),
    },
    {
      key: "contacts",
      header: "Contactos",
      align: "center",
      render: (customer) => (
        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-lg text-xs border border-slate-200">
          {customer.contactIds?.length || 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      width: "w-28",
      render: (customer) => (
        <button
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition"
          title="Ver Perfil"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/customers/${customer.id}`);
          }}
        >
          <Eye size={18} />
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      getRowKey={(c) => c.id}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[800px]"
      onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
      emptyState={{
        icon: "Users",
        title: "No hay clientes",
        description: "No se encontraron clientes con esos parámetros.",
      }}
    />
  );
}
