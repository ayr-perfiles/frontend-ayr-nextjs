"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useTableData } from "@/hooks/useTableData";
import { ProductionRequest } from "@/types";
import { db } from "@/lib/firebase/clientApp";
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { ClipboardList, Plus, AlertCircle, Eye, X } from "lucide-react";
import { useConfirm } from "@/context/ConfirmContext";
import { ColumnDef } from "@/components/ui/DataTable";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { RequestModal } from "./RequestModal"; // We will create this

export default function ProductionRequestsPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const isAdminOrSupervisor = role === "ADMIN" || role === "SUPERVISOR";

  useEffect(() => {
    if (role && !isAdminOrSupervisor) {
      router.push("/admin");
    }
  }, [role, router, isAdminOrSupervisor]);

  const [data, setData] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [lineFilter, setLineFilter] = useState<string>("metallic-roofing");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = collection(db, "production_requests") as any;
      
      const filters = [];
      if (statusFilter !== "ALL") filters.push(where("status", "==", statusFilter));
      if (lineFilter !== "ALL") filters.push(where("businessLine", "==", lineFilter));
      
      q = query(q, ...filters, orderBy("createdAt", "desc"));
      
      const snap = await getDocs(q);
      const reqs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ProductionRequest));
      setData(reqs);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, lineFilter]);

  const table = useTableData<ProductionRequest>({
    data,
    pageSize: 15,
  });

  const confirm = useConfirm();

  const handleCancel = async (id: string) => {
    const ok = await confirm({
      title: "Cancelar Solicitud",
      message: "¿Estás seguro de cancelar esta solicitud de producción?",
      variant: "danger",
      requireInput: {
        label: "Confirmación requerida",
        matchValue: "CANCELAR",
        placeholder: "Escribe CANCELAR para confirmar"
      }
    });

    if (!ok) return;

    try {
      await updateDoc(doc(db, "production_requests", id), {
        status: "CANCELLED"
      });
      toast.success("Solicitud cancelada");
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Error al cancelar");
    }
  };

  const columns: ColumnDef<ProductionRequest>[] = [
    {
      key: "date",
      header: "Fecha",
      render: (row: ProductionRequest) => {
        if (!row.createdAt) return "-";
        const d = row.createdAt.toDate ? row.createdAt.toDate() : new Date(row.createdAt);
        return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
    { key: "sku", header: "SKU", render: (row: ProductionRequest) => row.targetSku },
    { 
      key: "qty",
      header: "Cantidad Requerida", 
      render: (row: ProductionRequest) => {
        let text = `${row.requestedQty} ML/UND`;
        if (row.piecesCount && row.pieceLengthM) {
          text = `${row.requestedQty} ML (${row.piecesCount} pz x ${row.pieceLengthM}m)`;
        } else if (row.piecesCount) {
          text = `${row.requestedQty} UND (${row.piecesCount} pz)`;
        }
        return text;
      }
    },
    { key: "solicitante", header: "Solicitante", render: (row: ProductionRequest) => row.requestedBy },
    { 
      key: "status",
      header: "Estado", 
      render: (row: ProductionRequest) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
          {row.status}
        </span>
      )
    },
    { key: "notes", header: "Notas", render: (row: ProductionRequest) => row.notes || "-" },
    {
      key: "actions",
      header: "",
      render: (row: ProductionRequest) => (
        <RowActionsMenu
          items={[
            {
              id: "cancel",
              label: "Cancelar",
              icon: <X size={16} />,
              variant: "danger",
              onClick: () => handleCancel(row.id!),
              hidden: row.status !== 'OPEN' || !isAdminOrSupervisor,
            }
          ]}
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2.5 rounded-xl">
            <ClipboardList size={22} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Solicitudes de Producción</h1>
            <p className="text-slate-500 font-medium text-sm">Gestiona los pedidos manuales a planta</p>
          </div>
        </div>
        {isAdminOrSupervisor && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition font-bold text-sm"
          >
            <Plus size={16} /> Nueva solicitud
          </button>
        )}
      </div>

      <TableFilters
        search={{
          placeholder: "Buscar por SKU...",
          value: table.searchValue,
          onChange: table.setSearchValue
        }}
        filterGroups={[
          {
            id: "status",
            label: "Estado",
            options: [
              { label: "Todos", value: "ALL" },
              { label: "Abiertos", value: "OPEN" },
              { label: "Cancelados", value: "CANCELLED" }
            ],
            value: statusFilter,
            onChange: (val) => setStatusFilter(val as string)
          },
          {
            id: "line",
            label: "Línea",
            options: [
              { label: "Todas", value: "ALL" },
              { label: "Aluzinc", value: "metallic-roofing" }
            ],
            value: lineFilter,
            onChange: (val) => setLineFilter(val as string)
          }
        ]}
      />

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable<ProductionRequest>
          columns={columns}
          data={table.pageItems}
          getRowKey={(row) => row.id || ''}
          isLoading={loading}
          currentPage={table.currentPage}
          pageSize={table.pageSize}
          emptyState={{ icon: "Inbox", title: "Sin solicitudes", description: "No se encontraron solicitudes." }}
        />
        <TablePagination
          currentPage={table.currentPage}
          totalItems={table.totalFiltered}
          onPageChange={table.setCurrentPage}
          pageSize={table.pageSize}
        />
      </div>

      {isModalOpen && (
        <RequestModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchRequests();
          }} 
        />
      )}
    </div>
  );
}
