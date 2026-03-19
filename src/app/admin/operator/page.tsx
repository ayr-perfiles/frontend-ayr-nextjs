"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  processSingleStrip,
  revertProductionLog,
} from "@/services/productionService";
import { useAuth } from "@/context/AuthContext";
import { Coil, ProductionLog } from "@/types";
import {
  Factory,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Plus,
  Minus,
  History,
  Wrench,
  Trash2,
  ChevronDown, // <-- Nuevo icono importado
} from "lucide-react";

export default function OperatorTerminal() {
  const { user, role } = useAuth();

  const [activeTab, setActiveTab] = useState<"PRODUCE" | "HISTORY">("PRODUCE");

  const [activeCoils, setActiveCoils] = useState<Coil[]>([]);
  const [selectedCoilId, setSelectedCoilId] = useState<string | null>(null);
  const [selectedStripSku, setSelectedStripSku] = useState<string | null>(null);
  const [pieces, setPieces] = useState<number | string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [filterDate, setFilterDate] = useState<"TODAY" | "ALL">("TODAY");
  const [filterCoil, setFilterCoil] = useState<string>("ALL");

  // --- PAGINACIÓN ---
  const [limitCount, setLimitCount] = useState(30);

  const selectedCoil = activeCoils.find((c) => c.id === selectedCoilId) || null;
  const selectedStrip =
    selectedCoil?.plannedStrips?.find((s) => s.sku === selectedStripSku) ||
    null;

  useEffect(() => {
    const q = query(
      collection(db, "coils"),
      where("status", "==", "IN_PROGRESS"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setActiveCoils(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Coil),
      );
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // APLICAMOS LA PAGINACIÓN DINÁMICA AQUÍ
    const q = query(
      collection(db, "production_logs"),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as ProductionLog,
        ),
      );
    });
    return () => unsub();
  }, [limitCount]); // Se actualiza si el límite cambia

  const handleProcess = async () => {
    const numericPieces = Number(pieces);
    if (numericPieces <= 0)
      return alert("Ingresa una cantidad válida mayor a 0");
    if (!selectedCoil || !selectedStrip) return;

    setIsProcessing(true);
    try {
      await processSingleStrip(
        selectedCoil.id,
        selectedStrip.sku,
        numericPieces,
        user?.email || "Operador",
      );
      alert(`✅ Registrado: ${numericPieces} piezas de ${selectedStrip.sku}.`);
      setPieces("");
      setSelectedStripSku(null);
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const passCoil = filterCoil === "ALL" || log.parentCoilId === filterCoil;
    let passDate = true;
    if (filterDate === "TODAY" && log.timestamp) {
      const logDate = log.timestamp.toDate
        ? log.timestamp.toDate().toDateString()
        : new Date().toDateString();
      passDate = logDate === new Date().toDateString();
    }
    return passCoil && passDate;
  });

  const uniqueCoilsInLogs = Array.from(
    new Set(logs.map((l) => l.parentCoilId)),
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen lg:min-h-0 lg:rounded-3xl">
      {/* PESTAÑAS PARA PC (Ocultas en móvil) */}
      <div className="hidden md:flex justify-center gap-4 p-6 bg-white border-b border-gray-100 lg:rounded-t-3xl">
        <button
          onClick={() => setActiveTab("PRODUCE")}
          className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-2 ${activeTab === "PRODUCE" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
        >
          <Wrench size={18} /> Producir
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-2 ${activeTab === "HISTORY" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
        >
          <History size={18} /> Historial
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
      {/* En móvil tiene un padding inferior de 24 (pb-24) para no tapar la barra inferior. En PC es pb-8 */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-8">
        {/* =========================================
            PESTAÑA: HISTORIAL DE PRODUCCIÓN
            ========================================= */}
        {activeTab === "HISTORY" && (
          <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in">
            <h1 className="text-2xl font-black text-gray-800 tracking-tight px-2 mt-4 md:mt-0">
              Historial de Producción
            </h1>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-3 md:flex md:space-y-0 md:gap-4 md:items-center">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl md:w-64 shrink-0">
                <button
                  onClick={() => setFilterDate("TODAY")}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${filterDate === "TODAY" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                >
                  Solo Hoy
                </button>
                <button
                  onClick={() => setFilterDate("ALL")}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${filterDate === "ALL" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                >
                  Todos
                </button>
              </div>
              <select
                value={filterCoil}
                onChange={(e) => setFilterCoil(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Todas las Bobinas</option>
                {uniqueCoilsInLogs.map((coilId) => (
                  <option key={coilId} value={coilId}>
                    {coilId}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredLogs.length === 0 ? (
                <p className="text-center text-gray-400 font-bold mt-10 md:col-span-2">
                  No hay registros para este filtro.
                </p>
              ) : (
                filteredLogs.map((log, idx) => {
                  const isVoided = log.status === "VOIDED";

                  return (
                    <div
                      key={idx}
                      className={`bg-white p-5 rounded-3xl shadow-sm border flex justify-between items-center transition relative overflow-hidden ${isVoided ? "border-red-200 opacity-60 bg-red-50/30" : "border-gray-100 hover:shadow-md"}`}
                    >
                      {/* Sello de Anulado */}
                      {isVoided && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <div className="bg-red-600/10 text-red-600 font-black text-3xl uppercase tracking-widest border-4 border-red-600/20 rounded-xl px-6 py-2 rotate-[-10deg]">
                            ANULADO
                          </div>
                        </div>
                      )}

                      <div
                        className={`relative z-20 ${isVoided ? "line-through text-gray-400" : ""}`}
                      >
                        <span
                          className={`text-[10px] font-black text-white px-2 py-1 rounded-md uppercase ${isVoided ? "bg-red-400" : "bg-blue-900"}`}
                        >
                          {log.parentCoilId}
                        </span>
                        <h3 className="text-xl font-black mt-2">{log.sku}</h3>
                        <p className="text-xs font-medium flex items-center gap-1 mt-1">
                          {log.timestamp?.toDate
                            ? log.timestamp.toDate().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Reciente"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 relative z-20">
                        <div
                          className={`text-right px-4 py-3 rounded-2xl border ${isVoided ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}
                        >
                          <span
                            className={`text-3xl font-black ${isVoided ? "text-red-400" : "text-green-600"}`}
                          >
                            +{log.piecesProduced}
                          </span>
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isVoided ? "text-red-400" : "text-green-700"}`}
                          >
                            Piezas
                          </p>
                        </div>

                        {/* Botón de Anular (Solo visible para ADMIN si el log no está anulado) */}
                        {role === "ADMIN" && !isVoided && log.id && (
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  `¿Estás seguro de anular la producción de ${log.piecesProduced} piezas? Esto devolverá el fleje a la bobina.`,
                                )
                              ) {
                                try {
                                  await revertProductionLog(
                                    log.id!,
                                    user?.email || "Admin",
                                  );
                                  alert(
                                    "✅ Registro anulado y fleje restaurado.",
                                  );
                                } catch (e: any) {
                                  alert(`❌ Error: ${e.message}`);
                                }
                              }
                            }}
                            className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition active:scale-95 shadow-sm"
                            title="Anular Registro"
                          >
                            <Trash2 size={24} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* BOTÓN CARGAR MÁS (PAGINACIÓN MÓVIL) */}
            {logs.length >= limitCount && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setLimitCount((prev) => prev + 30)}
                  className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition shadow-sm active:scale-95"
                >
                  Cargar más anteriores <ChevronDown size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================
            PESTAÑA: PRODUCIR
            ========================================= */}
        {activeTab === "PRODUCE" && (
          <div className="animate-in fade-in pt-4 md:pt-0">
            {selectedStrip ? (
              <div className="max-w-md mx-auto space-y-6">
                <button
                  onClick={() => setSelectedStripSku(null)}
                  className="flex items-center gap-2 text-blue-600 font-bold p-2 active:scale-95 transition hover:bg-blue-50 rounded-xl"
                >
                  <ArrowLeft size={24} /> Volver a perfiles
                </button>

                <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-blue-100 text-center">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Procesando
                  </p>
                  <h2 className="text-4xl font-black text-blue-900">
                    {selectedStrip.sku}
                  </h2>
                  <div className="inline-block bg-blue-50 text-blue-700 px-4 py-1 rounded-full text-sm font-bold mt-3 border border-blue-100">
                    Disponibles: {selectedStrip.pendingCount} flejes
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <p className="text-center font-bold text-gray-500 uppercase mb-6">
                    Piezas Producidas
                  </p>

                  <div className="flex items-center justify-center gap-4 mb-8">
                    <button
                      onClick={() =>
                        setPieces((prev) => Math.max(0, Number(prev) - 1))
                      }
                      className="w-16 h-16 shrink-0 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center active:bg-red-200 transition"
                    >
                      <Minus size={32} />
                    </button>
                    <input
                      type="number"
                      value={pieces}
                      onChange={(e) =>
                        setPieces(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="0"
                      className="w-full text-5xl font-black text-gray-800 text-center bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                    <button
                      onClick={() => setPieces((prev) => Number(prev) + 1)}
                      className="w-16 h-16 shrink-0 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center active:bg-green-200 transition"
                    >
                      <Plus size={32} />
                    </button>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={isProcessing || Number(pieces) <= 0}
                    className="w-full bg-blue-600 text-white p-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-50 shadow-xl shadow-blue-200"
                  >
                    {isProcessing ? "GUARDANDO..." : "REGISTRAR CORTE"}{" "}
                    <CheckCircle2 size={28} />
                  </button>
                </div>
              </div>
            ) : selectedCoil ? (
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => setSelectedCoilId(null)}
                    className="flex items-center gap-2 text-blue-600 font-bold p-2 active:scale-95 transition hover:bg-blue-50 rounded-xl"
                  >
                    <ArrowLeft size={24} /> Volver
                  </button>
                  <span className="font-black text-white bg-gray-800 px-3 py-1 rounded-lg shadow-sm">
                    {selectedCoil.id}
                  </span>
                </div>
                <h2 className="text-xl font-black text-gray-800 px-2 mb-4">
                  ¿Qué perfil vas a procesar?
                </h2>
                <div className="space-y-3">
                  {selectedCoil.plannedStrips?.map((strip, idx) => {
                    const isAvailable = strip.pendingCount > 0;
                    return (
                      <button
                        key={idx}
                        disabled={!isAvailable}
                        onClick={() => {
                          setPieces("");
                          setSelectedStripSku(strip.sku);
                        }}
                        className={`w-full p-6 rounded-3xl text-left flex justify-between items-center transition active:scale-95 ${
                          isAvailable
                            ? "bg-white border-2 border-transparent hover:border-blue-500 shadow-sm"
                            : "bg-gray-100 opacity-60"
                        }`}
                      >
                        <div>
                          <h3 className="text-2xl font-black text-gray-800">
                            {strip.sku}
                          </h3>
                          <p
                            className={`text-sm font-bold mt-1 ${isAvailable ? "text-green-600" : "text-gray-400"}`}
                          >
                            {isAvailable
                              ? `${strip.pendingCount} flejes listos`
                              : "Agotado"}
                          </p>
                        </div>
                        {isAvailable && (
                          <ChevronRight className="text-blue-500" size={28} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-8 px-2 mt-4 md:mt-0">
                  <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
                    <Factory className="text-white" size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-gray-800 tracking-tight italic">
                      AYR Planta
                    </h1>
                    <p className="text-gray-500 text-sm font-bold">
                      Selecciona bobina activa
                    </p>
                  </div>
                </div>

                {activeCoils.length === 0 ? (
                  <div className="bg-orange-50 p-8 rounded-3xl text-center border border-orange-100">
                    <AlertCircle
                      className="mx-auto text-orange-400 mb-4"
                      size={48}
                    />
                    <h3 className="text-xl font-black text-orange-800">
                      Máquina Detenida
                    </h3>
                    <p className="text-orange-600 mt-2 font-medium">
                      No hay bobinas en proceso.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeCoils.map((coil) => (
                      <button
                        key={coil.id}
                        onClick={() => setSelectedCoilId(coil.id)}
                        className="w-full bg-gray-900 text-white p-6 rounded-3xl text-left flex justify-between items-center active:scale-95 transition shadow-xl hover:bg-black"
                      >
                        <div>
                          <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">
                            Bobina Madre
                          </p>
                          <h3 className="text-3xl font-black tracking-tighter">
                            {coil.id}
                          </h3>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl text-blue-400">
                          <ChevronRight size={32} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================
          BARRA DE NAVEGACIÓN INFERIOR (Oculta en PC)
          ========================================= */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-around items-center fixed bottom-0 w-full md:hidden z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab("PRODUCE")}
          className={`flex flex-col items-center gap-1 transition ${activeTab === "PRODUCE" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <div
            className={`p-2 rounded-xl ${activeTab === "PRODUCE" ? "bg-blue-50" : "bg-transparent"}`}
          >
            <Wrench size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">
            Producir
          </span>
        </button>

        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`flex flex-col items-center gap-1 transition ${activeTab === "HISTORY" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <div
            className={`p-2 rounded-xl ${activeTab === "HISTORY" ? "bg-blue-50" : "bg-transparent"}`}
          >
            <History size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">
            Historial
          </span>
        </button>
      </div>
    </div>
  );
}
