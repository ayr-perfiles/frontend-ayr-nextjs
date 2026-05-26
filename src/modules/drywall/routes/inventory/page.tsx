"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import * as XLSX from "xlsx"; // <-- NUEVA IMPORTACIÓN
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
import {
  Plus,
  Download,
  ChevronDown,
  FileCode2,
  FileSpreadsheet,
  Database,
  X,
  PackageSearch,
  Factory,
  Weight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

// Módulos Internos
import { seedFiftyAvailableCoils } from "@/modules/drywall/services/seedService";
import {
  voidCoil,
  updateCoil,
  cancelCuttingPlan,
} from "@/modules/drywall/services/productionService";
import {
  fetchAvailableCoilsForExport,
  fetchInventory,
} from "@/modules/drywall/services/inventoryService";
import { useAuth } from "@/context/AuthContext";

// Componentes
import { AddCoilForm } from "@/modules/drywall/components/forms/AddCoilForm";
import { ProductionForm } from "@/modules/drywall/components/forms/ProductionForm";
import { ConsumeStripForm } from "@/modules/drywall/components/forms/ConsumeStripForm";
import { InventoryFilters } from "@/modules/drywall/components/inventory/InventoryFilters";
import { EditCoilModal } from "@/modules/drywall/components/inventory/EditCoilModal";
import InventoryTable from "@/modules/drywall/components/inventory/InventoryTable";
import { PurchaseCoilFromXml } from "@/modules/drywall/components/purchases/PurchaseCoilFromXml";
import { BulkUploadCoils } from "@/modules/drywall/components/purchases/BulkUploadCoils";
import { CoilDetailsModal } from "@/modules/drywall/components/inventory/CoilDetailsModal";

// --- SUB-COMPONENTE: MENÚ DESPLEGABLE DE OPCIONES ---
function HeaderOptions({
  role,
  onExport,
  onOpenXml,
  onOpenExcel,
  onSeed,
}: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition font-bold shadow-sm"
      >
        Opciones{" "}
        <ChevronDown
          size={18}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
            <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Importar / Exportar
            </p>
            <button
              onClick={() => {
                setIsOpen(false);
                onExport();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <Download size={18} className="text-gray-400" /> Descargar Excel
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenXml();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <FileCode2 size={18} className="text-blue-500" /> Ingresar vía
              Factura XML
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenExcel();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <FileSpreadsheet size={18} className="text-green-500" /> Migración
              Masiva (Excel)
            </button>
            {role === "ADMIN" && (
              <>
                <div className="h-px bg-gray-100 my-2 mx-4" />
                <p className="px-4 py-2 text-[10px] font-black text-purple-400 uppercase tracking-widest">
                  Herramientas de Admin
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onSeed();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-3 font-bold transition"
                >
                  <Database size={18} /> Generar 50 Bobinas
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const { user, role } = useAuth();

  // --- ESTADOS DE DATOS ---
  const [coils, setCoils] = useState<Coil[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0); // 👈 Nuevo: Total dinámico
  const [pageSize, setPageSize] = useState(10); // 👈 Nuevo: Iniciamos en 10 por defecto
  const [metrics, setMetrics] = useState({
    available: 0,
    inProgress: 0,
    totalWeight: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // --- ESTADOS DE FILTROS Y BÚSQUEDA ---
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- ESTADOS DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const [isAlgoliaMode, setIsAlgoliaMode] = useState(false);

  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const [algoliaPage, setAlgoliaPage] = useState(0);
  const [algoliaTotalPages, setAlgoliaTotalPages] = useState(0);

  // --- ESTADOS DE MODALES ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCoil, setSelectedCoil] = useState<Coil | null>(null);
  const [editingCoil, setEditingCoil] = useState<Coil | null>(null);
  const [editData, setEditData] = useState<any>({});
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
          getAggregateFromServer(availableQ, {
            totalWeight: sum("currentWeight"),
          }),
        ]);

        setMetrics({
          available: availableSnap.data().count,
          inProgress: progressSnap.data().count,
          totalWeight: weightSnap.data().totalWeight,
        });
      } catch (error) {
        console.error("Error al cargar métricas", error);
      }
    };
    fetchMetrics();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = async (
    direction: "first" | "next" | "prev" = "first",
    targetAlgoliaPage = 0,
  ) => {
    setIsLoading(true);
    try {
      const res = await fetchInventory({
        pageSize: pageSize,
        statusFilter,
        searchTerm: debouncedSearchTerm,
        startDate,
        endDate,
        direction,
        cursorDoc:
          direction === "next"
            ? lastDoc
            : direction === "prev"
              ? firstDoc
              : null,
        page: targetAlgoliaPage,
      });

      setCoils(res.coils);
      setIsAlgoliaMode(res.isAlgolia);

      // 💡 CAPTURAR EL TOTAL SEGÚN EL MODO
      if (res.isAlgolia) {
        setAlgoliaTotalPages(res.algoliaData?.totalPages || 0);
        setAlgoliaPage(res.algoliaData?.currentPage || 0);

        // Usamos (res as any) para silenciar a TypeScript si nbHits no está tipado
        setFilteredTotal((res as any).algoliaData?.nbHits || 0);
      } else {
        setFirstDoc(res.firstDoc);
        setLastDoc(res.lastDoc);

        // Silenciamos el error de totalCount. Si el backend no lo envía, el fallback es coils.length
        setFilteredTotal((res as any).totalCount || res.coils.length);
      }
    } catch (error) {
      console.error("ERROR:", error);
      toast.error("Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return;
    }

    setCurrentPage(1);
    loadData("first", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, statusFilter, startDate, endDate, pageSize]);

  const hasNextPage = isAlgoliaMode
    ? algoliaPage + 1 < algoliaTotalPages
    : coils.length === pageSize;

  const handleNextPage = () => {
    if (!hasNextPage) return;
    setCurrentPage((prev) => prev + 1);
    if (isAlgoliaMode) {
      loadData("first", algoliaPage + 1);
    } else {
      loadData("next");
    }
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    setCurrentPage((prev) => prev - 1);
    if (isAlgoliaMode) {
      loadData("first", algoliaPage - 1);
    } else {
      loadData("prev");
    }
  };

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
        .then(() => loadData("first", 0));
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
          error: (err) => err.message, // Si ya tiene cortes, el toast mostrará el error ⛔ IMPOSIBLE CANCELAR
        })
        .then(() => loadData("first", 0));
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
        loadData("first", 0);
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
      // 1. Traemos solo las bobinas disponibles desde Firebase
      const availableCoils = await fetchAvailableCoilsForExport();

      if (availableCoils.length === 0) {
        toast.error("No hay bobinas disponibles para exportar.", {
          id: "excel",
        });
        return;
      }

      // 2. Mapeamos la data para que las columnas del Excel queden hermosas
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

      // 3. Generamos el archivo usando la librería XLSX
      const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
      const workbook = XLSX.utils.book_new();

      // Auto-ajustar el ancho de las columnas para que se vea profesional
      const columnWidths = [
        { wch: 20 },
        { wch: 35 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 25 },
        { wch: 25 },
        { wch: 18 },
        { wch: 15 },
      ];
      worksheet["!cols"] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Disponible");

      // 4. Descargamos el archivo
      const fileName = `Inventario_Bobinas_Disponibles_${new Date().toLocaleDateString("es-PE").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Excel descargado correctamente", { id: "excel" });
    } catch (error: any) {
      toast.error(error.message, { id: "excel" });
    }
  };

  return (
    <div className="space-y-6 relative pb-10">
      {/* CABECERA */}
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
              loadData("first", 0);
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

      {/* TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-xl text-green-600">
            <PackageSearch size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Disponibles
            </p>
            <p className="text-2xl font-black text-gray-800">
              {metrics.available}{" "}
              <span className="text-sm font-medium text-gray-500">bobinas</span>
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
            <Factory size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              En Producción
            </p>
            <p className="text-2xl font-black text-gray-800">
              {metrics.inProgress}{" "}
              <span className="text-sm font-medium text-gray-500">bobinas</span>
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <Weight size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Stock Físico
            </p>
            <p className="text-2xl font-black text-gray-800">
              {(metrics.totalWeight / 1000).toFixed(1)}{" "}
              <span className="text-sm font-medium text-gray-500">
                Toneladas
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <InventoryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={isLoading && searchTerm !== ""}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClear={handleClearSearch}
      />
      {/* TABLA PRINCIPAL */}
      <div className="relative">
        <InventoryTable
          displayCoils={coils}
          role={role}
          currentPage={currentPage}
          pageSize={pageSize}
          onProcess={handleOpenProduction}
          onEdit={handleOpenEdit}
          onVoid={handleVoidCoil}
          onCancelPlan={handleCancelPlan} // <-- Conectado
          onViewDetails={setViewingCoil}
        />

        {/* Loader de opacidad si está refrescando la tabla */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* --- BOTONERA DE PAGINACIÓN CENTRADA --- */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
        {/* 1. LADO IZQUIERDO: Resultados Filtrados */}
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Resultados encontrados
            </p>
            <p className="text-sm font-black text-blue-600">
              {filteredTotal} {filteredTotal === 1 ? "bobina" : "bobinas"}
            </p>
          </div>
        </div>

        {/* 2. CENTRO: Controles de Paginación */}
        <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1 || isLoading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
            title="Página anterior"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
            Página{" "}
            <span className="font-black text-slate-800 text-sm mx-1">
              {currentPage}
            </span>
            {isAlgoliaMode && algoliaTotalPages > 0 && (
              <span> de {algoliaTotalPages}</span>
            )}
          </div>

          <button
            onClick={handleNextPage}
            disabled={!hasNextPage || isLoading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
            title="Página siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 3. LADO DERECHO: Balance visual */}
        <div className="w-full sm:w-1/3 flex items-center justify-center sm:justify-end gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Ver:
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1); // Resetear a la página 1 al cambiar el tamaño
            }}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm"
          >
            <option value={10}>10 ítems</option>
            <option value={25}>25 ítems</option>
            <option value={50}>50 ítems</option>
            <option value={100}>100 ítems</option>
          </select>
        </div>
      </div>

      {/* --- MODALES --- */}
      {editingCoil && (
        <EditCoilModal
          editingCoil={editingCoil}
          editData={editData}
          setEditData={setEditData}
          onClose={() => setEditingCoil(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* ¡AQUÍ ESTÁ EL CAMBIO PRINCIPAL: max-w-5xl! */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95">
            <AddCoilForm
              onOpenChange={(isOpen) => {
                setIsAddModalOpen(isOpen);
                if (!isOpen) loadData("first", 0); // ¡Esto refresca la tabla al cerrar!
              }}
            />
          </div>
        </div>
      )}

      {selectedCoil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            {selectedCoil.status === "AVAILABLE" ? (
              <ProductionForm
                coil={selectedCoil}
                onClose={() => {
                  setSelectedCoil(null);
                  loadData("first", 0); // <-- ¡ESTO ARREGLA EL REFRESH AL CREAR PLAN!
                }}
              />
            ) : (
              <ConsumeStripForm
                coil={selectedCoil}
                onClose={() => {
                  setSelectedCoil(null);
                  loadData("first", 0);
                }}
              />
            )}
          </div>
        </div>
      )}
      {viewingCoil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 flex justify-center">
            <CoilDetailsModal
              coil={viewingCoil}
              onClose={() => setViewingCoil(null)}
            />
          </div>
        </div>
      )}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setShowXmlModal(false);
                loadData("first", 0);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 z-10 bg-white rounded-full p-1 shadow-sm border border-gray-100 transition"
            >
              <X size={20} />
            </button>
            <PurchaseCoilFromXml />
          </div>
        </div>
      )}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setShowExcelModal(false);
                loadData("first", 0);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 z-10 bg-white rounded-full p-1 shadow-sm border border-gray-100 transition"
            >
              <X size={20} />
            </button>
            <BulkUploadCoils />
          </div>
        </div>
      )}
    </div>
  );
}
