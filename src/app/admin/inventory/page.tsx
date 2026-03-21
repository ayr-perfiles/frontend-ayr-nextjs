"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { Coil } from "@/types";
import {
  Plus,
  Download,
  ChevronDown,
  Search,
  MoreHorizontal,
  Scissors,
  Edit2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

// Módulos Internos
import { seedFiftyAvailableCoils } from "@/services/seedService";
import { voidCoil, updateCoil } from "@/services/productionService";
import { useAuth } from "@/context/AuthContext";

// Componentes Separados
import { AddCoilForm } from "@/components/forms/AddCoilForm";
import { ProductionForm } from "@/components/forms/ProductionForm";
import { ConsumeStripForm } from "@/components/forms/ConsumeStripForm";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { WeightIndicator } from "@/components/inventory/WeightIndicator";
import { EditCoilModal } from "@/components/inventory/EditCoilModal";

export default function InventoryPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCoilId = searchParams.get("coilId");

  const [coils, setCoils] = useState<Coil[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [limitCount, setLimitCount] = useState(20);

  // Estados de Búsqueda
  const [searchTerm, setSearchTerm] = useState(initialCoilId || "");
  const [suggestions, setSuggestions] = useState<Coil[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoilId, setSelectedCoilId] = useState<string | null>(
    initialCoilId,
  );
  const [searchedCoilData, setSearchedCoilData] = useState<Coil | null>(null);
  const searchInputRef = useRef<HTMLDivElement>(null);

  // Estados de Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCoil, setSelectedCoil] = useState<Coil | null>(null);
  const [editingCoil, setEditingCoil] = useState<Coil | null>(null);
  const [editData, setEditData] = useState({
    initialWeight: 0,
    currentWeight: 0,
    masterWidth: 0,
    thickness: 0.45,
  });

  const updateUrlParams = (newCoilId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newCoilId) params.set("coilId", newCoilId);
    else params.delete("coilId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // 1. Cargar Bobinas Generales
  useEffect(() => {
    let q = query(
      collection(db, "coils"),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );
    if (statusFilter !== "ALL") {
      q = query(
        collection(db, "coils"),
        where("status", "==", statusFilter),
        orderBy("createdAt", "desc"),
        limit(limitCount),
      );
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Coil[];
      setCoils(docs);
    });
    return () => unsubscribe();
  }, [limitCount, statusFilter]);

  // 2. Cargar Bobina Buscada Individual
  useEffect(() => {
    if (!selectedCoilId) {
      setSearchedCoilData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "coils", selectedCoilId), (docSnap) => {
      if (docSnap.exists())
        setSearchedCoilData({ id: docSnap.id, ...docSnap.data() } as Coil);
      else setSearchedCoilData(null);
    });
    return () => unsub();
  }, [selectedCoilId]);

  // 3. Autocompletado Algolia
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (selectedCoilId && searchTerm === selectedCoilId) return;

    const getSuggestions = async () => {
      setIsSearching(true);
      try {
        const filters = statusFilter !== "ALL" ? `status:${statusFilter}` : "";
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.COILS,
          searchParams: { query: searchTerm, filters, hitsPerPage: 5 },
        });
        const mappedHits = hits.map((hit: any) => ({
          ...hit,
          id: hit.objectID,
        })) as Coil[];
        setSuggestions(mappedHits);
        setShowSuggestions(mappedHits.length > 0);
      } catch (error) {
        console.error("Error buscando:", error);
      } finally {
        setIsSearching(false);
      }
    };
    const timeoutId = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, selectedCoilId]);

  // Ocultar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      )
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- FUNCIONES DE ACCIÓN ---
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
          initialWeight: fullCoil.initialWeight,
          currentWeight: fullCoil.currentWeight,
          masterWidth: fullCoil.masterWidth || 1200,
          thickness: fullCoil.thickness || 0.45,
        });
      }
    } catch {
      toast.error("Error al cargar datos para editar.");
    }
  };

  const handleVoidCoil = async (coilId: string) => {
    if (confirm(`¿Estás seguro de anular la bobina ${coilId}?`)) {
      toast.promise(voidCoil(coilId, user?.email || "Admin"), {
        loading: "Anulando bobina...",
        success: "Bobina anulada con éxito.",
        error: (err) => err.message,
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCoil) return;
    toast
      .promise(updateCoil(editingCoil.id, editData, user?.email || "Admin"), {
        loading: "Guardando cambios...",
        success: "Bobina actualizada.",
        error: (err) => err.message,
      })
      .then(() => setEditingCoil(null));
  };

  const exportToExcel = () => {
    const headers = [
      "Serie",
      "Ancho (mm)",
      "Espesor (mm)",
      "Peso Inicial (kg)",
      "Peso Actual (kg)",
      "Estado",
    ];
    const rows = displayCoils.map((c) => [
      c.id,
      c.masterWidth || 1200,
      c.thickness || 0,
      c.initialWeight,
      c.currentWeight,
      c.status,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Inventario_AYR_${new Date().toLocaleDateString()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearSearch = () => {
    setSelectedCoilId(null);
    setSearchTerm("");
    setSearchedCoilData(null);
    updateUrlParams(null);
  };

  const handleSelectSuggestion = (id: string) => {
    setSelectedCoilId(id);
    setSearchTerm(id);
    setShowSuggestions(false);
    updateUrlParams(id);
  };

  const displayCoils = selectedCoilId
    ? searchedCoilData
      ? [searchedCoilData]
      : []
    : coils;

  return (
    <div className="space-y-6 relative pb-10">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Inventario de Bobinas
          </h1>
          <p className="text-gray-500">
            Gestión de materia prima y stock inicial
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition shadow-sm font-medium"
          >
            <Download size={18} /> Exportar
          </button>

          {role === "ADMIN" && (
            <button
              onClick={async () => await seedFiftyAvailableCoils()}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm font-medium"
            >
              Generar 50 Bobinas
            </button>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm font-bold"
          >
            <Plus size={18} /> Nueva Bobina
          </button>
        </div>
      </div>

      {/* COMPONENTE DE FILTROS */}
      <InventoryFilters
        searchTerm={searchTerm}
        setSearchTerm={(val) => {
          setSearchTerm(val);
          if (val === "") handleClearSearch();
        }}
        isSearching={isSearching}
        showSuggestions={showSuggestions}
        suggestions={suggestions}
        onSelectSuggestion={handleSelectSuggestion}
        statusFilter={statusFilter}
        setStatusFilter={(val) => {
          setStatusFilter(val);
          setLimitCount(20);
        }}
        onClear={handleClearSearch}
        searchInputRef={searchInputRef}
      />

      {/* TABLA DE INVENTARIO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Serie
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Material{" "}
                  <span className="text-gray-400 normal-case font-normal">
                    (Ancho x Esp)
                  </span>
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-64">
                  Stock Disponible
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Estado
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap w-32">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayCoils.map((coil) => {
                const isVoided = coil.status === "VOIDED";
                return (
                  <tr
                    key={coil.id}
                    className={`group transition-colors ${isVoided ? "bg-red-50/10" : "hover:bg-blue-50/20"}`}
                  >
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span
                          className={`font-black ${isVoided ? "text-red-400 line-through" : "text-blue-900"}`}
                        >
                          {coil.id}
                        </span>
                        {coil.metadata?.provider && (
                          <span className="text-xs text-gray-400 font-medium mt-0.5">
                            {coil.metadata.provider}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`p-4 text-sm font-medium ${isVoided ? "text-gray-400 line-through" : "text-gray-600"}`}
                    >
                      {coil.masterWidth}{" "}
                      <span className="text-gray-400 mx-0.5 text-xs">mm</span>
                      <span className="text-gray-300 mx-1">x</span>
                      {coil.thickness}{" "}
                      <span className="text-gray-400 mx-0.5 text-xs">mm</span>
                    </td>
                    <td
                      className={`p-4 ${isVoided ? "opacity-50 grayscale" : ""}`}
                    >
                      <WeightIndicator
                        current={coil.currentWeight || 0}
                        initial={coil.initialWeight || 0}
                      />
                    </td>
                    <td className="p-4">
                      <StatusBadge status={coil.status} />
                    </td>
                    <td className="p-4 relative">
                      <ActionMenu
                        coil={coil}
                        role={role}
                        isVoided={isVoided}
                        onProcess={() => handleOpenProduction(coil)}
                        onEdit={() => handleOpenEdit(coil)}
                        onVoid={() => handleVoidCoil(coil.id)}
                      />
                    </td>
                  </tr>
                );
              })}
              {displayCoils.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-400">
                      <Search size={24} />
                    </div>
                    <h3 className="text-gray-900 font-bold text-lg">
                      No hay resultados
                    </h3>
                    <p className="text-gray-500 mt-1 font-medium">
                      No se encontraron bobinas con los filtros actuales.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTÓN CARGAR MÁS */}
      {!selectedCoilId && coils.length >= limitCount && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setLimitCount((prev) => prev + 20)}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition shadow-sm"
          >
            Cargar 20 más <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* MODALES EXTERNALIZADOS */}
      {editingCoil && (
        <EditCoilModal
          editingCoil={editingCoil}
          editData={editData}
          setEditData={setEditData}
          onClose={() => setEditingCoil(null)}
          onSave={handleSaveEdit}
        />
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <AddCoilForm onOpenChange={setIsAddModalOpen} />
          </div>
        </div>
      )}

      {selectedCoil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            {selectedCoil.status === "AVAILABLE" ? (
              <ProductionForm
                coil={selectedCoil}
                onClose={() => setSelectedCoil(null)}
              />
            ) : (
              <ConsumeStripForm
                coil={selectedCoil}
                onClose={() => setSelectedCoil(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTES PEQUEÑOS (Solo UI para la tabla) ---
function ActionMenu({
  coil,
  role,
  isVoided,
  onProcess,
  onEdit,
  onVoid,
}: {
  coil: Coil;
  role: string | null | undefined;
  isVoided: boolean;
  onProcess: () => void;
  onEdit: () => void;
  onVoid: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (isVoided)
    return (
      <span className="flex items-center justify-center gap-1 text-[10px] font-black text-red-400 uppercase tracking-widest">
        <AlertCircle size={14} /> Sin Efecto
      </span>
    );

  return (
    <div className="relative flex justify-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition"
      >
        <MoreHorizontal size={20} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2">
          <button
            onClick={onProcess}
            disabled={coil.status === "PROCESSED"}
            className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 font-bold disabled:opacity-50 disabled:hover:bg-transparent flex items-center gap-2"
          >
            <Scissors size={16} /> Procesar
          </button>
          {role === "ADMIN" && coil.status === "AVAILABLE" && (
            <>
              <button
                onClick={onEdit}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition font-bold"
              >
                <Edit2 size={16} className="text-gray-400" /> Editar
              </button>
              <div className="h-px bg-gray-100 my-1 mx-2" />
              <button
                onClick={onVoid}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-black flex items-center gap-2 transition"
              >
                <Trash2 size={16} /> Anular
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700 border-green-200",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-200",
    PROCESSED: "bg-gray-100 text-gray-600 border-gray-200",
    VOIDED: "bg-red-100 text-red-700 border-red-200 line-through opacity-80",
  };
  const labels: Record<string, string> = {
    AVAILABLE: "DISPONIBLE",
    IN_PROGRESS: "EN PROCESO",
    PROCESSED: "PROCESADA",
    VOIDED: "ANULADA",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-widest ${styles[status]}`}
    >
      {labels[status] || status}
    </span>
  );
}
