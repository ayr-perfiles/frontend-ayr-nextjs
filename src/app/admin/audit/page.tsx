"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { useAuditLogs } from "@/core/hooks/useAuditLogs";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditTable } from "@/components/audit/AuditTable";
import { TablePagination } from "@/components/ui/TablePagination";

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(15);

  const { logs, loading, totalCount, currentPage, nextPage, prevPage } = useAuditLogs({
    pageSize, searchTerm, actionFilter, startDate, endDate,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <ShieldAlert className="text-purple-600" /> Registro de Auditoría
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Supervisa las acciones críticas realizadas por tu equipo en el sistema.
          </p>
        </div>
      </div>

      <AuditFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isSearching={loading && !!searchTerm}
      />

      <div className="space-y-4">
        <AuditTable logs={logs} isLoading={loading} currentPage={currentPage} pageSize={pageSize} />
        
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={(p) => {
            if (p > currentPage) nextPage();
            else prevPage();
          }}
          pageSizeOptions={[15, 50, 100]}
          onPageSizeChange={setPageSize}
          totalLabel="Acciones"
        />
      </div>
    </div>
  );
}
