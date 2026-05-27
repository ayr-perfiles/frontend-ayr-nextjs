"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import * as XLSX from "xlsx";
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  doc,
  getDoc,
} from "firebase/firestore";
import { Coil } from "@/types";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useCoils } from "@/modules/drywall/hooks/useCoils";

import { seedFiftyAvailableCoils } from "@/modules/drywall/services/seedService";
import {
  voidCoil,
  updateCoil,
  cancelCuttingPlan,
} from "@/modules/drywall/services/productionService";
import { fetchAvailableCoilsForExport } from "@/modules/drywall/services/inventoryService";
import { useAuth } from "@/context/AuthContext";

import { InventoryFilters } from "@/modules/drywall/components/inventory/InventoryFilters";
import { EditData } from "@/modules/drywall/components/inventory/EditCoilModal";
import InventoryTable from "@/modules/drywall/components/inventory/InventoryTable";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { HeaderOptions } from "@/modules/drywall/components/inventory/HeaderOptions";
import { InventoryMetrics } from "@/modules/drywall/components/inventory/InventoryMetrics";
import { InventoryPagination } from "@/modules/drywall/components/inventory/InventoryPagination";
import { InventoryModals } from "@/modules/drywall/components/inventory/InventoryModals";

export default function InventoryPage() {
  const { user, role } = useAuth();

  const [metrics, setMetrics] = useState({
    available: 0,
    inProgress: 0,
    totalWeight: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const {
    coils,
    loading,
    error,
    currentPage,
    filteredTotal,
    isAlgoliaMode,
    algoliaTotalPages,
    hasNextPage,
    nextPage,
    prevPage,
    refresh,
  } = useCoils({ searchTerm, statusFilter, startDate, endDate, pageSize });

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCoil, setSelectedCoil] = useState<Coil | null>(null);
  const [editingCoil, setEditingCoil] = useState<Coil | null>(null);
  const [editData, setEditData] = useState<EditData>({
    initialWeight: 0,
    currentWeight: 0,
    masterWidth: 1200,
    thickness: 0.45,
    pricePerKg: 0,
    providerDocType: "LOCAL",
    providerDoc: "",
    providerName: "",
    invoiceNumber: "",
    invoiceDate: "",
  });
  const [viewingCoil, setViewingCoil] = useState<Coil | null>(null);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const collRef = collection(db, "coils");
        const availableQ = query(collRef, where("status", "==", "AVAILABLE"));
        const progressQ = query(collRef, where("status", "==", "IN_PROGRESS"));
        const [availableSnap, progressSnap, weightSnap] = await Promise.all([
          getCountFromServer(availableQ),
          getCountFromServer(progressQ),
          getAggregateFromServer(availableQ, { totalWeight: sum("currentWeight") }),
        ]);
        setMetrics({
          available: availableSnap.data().count,
          inProgress: progressSnap.data().count,
          totalWeight: weightSnap.data().totalWeight,
        });
      } catch (err) {
        console.error("Error al cargar métricas", err);
      }
    };
    fetchMetrics();
  }, []);

  const handleOpenProduction = async (coil: Coil) => {
    try {
      const docSnap = await getDoc(doc(db, "coils", coil.id));
      if (docSnap.exists())
        setSelectedCoil({ id: docSnap.id, ...docSnap.data() } as Coil);
    } catch {
      toast.error("Error al cargar la bobina.");
    }
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
          pricePerKg: fullCoil.pricePerKg || 0,
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
    if (confirm(`¿Estás seguro de anular la bobina ${coilId}?`)) {
      toast
        .promise(voidCoil(coilId, user?.email || "Admin"), {
          loading: "Anulando...",
          success: "Bobina anulada.",
          error: (err) => err.message,
        })
        .then(() => refresh());
    }
  };

  const handleCancelPlan = async (coilId: string) => {
    if (
      confirm(
        `¿Estás seguro de cancelar el plan de corte de la bobina ${coilId}? Se devolverá a estado DISPONIBLE.`,
      )
    ) {
      toast
        .promise(cancelCuttingPlan(coilId, user?.email || "Admin"), {
          loading: "Cancelando plan...",
          success: "Plan cancelado. Bobina disponible nuevamente.",
          error: (err) => err.message,
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
        error: (err) => err.message,
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
        { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
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
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Inventario de Bobinas
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Gestión de materia prima y stock inicial
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <HeaderOptions
            role={role}
            onExport={exportToExcel}
            onOpenXml={() => setShowXmlModal(true)}
            onOpenExcel={() => setShowExcelModal(true)}
            onSeed={async () => {
              await seedFiftyAvailableCoils();
              refresh();
            }}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black flex-1 md:flex-none"
          >
            <Plus size={20} /> Nueva Bobina
          </button>
        </div>
      </div>

      <InventoryMetrics
        available={metrics.available}
        inProgress={metrics.inProgress}
        totalWeight={metrics.totalWeight}
      />

      <InventoryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={loading && searchTerm !== ""}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClear={handleClearSearch}
      />

      <div className="relative">
        {loading && coils.length === 0 ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <>
            <InventoryTable
              displayCoils={coils}
              role={role}
              currentPage={currentPage}
              pageSize={pageSize}
              onProcess={handleOpenProduction}
              onEdit={handleOpenEdit}
              onVoid={handleVoidCoil}
              onCancelPlan={handleCancelPlan}
              onViewDetails={setViewingCoil}
            />
            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </>
        )}
      </div>

      <InventoryPagination
        filteredTotal={filteredTotal}
        currentPage={currentPage}
        hasNextPage={hasNextPage}
        isAlgoliaMode={isAlgoliaMode}
        algoliaTotalPages={algoliaTotalPages}
        loading={loading}
        pageSize={pageSize}
        onPrev={prevPage}
        onNext={nextPage}
        onPageSizeChange={setPageSize}
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
        selectedCoil={selectedCoil}
        onCloseProduction={() => {
          setSelectedCoil(null);
          refresh();
        }}
        viewingCoil={viewingCoil}
        onCloseDetails={() => setViewingCoil(null)}
        showXmlModal={showXmlModal}
        onCloseXml={() => {
          setShowXmlModal(false);
          refresh();
        }}
        showExcelModal={showExcelModal}
        onCloseExcel={() => {
          setShowExcelModal(false);
          refresh();
        }}
      />
    </div>
  );
}
