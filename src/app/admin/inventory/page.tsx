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
import { Plus, Download, ChevronDown } from "lucide-react";
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
import { EditCoilModal } from "@/components/inventory/EditCoilModal";
import InventoryTable from "@/components/inventory/InventoryTable";

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

      <InventoryTable
        displayCoils={displayCoils}
        role={role}
        onProcess={handleOpenProduction}
        onEdit={handleOpenEdit}
        onVoid={handleVoidCoil}
      />

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
