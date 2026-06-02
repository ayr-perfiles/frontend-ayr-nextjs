"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { useCustomers } from "@/core/hooks/useCustomers";
import { CustomerFilters } from "@/components/crm/CustomerFilters";
import { CustomerTable, Customer } from "@/components/crm/CustomerTable";
import { TablePagination } from "@/components/ui/TablePagination";

export default function CustomersListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(15);

  const { customers, loading, filteredTotal, currentPage, hasNextPage, nextPage, prevPage } = useCustomers({
    pageSize, searchTerm,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" /> Cartera de Clientes (CRM)
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Gestiona tus empresas, contactos e historial de compras de forma centralizada.
          </p>
        </div>
      </div>

      <CustomerFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={loading && searchTerm !== ""}
      />

      <CustomerTable
        customers={customers as unknown as Customer[]}
        isLoading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
      />

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={filteredTotal}
        totalLabel="empresas"
        onPageChange={(page) => {
          if (page > currentPage) nextPage();
          else prevPage();
        }}
        pageSizeOptions={[15, 30, 50]}
        onPageSizeChange={(size) => setPageSize(size)}
      />
    </div>
  );
}
