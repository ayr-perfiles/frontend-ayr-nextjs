"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import * as XLSX from "xlsx";
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { Coil, CutOrder } from "@/types";
import { Plus, Scissors } from "lucide-react";
import toast from "react-hot-toast";
import { useCoils } from "@/core/coils/hooks/useCoils";

import {
  voidCoil,
  updateCoil,
  cancelCoilPlan,
  deleteCoilDraft,
  reverseCoilSplit,
} from "@/core/coils/services/coilService";
import { fetchAvailableCoilsForExport } from "@/core/coils/services/coilService";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { calcCoilTheoreticalML } from "@/modules/metallic-roofing/domain/yieldCalc";

import { InventoryFilters } from "@/core/coils/components/InventoryFilters";
import { EditData } from "@/core/coils/components/EditCoilModal";
import InventoryTable from "@/core/coils/components/InventoryTable";
import { HeaderOptions } from "@/core/coils/components/HeaderOptions";
import { InventoryMetrics } from "@/core/coils/components/InventoryMetrics";
import { InventoryModals } from "@/core/coils/components/InventoryModals";
import SendToCutModal from "@/core/coils/components/SendToCutModal";
import { TablePagination } from "@/components/ui/TablePagination";

export default function CoilsPage() {
  const { user, role } = useAuth();
  const confirm = useConfirm();
  
  // 1. Estados de UI y Filtros
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCutModal, setShowCutModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [finishFilter, setFinishFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const [metrics, setMetrics] = useState({
    byFinish: {} as Record<string, number>,
    byFinishML: {} as Record<string, number>,
    enTercero: 0,
    totalValuePEN: 0,
    totalAvailableKg: 0,
    alerts: {
      noFinish: 0,
      lowWeight: 0,
    },
  });

  const [orderMapping, setOrderMapping] = useState<Record<string, string>>({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCoil, setEditingCoil] = useState<Coil | null>(null);
  const [editData, setEditData] = useState<EditData>({
    initialWeight: 0,
    currentWeight: 0,
    masterWidth: 1200,
    thickness: 0.45,
    finish: "",
    pricePerKg: 0,
    currency: "PEN",
    exchangeRate: 3.80,
    providerDocType: "LOCAL",
    providerDoc: "",
    providerName: "",
    invoiceNumber: "",
    invoiceDate: "",
  });
  const [viewingCoil, setViewingCoil] = useState<Coil | null>(null);
  const [splittingCoil, setSplittingCoil] = useState<Coil | null>(null);
  const [scrappingCoil, setScrappingCoil] = useState<Coil | null>(null);
  const [showXmlModal, setShowXmlModal] = useState(false);
  
  const { finishes } = useFinishes(true);

  // 2. Data Hook
  const {
    coils,
    loading,
    error,
    currentPage,
    filteredTotal,
    hasNextPage,
    nextPage,
    prevPage,
    refresh,
  } = useCoils({ 
    searchTerm, 
    statusFilter, 
    finishFilter, 
    currencyFilter, 
    providerFilter, 
    startDate, 
    endDate, 
    pageSize 
  });

  // 3. Computed
  const selectedCoils = coils.filter(c => selectedIds.includes(c.id));

  // 4. Effects
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Cargar órdenes activas para el mapeo
  useEffect(() => {
    const fetchActiveOrders = async () => {
      try {
        const q = query(collection(db, "cut_orders"), where("status", "==", "ENVIADO"));
        const snap = await getDocs(q);
        const mapping: Record<string, string> = {};
        snap.docs.forEach(doc => {
          const data = doc.data() as CutOrder;
          data.coils.forEach(c => {
            mapping[c.coilId] = doc.id;
          });
        });
        setOrderMapping(mapping);
      } catch (err) {
        console.error("Error al cargar mapeo de órdenes", err);
      }
    };
    fetchActiveOrders();
  }, [coils]);

  // Métricas que respetan filtros
  useEffect(() => {
    const fetchFullMetrics = async () => {
      try {
        const collRef = collection(db, "coils");
        let constraints = [];
        
        if (statusFilter === "ALL") {
          constraints.push(where("status", "in", ["AVAILABLE", "IN_PROGRESS", "PROCESSED", "EN_TERCERO"]));
        } else {
          constraints.push(where("status", "==", statusFilter));
        }

        if (finishFilter !== "ALL") constraints.push(where("finish", "==", finishFilter));
        if (currencyFilter !== "ALL") constraints.push(where("metadata.currency", "==", currencyFilter));
        if (providerFilter) constraints.push(where("metadata.provider", "==", providerFilter.trim()));
        
        const q = query(collRef, ...constraints);
        const snap = await getDocs(q);
        
        const summary = {
          byFinish: {} as Record<string, number>,
          byFinishML: {} as Record<string, number>,
          enTercero: 0,
          totalValuePEN: 0,
          totalAvailableKg: 0,
          alerts: {
            noFinish: 0,
            lowWeight: 0,
          },
        };

        snap.docs.forEach(doc => {
          const coil = doc.data() as Coil;
          const weight = coil.currentWeight || 0;
          const valPEN = weight * (coil.pricePerKg || 0);
          
          if (coil.status === 'EN_TERCERO') summary.enTercero += weight;
          if (coil.status === 'AVAILABLE') summary.totalAvailableKg += weight;
          
          summary.totalValuePEN += valPEN;

          if (!coil.finish) {
            summary.alerts.noFinish++;
          } else {
            summary.byFinish[coil.finish] = (summary.byFinish[coil.finish] || 0) + weight;
            
            if (coil.status === 'AVAILABLE' || coil.status === 'IN_PROGRESS') {
              const finishDef = finishes.find(f => f.id === coil.finish);
              if (coil.thickness && coil.masterWidth && finishDef?.densityFactor) {
                const ml = calcCoilTheoreticalML({
                  weightKg: weight,
                  thicknessMm: coil.thickness,
                  masterWidthMm: coil.masterWidth,
                  densityFactor: finishDef.densityFactor
                });
                summary.byFinishML[coil.finish] = (summary.byFinishML[coil.finish] || 0) + ml;
              }
            }
          }

          if (coil.status === 'AVAILABLE' && weight < 500) {
            summary.alerts.lowWeight++;
          }
        });

        setMetrics(summary);
      } catch (err) {
        console.error("Error al calcular métricas completas", err);
      }
    };
    fetchFullMetrics();
  }, [searchTerm, statusFilter, finishFilter, currencyFilter, providerFilter, startDate, endDate, coils, finishes]);

  // 5. Handlers
  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleOpenEdit = async (coil: Coil) => {
    try {
      const docSnap = await getDoc(doc(db, "coils", coil.id));
      if (docSnap.exists()) {
        const fullCoil = { id: docSnap.id, ...docSnap.data() } as Coil;
        setEditingCoil(fullCoil);
        const rawInvoiceDate = fullCoil.metadata?.invoiceDate;
        const invoiceDate = (() => {
          if (!rawInvoiceDate) return "";
          const d =
            typeof (rawInvoiceDate as { toDate?: () => Date }).toDate === "function"
              ? (rawInvoiceDate as { toDate: () => Date }).toDate()
              : new Date(rawInvoiceDate as string | number);
          return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
        })();
        setEditData({
          initialWeight: fullCoil.initialWeight || 0,
          currentWeight: fullCoil.currentWeight || 0,
          masterWidth: fullCoil.masterWidth || 1200,
          thickness: fullCoil.thickness || 0.45,
          finish: fullCoil.finish || "",
          pricePerKg: fullCoil.pricePerKg || 0,
          currency: fullCoil.metadata?.currency || "PEN",
          exchangeRate: fullCoil.metadata?.exchangeRate || 3.80,
          providerDocType: fullCoil.metadata?.providerDocType || "LOCAL",
          providerDoc: fullCoil.metadata?.providerDoc || "",
          providerName: fullCoil.metadata?.provider || "",
          invoiceNumber: fullCoil.metadata?.invoiceNumber || "",
          invoiceDate,
        });
      }
    } catch {
      toast.error("Error al cargar datos para editar.");
    }
  };

  const handleVoidCoil = async (coilId: string) => {
    if (
      await confirm({
        title: "Anular Bobina",
        message: `¿Estás seguro de anular la bobina ${coilId}?`,
        variant: "danger",
        confirmLabel: "Anular",
      })
    ) {
      toast
        .promise(voidCoil(coilId, user?.email || "Admin"), {
          loading: "Anulando...",
          success: "Bobina anulada.",
          error: (err: any) => err.message,
        })
        .then(() => refresh());
    }
  };

  const onDeleteDraft = async (coilId: string) => {
    if (
      await confirm({
        title: "Eliminar borrador de bobina",
        message: `Esto BORRA FÍSICAMENTE la bobina ${coilId}. Es IRREVERSIBLE y solo procede si no tiene movimientos (producción, split, merma, venta). Escribe ELIMINAR para confirmar.`,
        variant: "danger",
        confirmLabel: "Eliminar",
        requireInput: { label: 'Escribe "ELIMINAR"', matchValue: "ELIMINAR" },
      })
    ) {
      toast
        .promise(deleteCoilDraft(coilId), {
          loading: "Eliminando...",
          success: "Borrador eliminado.",
          error: (err: any) => err.message,
        })
        .then(() => refresh());
    }
  };

  const handleReverseSplit = async (childId: string) => {
    if (
      await confirm({
        title: "Revertir split",
        message: `Esto ANULA la bobina hija ${childId} y restaura peso+ancho a la madre. Acción de ADMIN.`,
        variant: "danger",
        confirmLabel: "Revertir",
        requireInput: { label: 'Escribe "REVERTIR"', matchValue: "REVERTIR" },
      })
    ) {
      toast
        .promise(reverseCoilSplit(childId), {
          loading: "Revirtiendo split...",
          success: "Split revertido con éxito.",
          error: (err: any) => err.message,
        })
        .then(() => refresh());
    }
  };

  const handleCancelPlan = async (coilId: string) => {
    if (
      await confirm({
        title: "Cancelar Plan",
        message: `¿Estás seguro de cancelar el plan de la bobina ${coilId}?`,
        variant: "warning",
      })
    ) {
      toast
        .promise(cancelCoilPlan(coilId, user?.email || "Admin"), {
          loading: "Cancelando plan...",
          success: "Plan cancelado. Bobina disponible.",
          error: (err: any) => err.message,
        })
        .then(() => refresh());
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCoil) return;
    toast
      .promise(updateCoil(editingCoil.id, editData, user?.email || "Admin"), {
        loading: "Guardando...",
        success: "Bobina actualizada.",
        error: (err: any) => err.message,
      })
      .then(() => {
        setEditingCoil(null);
        refresh();
      });
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("ALL");
    setFinishFilter("ALL");
    setCurrencyFilter("ALL");
    setProviderFilter("");
  };

  const exportToExcel = async () => {
    toast.loading("Descargando data y generando Excel...", { id: "excel" });
    try {
      const availableCoils = await fetchAvailableCoilsForExport();
      if (availableCoils.length === 0) {
        toast.error("No hay bobinas disponibles para exportar.", { id: "excel" });
        return;
      }
      const dataForExcel = availableCoils.map((coil) => {
        const invoiceDate = coil.metadata?.invoiceDate?.toDate
          ? coil.metadata.invoiceDate.toDate().toLocaleDateString("es-PE")
          : "Sin fecha";
        return {
          "ID Bobina": coil.id,
          Acabado: coil.finish || "N/A",
          Proveedor: coil.metadata?.provider || "N/A",
          "Factura N°": coil.metadata?.invoiceNumber || "S/N",
          "Fecha de Compra": invoiceDate,
          "Espesor (mm)": coil.thickness,
          "Ancho Maestro (mm)": coil.masterWidth,
          "Peso Compra (Kg)": coil.initialWeight,
          "Stock Actual (Kg)": coil.currentWeight,
          "Costo Unitario (S/ por Kg)": coil.pricePerKg,
          "Valorización Total (S/)": Number(
            ((coil.currentWeight || 0) * (coil.pricePerKg || 0)).toFixed(2),
          ),
          "Moneda Original": coil.metadata?.currency || "PEN",
          "Tipo de Cambio": coil.metadata?.exchangeRate || 1,
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
      const workbook = XLSX.utils.book_new();
      worksheet["!cols"] = [
        { wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 25 },
        { wch: 18 }, { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Disponible");
      const fileName = `Inventario_Bobinas_Disponibles_${new Date()
        .toLocaleDateString("es-PE")
        .replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Excel descargado correctamente", { id: "excel" });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al generar Excel.",
        { id: "excel" },
      );
    }
  };

  return (
    <div className="space-y-6 relative pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Inventario Global de Bobinas
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Gestión de materia prima compartida (Acero / Otros)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <HeaderOptions
            role={role}
            onExport={exportToExcel}
            onOpenXml={() => setShowXmlModal(true)}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black flex-1 md:flex-none uppercase tracking-tighter"
          >
            <Plus size={20} /> Nueva Bobina
          </button>
        </div>
      </div>

      <InventoryMetrics metrics={metrics} />

      <InventoryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={loading && searchTerm !== ""}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        finishFilter={finishFilter}
        setFinishFilter={setFinishFilter}
        currencyFilter={currencyFilter}
        setCurrencyFilter={setCurrencyFilter}
        providerFilter={providerFilter}
        setProviderFilter={setProviderFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClear={handleClearSearch}
      />

      <div className="relative">
        {selectedIds.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-[2rem] flex justify-between items-center animate-in slide-in-from-top-4 duration-300 shadow-sm">
            <div className="flex items-center gap-4 ml-2">
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <Scissors size={20} />
               </div>
               <p className="text-sm font-black text-blue-900 uppercase tracking-tighter">
                 {selectedIds.length} Bobinas seleccionadas para corte
               </p>
            </div>
            <div className="flex gap-2">
               <button 
                onClick={() => setSelectedIds([])}
                className="px-6 py-2 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition"
               >
                 Cancelar
               </button>
               <button 
                onClick={() => setShowCutModal(true)}
                className="px-8 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100"
               >
                 Enviar a Corte
               </button>
            </div>
          </div>
        )}

        <InventoryTable
          displayCoils={coils}
          role={role}
          currentPage={currentPage}
          pageSize={pageSize}
          selectedIds={selectedIds}
          orderMapping={orderMapping}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onEdit={handleOpenEdit}
          onVoid={handleVoidCoil}
          onDeleteDraft={onDeleteDraft}
          onReverseSplit={handleReverseSplit}
          onCancelPlan={handleCancelPlan}
          onSendToCut={(coil) => {
            setSelectedIds([coil.id]);
            setShowCutModal(true);
          }}
          onSplit={setSplittingCoil}
          onScrap={setScrappingCoil}
          onViewDetails={setViewingCoil}
          onAssignFinish={handleOpenEdit}
          isLoading={loading}
        />
        {loading && coils.length > 0 && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-[2rem]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={filteredTotal}
        onPageChange={(page) => {
          if (page > currentPage) nextPage();
          else if (page < currentPage) prevPage();
        }}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      <InventoryModals
        editingCoil={editingCoil}
        editData={editData}
        setEditData={setEditData}
        onCloseEdit={() => setEditingCoil(null)}
        onSaveEdit={handleSaveEdit}
        isAddModalOpen={isAddModalOpen}
        onAddModalChange={(isOpen) => {
          setIsAddModalOpen(isOpen);
          if (!isOpen) refresh();
        }}
        viewingCoil={viewingCoil}
        onCloseDetails={() => setViewingCoil(null)}
        splittingCoil={splittingCoil}
        onCloseSplit={() => setSplittingCoil(null)}
        onSplitSuccess={refresh}
        scrappingCoil={scrappingCoil}
        onCloseScrap={() => setScrappingCoil(null)}
        onScrapSuccess={refresh}
        showXmlModal={showXmlModal}
        onCloseXml={() => {
          setShowXmlModal(false);
          refresh();
        }}
      />

      {showCutModal && (
        <SendToCutModal 
          coils={selectedCoils}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setShowCutModal(false)}
          onSuccess={() => {
            setShowCutModal(false);
            setSelectedIds([]);
            refresh();
          }}
        />
      )}
    </div>
  );
}
