"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/lib/firebase/clientApp";
import { collection, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { CutOrder, Coil } from "@/types";
import { 
  Loader2, 
  Scissors, 
  Plus, 
  Receipt, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  Save,
} from "lucide-react";
import Link from "next/link";

import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";
import { useTableData } from "@/hooks/useTableData";

import ReceiveStripsModal from "@/core/coils/components/ReceiveStripsModal";
import UpdateInvoiceModal from "@/core/coils/components/UpdateInvoiceModal";
import VoidOrderModal from "@/core/coils/components/VoidOrderModal";
import SendToCutModal from "@/core/coils/components/SendToCutModal";
import { useAuth } from "@/context/AuthContext";
import toast from 'react-hot-toast';

export default function CutOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CutOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<CutOrder | null>(null);
  const [updatingInvoiceOrder, setUpdatingInvoiceOrder] = useState<CutOrder | null>(null);
  const [voidingOrder, setVoidingOrder] = useState<CutOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ order: CutOrder; coils: Coil[] } | null>(null);
  const [isFetchingCoils, setIsFetchingCoils] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "cut_orders"), orderBy("sentAt", "desc"));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as CutOrder)));
    } catch (err) {
      console.error("Error fetching cut orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOpenEdit = async (order: CutOrder) => {
    setIsFetchingCoils(true);
    try {
      const coilRefs = order.coils.map(c => doc(db, "coils", c.coilId));
      const snaps = await Promise.all(coilRefs.map(ref => getDoc(ref)));
      const fullCoils = snaps.map(s => ({ id: s.id, ...s.data() } as Coil));
      setEditingOrder({ order, coils: fullCoils });
    } catch (err) {
      toast.error("Error al cargar datos de las bobinas.");
    } finally {
      setIsFetchingCoils(false);
    }
  };

  // ── Table Logic ─────────────────────────────────────────────────────────

  const {
    pageItems,
    currentPage,
    setCurrentPage,
    pageSize,
    searchValue,
    setSearchValue,
    filterValues,
    setFilterValue,
    totalFiltered,
  } = useTableData<CutOrder>({
    data: orders,
    pageSize: 15,
    searchFields: [(o) => o.tercero?.nombre ?? ""],
    filters: {
      status: (o, v) => o.status === v,
    },
  });

  const columns: ColumnDef<CutOrder>[] = [
    {
      key: "status",
      header: "Estado",
      align: "center",
      render: (row) => {
        const styles = {
          ENVIADO: "bg-blue-100 text-blue-700 border-blue-200",
          RECIBIDO: "bg-green-100 text-green-700 border-green-200",
          ANULADA: "bg-red-100 text-red-700 border-red-200",
        };
        return (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              styles[row.status as keyof typeof styles] || ""
            }`}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      key: "provider",
      header: "Proveedor",
      render: (row) => (
        <div>
          <p className="font-black text-slate-800 leading-none">
            {row.tercero.nombre}
          </p>
          {row.tercero.ruc && (
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
              RUC: {row.tercero.ruc}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "Fecha Envío",
      render: (row) =>
        row.sentAt?.toDate().toLocaleDateString("es-PE") || "Sin fecha",
    },
    {
      key: "responsible",
      header: "Responsable",
      render: (row) => (
        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
          {row.sentBy.split("@")[0]}
        </span>
      ),
    },
    {
      key: "coils",
      header: "Bobinas",
      align: "center",
      render: (row) => (
        <span className="bg-slate-100 px-2 py-1 rounded-lg text-[11px] font-black text-slate-600">
          {row.coils.length}
        </span>
      ),
    },
    {
      key: "sentWeight",
      header: "Peso Enviado",
      align: "right",
      render: (row) => (
        <span className="font-black text-slate-700">
          {row.sentWeightTotal.toLocaleString()} <small className="text-[10px] opacity-40">kg</small>
        </span>
      ),
    },
    {
      key: "receivedWeight",
      header: "Peso Recibido",
      align: "right",
      render: (row) => (
        <span className="font-black text-emerald-600">
          {row.receivedWeightTotal?.toLocaleString() || "—"}
        </span>
      ),
    },
    {
      key: "merma",
      header: "Merma",
      align: "right",
      render: (row) => {
        const merma =
          row.status === "RECIBIDO" && row.receivedWeightTotal
            ? row.sentWeightTotal - row.receivedWeightTotal
            : null;
        return (
          <span className="font-black text-red-500">
            {merma !== null ? `${merma.toLocaleString()} kg` : "—"}
          </span>
        );
      },
    },
    {
      key: "invoice",
      header: "Factura",
      render: (row) => (
        <span
          className={`text-[11px] font-black ${
            row.invoice?.number ? "text-blue-600" : "text-slate-300 italic"
          }`}
        >
          {row.invoice?.number || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      render: (row) => {
        if (row.status === "ANULADA") {
          return (
            <div className="flex justify-center">
              <div className="relative group/tooltip">
                <AlertCircle size={18} className="text-red-300" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-white text-[10px] rounded-2xl shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50">
                  <p className="font-black uppercase tracking-widest mb-1 text-red-400">
                    Motivo de Anulación
                  </p>
                  <p className="font-medium italic">
                    {row.voidReason || "Sin motivo especificado"}
                  </p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                </div>
              </div>
            </div>
          );
        }

        const items: RowAction[] = [];

        if (row.status === "ENVIADO") {
          items.push(
            {
              id: "receive",
              label: "Registrar Recepción",
              icon: <Save size={16} />,
              variant: "primary",
              onClick: () => setSelectedOrder(row),
            },
            {
              id: "edit",
              label: "Editar Orden",
              icon: <Edit2 size={16} />,
              onClick: () => handleOpenEdit(row),
            }
          );
        }

        if (row.status === "RECIBIDO") {
          items.push({
            id: "invoice",
            label: row.invoice?.number ? "Ajustar Factura" : "Cargar Factura",
            icon: <Receipt size={16} />,
            onClick: () => setUpdatingInvoiceOrder(row),
          });
        }

        items.push({
          id: "void",
          label: "Anular Orden",
          icon: <Trash2 size={16} />,
          variant: "danger",
          section: "danger",
          onClick: () => setVoidingOrder(row),
        });

        return <RowActionsMenu items={items} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Scissors className="text-blue-600" /> Órdenes de Corte (Tercerizado)
          </h1>
          <p className="text-sm text-slate-500 font-medium italic">Gestión de bobinas enviadas a slitter externo para Drywall.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isFetchingCoils && (
             <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
               <Loader2 size={14} className="animate-spin" /> Cargando Datos...
             </div>
          )}
        </div>
      </header>

      <TableFilters
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Buscar proveedor...",
        }}
        filterGroups={[
          {
            id: "status",
            label: "Estado",
            layout: "list",
            value: filterValues.status || "TODOS",
            onChange: (v) => setFilterValue("status", v),
            options: [
              { value: "TODOS", label: "Todas" },
              { value: "ENVIADO", label: "Enviadas" },
              { value: "RECIBIDO", label: "Recibidas" },
              { value: "ANULADA", label: "Anuladas" },
            ],
          },
        ]}
        onClearAll={() => {
          setSearchValue("");
          setFilterValue("status", "TODOS");
        }}
        rightSlot={
          <Link
            href="/admin/coils"
            className="flex-1 md:flex-none text-center px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-blue-600 transition shadow-xl shadow-slate-200 uppercase tracking-widest"
          >
            <Plus size={18} /> Nueva Orden
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={pageItems}
        getRowKey={(o) => o.id!}
        isLoading={isLoading}
        currentPage={currentPage}
        pageSize={pageSize}
        emptyState={{
          icon: "Scissors",
          title: "No hay órdenes de corte registradas",
          description: orders.length === 0 
            ? "Envía bobinas a corte desde el inventario de bobinas."
            : "No hay órdenes con esos filtros.",
        }}
      />

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalFiltered}
        onPageChange={setCurrentPage}
      />

      {/* MODALS */}
      {selectedOrder && (
        <ReceiveStripsModal 
          order={selectedOrder}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null);
            fetchOrders();
          }}
        />
      )}

      {updatingInvoiceOrder && (
        <UpdateInvoiceModal 
          order={updatingInvoiceOrder}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setUpdatingInvoiceOrder(null)}
          onSuccess={() => {
            setUpdatingInvoiceOrder(null);
            fetchOrders();
          }}
        />
      )}

      {voidingOrder && (
        <VoidOrderModal 
          order={voidingOrder}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setVoidingOrder(null)}
          onSuccess={() => {
            setVoidingOrder(null);
            fetchOrders();
          }}
        />
      )}

      {editingOrder && (
        <SendToCutModal 
          initialOrder={editingOrder.order}
          coils={editingOrder.coils}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            setEditingOrder(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}

