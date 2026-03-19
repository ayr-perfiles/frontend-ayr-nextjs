"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { Coil } from "@/types";
import {
  Search,
  Plus,
  Filter,
  X,
  Scissors,
  Trash2,
  AlertCircle,
  Edit2,
  Save,
  Download,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { AddCoilForm } from "@/components/forms/AddCoilForm";
import { ProductionForm } from "@/components/forms/ProductionForm";
import { ConsumeStripForm } from "@/components/forms/ConsumeStripForm";
import { seedCoils } from "@/services/seedService";
import { voidCoil, updateCoil } from "@/services/productionService";
import { useAuth } from "@/context/AuthContext";

export default function InventoryPage() {
  const { user, role } = useAuth();
  const [coils, setCoils] = useState<Coil[]>([]);

  // --- ESTADOS DE FILTRO Y PAGINACIÓN ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [limitCount, setLimitCount] = useState(20);

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCoil, setSelectedCoil] = useState<Coil | null>(null);
  const [editingCoil, setEditingCoil] = useState<Coil | null>(null);
  const [editData, setEditData] = useState({
    initialWeight: 0,
    currentWeight: 0,
    masterWidth: 0,
  });

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

  const filteredCoils = coils.filter((c) =>
    c.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleOpenProduction = (coil: Coil) => setSelectedCoil(coil);
  const handleOpenEdit = (coil: Coil) => {
    setEditingCoil(coil);
    setEditData({
      initialWeight: coil.initialWeight,
      currentWeight: coil.currentWeight,
      masterWidth: coil.masterWidth || 1200,
    });
  };

  const handleVoidCoil = async (coilId: string) => {
    if (confirm(`¿Estás seguro de anular la bobina ${coilId}?`)) {
      try {
        await voidCoil(coilId, user?.email || "Admin");
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCoil) return;
    try {
      await updateCoil(editingCoil.id, editData, user?.email || "Admin");
      setEditingCoil(null);
    } catch (error: any) {
      alert(error.message);
    }
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
    const rows = filteredCoils.map((c) => [
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
              onClick={async () => {
                await seedCoils();
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm"
            >
              Generar Test
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm"
          >
            <Plus size={18} /> Nueva Bobina
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar serie localmente..."
            className="pl-10 w-full p-2 border border-gray-200 rounded-lg outline-blue-500 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="text-gray-400" size={18} />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setLimitCount(20);
            }}
            className="p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-medium text-gray-700 bg-gray-50"
          >
            <option value="ALL">Todas las Bobinas</option>
            <option value="AVAILABLE">Solo Disponibles</option>
            <option value="IN_PROGRESS">En Máquina (Proceso)</option>
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL MEJORADA */}
      <div className="bg-white rounded-xl shadow-sm border">
        {/* Nota: Se quitó overflow-hidden y overflow-x-auto para que el menú desplegable no se corte */}
        <div className="w-full">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b">
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
            <tbody className="divide-y divide-gray-100">
              {filteredCoils.map((coil) => {
                const isVoided = coil.status === "VOIDED";

                return (
                  <tr
                    key={coil.id}
                    className={`group transition-colors ${
                      isVoided ? "bg-red-50/10" : "hover:bg-blue-50/20"
                    }`}
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
                        current={coil.currentWeight}
                        initial={coil.initialWeight}
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

              {filteredCoils.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <Search className="text-gray-400" size={24} />
                    </div>
                    <h3 className="text-gray-900 font-medium text-lg">
                      No hay resultados
                    </h3>
                    <p className="text-gray-500 mt-1">
                      No se encontraron bobinas con los filtros actuales.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {coils.length >= limitCount && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setLimitCount((prev) => prev + 20)}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition"
          >
            Cargar 20 más <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* --- MODALES --- */}
      {editingCoil && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">Editar Bobina</h2>
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">
                  {editingCoil.id}
                </p>
              </div>
              <button
                onClick={() => setEditingCoil(null)}
                className="hover:bg-white/20 p-2 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Ancho Master (mm)
                </label>
                <input
                  type="number"
                  value={editData.masterWidth}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      masterWidth: Number(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Peso Inicial (kg)
                </label>
                <input
                  type="number"
                  value={editData.initialWeight}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      initialWeight: Number(e.target.value),
                      currentWeight: Number(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-orange-500 bg-orange-50 p-3 rounded-lg font-medium">
                ⚠️ El peso actual se igualará al peso inicial ya que esta bobina
                aún no tiene cortes.
              </p>

              <button
                onClick={handleSaveEdit}
                className="w-full bg-blue-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-blue-700 transition"
              >
                <Save size={20} /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">
                Registrar Ingreso
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-2">
              <AddCoilForm onOpenChange={setIsAddModalOpen} />
            </div>
          </div>
        </div>
      )}

      {selectedCoil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">
                Panel de Máquina
              </h2>
              <button
                onClick={() => setSelectedCoil(null)}
                className="p-1 hover:bg-gray-200 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-0">
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
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

function WeightIndicator({
  current,
  initial,
}: {
  current: number;
  initial: number;
}) {
  const percentage = Math.max(0, Math.min(100, (current / initial) * 100)) || 0;

  let colorClass = "bg-green-500";
  if (percentage === 0) colorClass = "bg-gray-300";
  else if (percentage <= 25) colorClass = "bg-red-500";
  else if (percentage <= 50) colorClass = "bg-orange-500";

  return (
    <div className="w-full min-w-35">
      <div className="flex justify-between items-end text-xs mb-1.5">
        <span className="font-bold text-gray-800 text-sm">{current} kg</span>
        <span className="text-gray-400 font-medium">/ {initial}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ActionMenu({
  coil,
  role,
  isVoided,
  onProcess,
  onEdit,
  onVoid,
}: {
  coil: Coil;
  role: string | null | undefined; // <--- ¡AQUÍ ESTÁ LA SOLUCIÓN! Agregamos 'null'
  isVoided: boolean;
  onProcess: () => void;
  onEdit: () => void;
  onVoid: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (isVoided) {
    return (
      <span className="flex items-center justify-center gap-1 text-xs font-bold text-red-400 uppercase">
        <AlertCircle size={14} /> Sin Efecto
      </span>
    );
  }

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
            className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 font-semibold disabled:opacity-50 disabled:hover:bg-white flex items-center gap-2"
          >
            <Scissors size={16} /> Procesar
          </button>

          {/* El chequeo de rol seguirá funcionando perfectamente */}
          {role === "ADMIN" && coil.status === "AVAILABLE" && (
            <>
              <button
                onClick={onEdit}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
              >
                <Edit2 size={16} className="text-gray-400" /> Editar
              </button>
              <div className="h-px bg-gray-100 my-1 mx-2" />
              <button
                onClick={onVoid}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 transition"
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
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-widest ${styles[status]}`}
    >
      {labels[status] || status}
    </span>
  );
}
