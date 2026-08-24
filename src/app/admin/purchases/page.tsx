"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { 
  Truck, 
  Plus, 
  FileText, 
  Ban, 
  FileUp, 
  FileCode, 
  FileSpreadsheet 
} from "lucide-react";
import type { Purchase } from "@/core/purchases/types";
import { voidPurchase } from "@/core/purchases/service";
import toast from "react-hot-toast";
import { SunatCpeValidator } from "@/components/purchases/SunatCpeValidator";
import { SireRceImporter } from "@/components/purchases/SireRceImporter";
import { PurchaseXmlImporter } from "@/components/purchases/PurchaseXmlImporter";
import { PurchaseExcelImporter } from "@/components/purchases/PurchaseExcelImporter";

import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useTableData } from "@/hooks/useTableData";

import { useConfirm } from "@/context/ConfirmContext";

export default function PurchasesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<"SIRE" | "XML" | "EXCEL" | null>(null);

  const parseInvoice = (num: string) => {
    const parts = num.split("-");
    if (parts.length === 2) {
      return { serie: parts[0], numero: parts[1] };
    }
    return { serie: "", numero: num };
  };

  useEffect(() => {
    const q = query(
      collection(db, "purchases"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase));
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleVoid = async (id: string, invoiceNum: string) => {
    const res = await confirm({
      title: "Anular compra",
      message: `Factura ${invoiceNum}`,
      variant: "danger",
      confirmLabel: "Anular",
      requireInput: {
        label: "Motivo de anulación",
        required: true,
        placeholder: "Describe el motivo...",
      },
    });

    if (!res.confirmed) return;

    try {
      await voidPurchase(id, res.value);
      toast.success("Compra anulada correctamente.");
    } catch (error: any) {
      toast.error(error.message || "Error al anular compra.");
    }
  };

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
  } = useTableData<Purchase>({
    data: purchases,
    pageSize: 15,
    searchFields: [
      (p) => p.supplier.name,
      (p) => p.invoice.number,
      (p) => p.supplier.ruc,
    ],
    filters: {
      status: (p, v) => v === "TODOS" || p.status === v,
    },
  });

  const columns: ColumnDef<Purchase>[] = [
    {
      key: "invoice",
      header: "Fecha / Nº",
      render: (p) => (
        <div>
          <p className="font-bold text-slate-700 text-sm">{p.invoice.number}</p>
          <p className="text-[10px] text-slate-400 font-mono">
            {p.invoice.date.toDate().toLocaleDateString("es-PE")}
          </p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      render: (p) => (
        <div>
          <p className="font-bold text-slate-800 text-sm">{p.supplier.name}</p>
          <p className="text-xs text-slate-500 font-medium tracking-tight">RUC {p.supplier.ruc}</p>
        </div>
      ),
    },
    {
      key: "businessLine",
      header: "Línea",
      align: "center",
      render: (p) => (
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
          p.businessLine === 'roofing' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {p.businessLine}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total PEN",
      align: "right",
      render: (p) => (
        <div>
          <p className="font-black text-slate-700 text-sm">
            S/ {p.totalCostPEN.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          {p.invoice.currency === 'USD' && (
            <p className="text-[10px] text-slate-400 font-bold">
              $ {(p.totalCostPEN / p.invoice.exchangeRate).toFixed(2)} @ {p.invoice.exchangeRate}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      render: (p) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          p.status === 'REGISTRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {p.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      render: (p) => {
        if (p.status !== 'REGISTRADA') return null;
        
        return (
          <div className="flex items-center justify-center gap-3">
            <SunatCpeValidator 
              purchaseId={p.id!}
              invoiceData={{
                numRuc: p.supplier.ruc,
                codComp: "01", 
                ...parseInvoice(p.invoice.number),
                fechaEmision: p.invoice.date.toDate().toISOString().split('T')[0],
                monto: p.invoice.total
              }}
              validation={p.validacionSunat}
            />
            <RowActionsMenu
              items={[
                {
                  id: "void",
                  label: "Anular Compra",
                  icon: <Ban size={16} />,
                  variant: "danger",
                  onClick: () => handleVoid(p.id!, p.invoice.number),
                }
              ]}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800 tracking-tight">
            <Truck className="text-blue-600" /> Registro de Compras
          </h1>
          <p className="text-slate-500 text-sm font-medium italic">
            Entrada de mercadería y fijación de costos (PPP)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTool(activeTool === "SIRE" ? null : "SIRE")}
            className={`px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-2 transition hover:bg-slate-100 ${activeTool === "SIRE" ? "ring-2 ring-blue-500 bg-white" : ""}`}
          >
            <FileUp size={18} /> SIRE
          </button>
          <button
            onClick={() => setActiveTool(activeTool === "XML" ? null : "XML")}
            className={`px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-2 transition hover:bg-slate-100 ${activeTool === "XML" ? "ring-2 ring-blue-500 bg-white" : ""}`}
          >
            <FileCode size={18} /> XML
          </button>
          <button
            onClick={() => setActiveTool(activeTool === "EXCEL" ? null : "EXCEL")}
            className={`px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-2 transition hover:bg-slate-100 ${activeTool === "EXCEL" ? "ring-2 ring-blue-500 bg-white" : ""}`}
          >
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button
            onClick={() => router.push("/admin/purchases/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition active:scale-95 shadow-xl shadow-blue-100 uppercase text-xs tracking-widest"
          >
            <Plus size={20} /> Nueva Compra
          </button>
        </div>
      </div>

      {activeTool === "SIRE" && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SireRceImporter onFinished={() => setActiveTool(null)} />
        </div>
      )}

      {activeTool === "XML" && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <PurchaseXmlImporter />
        </div>
      )}

      {activeTool === "EXCEL" && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <PurchaseExcelImporter />
        </div>
      )}

      <TableFilters
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Buscar por proveedor, factura o RUC...",
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
              { value: "REGISTRADA", label: "Registradas" },
              { value: "ANULADA", label: "Anuladas" },
            ],
          },
        ]}
        onClearAll={() => {
          setSearchValue("");
          setFilterValue("status", "TODOS");
        }}
      />

      <DataTable
        columns={columns}
        data={pageItems}
        getRowKey={(p) => p.id!}
        isLoading={isLoading}
        currentPage={currentPage}
        pageSize={pageSize}
        emptyState={{
          icon: "FileText",
          title: "No se encontraron compras",
          description: "No hay compras registradas con los filtros actuales.",
        }}
      />

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalFiltered}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
