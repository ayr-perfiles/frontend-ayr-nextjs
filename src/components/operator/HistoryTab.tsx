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
import { revertProductionLog } from "@/services/productionService";
import { useAuth } from "@/context/AuthContext";
import { ProductionLog } from "@/types";
import {
  Trash2,
  ChevronDown,
  Calendar,
  FilterX,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

export function HistoryTab() {
  const { user, role } = useAuth();
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [limitCount, setLimitCount] = useState(15);

  // --- FILTROS DE RANGO DE FECHAS ---
  const todayISO = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const [startDate, setStartDate] = useState<string>(todayISO);
  const [endDate, setEndDate] = useState<string>(todayISO);
  const [filterCoil, setFilterCoil] = useState<string>("ALL");

  useEffect(() => {
    const logsRef = collection(db, "production_logs");

    // Filtros base: Orden y Límite (Paginación)
    const queryConstraints: any[] = [
      orderBy("timestamp", "desc"),
      limit(limitCount),
    ];

    // 🔒 REGLA DE NEGOCIO: Si NO es ADMIN, solo ve sus propios registros.
    if (role !== "ADMIN" && user?.email) {
      queryConstraints.unshift(where("operatorId", "==", user.email));
    }

    const q = query(logsRef, ...queryConstraints);

    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as ProductionLog,
        ),
      );
    });
    return () => unsub();
  }, [limitCount, role, user?.email]);

  // Lógica de filtrado dinámico en frontend (Fechas y Bobinas)
  const filteredLogs = logs.filter((log) => {
    const passCoil = filterCoil === "ALL" || log.parentCoilId === filterCoil;

    let passDate = true;
    if (log.timestamp?.toDate) {
      const logDateFormatted = log.timestamp
        .toDate()
        .toLocaleDateString("en-CA");
      if (startDate && endDate) {
        passDate = logDateFormatted >= startDate && logDateFormatted <= endDate;
      } else if (startDate) {
        passDate = logDateFormatted >= startDate;
      } else if (endDate) {
        passDate = logDateFormatted <= endDate;
      }
    }

    return passCoil && passDate;
  });

  const uniqueCoilsInLogs = Array.from(
    new Set(logs.map((l) => l.parentCoilId)),
  );

  const handleRevert = async (log: ProductionLog) => {
    if (!log.id) return;
    if (
      confirm(
        `¿Estás seguro de anular la producción de ${log.piecesProduced} piezas?`,
      )
    ) {
      try {
        await revertProductionLog(log.id, user?.email || "Admin");
        toast.success("✅ Registro anulado y fleje restaurado.");
      } catch (e: any) {
        toast.error(`❌ Error: ${e.message}`);
      }
    }
  };

  const formatCompleteDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Fecha desconocida";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-2 mt-4 md:mt-0 mb-2 gap-2">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">
            Historial de Producción
          </h1>
          {role !== "ADMIN" && (
            <p className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block mt-1 uppercase tracking-widest">
              Tus registros (Operador)
            </p>
          )}
        </div>
        <p className="text-sm font-bold text-gray-500 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          Resultados:{" "}
          <span className="text-blue-600">{filteredLogs.length}</span>
        </p>
      </div>

      {/* --- BARRA DE FILTROS AVANZADA --- */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-3 md:flex md:space-y-0 md:gap-4 md:items-center">
        {/* Rango de Fechas */}
        <div className="flex-1 flex flex-col md:flex-row items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition">
          <div className="flex items-center gap-2 w-full">
            <Calendar className="text-gray-400 ml-2" size={20} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent font-bold text-gray-700 outline-none p-1"
              title="Fecha Inicio"
            />
          </div>
          <ArrowRight className="text-gray-300 hidden md:block" size={16} />
          <div className="flex items-center gap-2 w-full border-t md:border-t-0 pt-2 md:pt-0 border-gray-200 md:border-transparent">
            <Calendar className="text-gray-400 ml-2 md:hidden" size={20} />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-transparent font-bold text-gray-700 outline-none p-1"
              title="Fecha Fin"
            />
          </div>
        </div>

        {/* Filtro de Bobina */}
        <div className="md:w-64 shrink-0">
          <select
            value={filterCoil}
            onChange={(e) => setFilterCoil(e.target.value)}
            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todas las Bobinas</option>
            {uniqueCoilsInLogs.map((coilId) => (
              <option key={coilId} value={coilId}>
                {coilId}
              </option>
            ))}
          </select>
        </div>

        {/* Botón para limpiar filtros */}
        {(startDate !== "" || endDate !== "" || filterCoil !== "ALL") && (
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setFilterCoil("ALL");
            }}
            className="p-3.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold transition flex items-center justify-center gap-2 md:w-auto w-full"
            title="Limpiar Filtros"
          >
            <FilterX size={20} />{" "}
            <span className="md:hidden">Quitar Filtros</span>
          </button>
        )}
      </div>

      {/* --- LISTA DE RESULTADOS --- */}
      <div className="flex flex-col gap-4 pt-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center bg-white p-10 rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400 font-black text-lg">
              No hay registros en este rango de fechas.
            </p>
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="mt-2 text-blue-500 font-bold hover:underline"
            >
              Ver todo el historial disponible
            </button>
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isVoided = log.status === "VOIDED";
            return (
              <div
                key={idx}
                className={`bg-white p-5 rounded-3xl shadow-sm border flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 transition relative overflow-hidden ${isVoided ? "border-red-200 opacity-60 bg-red-50/30" : "border-gray-100 hover:shadow-md"}`}
              >
                {isVoided && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="bg-red-600/10 text-red-600 font-black text-4xl uppercase tracking-widest border-4 border-red-600/20 rounded-xl px-8 py-3 rotate-[0deg] md:rotate-[-10deg]">
                      ANULADO
                    </div>
                  </div>
                )}

                <div
                  className={`relative z-20 w-full md:w-auto ${isVoided ? "line-through text-gray-400" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-black text-white px-2.5 py-1 rounded-md uppercase tracking-widest ${isVoided ? "bg-red-400" : "bg-blue-900"}`}
                    >
                      Bobina: {log.parentCoilId}
                    </span>
                    {role === "ADMIN" && (
                      <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-widest">
                        Op: {log.operatorId.split("@")[0]}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 tracking-tight">
                    {log.sku}
                  </h3>
                  <p className="text-sm font-bold text-gray-500 mt-1 capitalize">
                    {formatCompleteDate(log.timestamp)}
                  </p>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto gap-4 relative z-20 border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                  <div
                    className={`flex items-center gap-4 px-6 py-3 rounded-2xl border ${isVoided ? "bg-red-50 border-red-100" : "bg-green-50 border-green-200"}`}
                  >
                    <div className="flex flex-col text-right">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${isVoided ? "text-red-400" : "text-green-700"}`}
                      >
                        Producido
                      </span>
                      <span
                        className={`text-4xl font-black leading-none ${isVoided ? "text-red-400" : "text-green-600"}`}
                      >
                        +{log.piecesProduced}
                      </span>
                    </div>
                    <span
                      className={`font-bold text-sm self-end pb-1 ${isVoided ? "text-red-300" : "text-green-600"}`}
                    >
                      pzas
                    </span>
                  </div>

                  {/* El botón de anular solo lo ven los Administradores */}
                  {role === "ADMIN" && !isVoided && log.id && (
                    <button
                      onClick={() => handleRevert(log)}
                      className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition active:scale-95 shadow-sm"
                      title="Anular Producción"
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

      {logs.length >= limitCount && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setLimitCount((prev) => prev + 15)}
            className="flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition shadow-sm active:scale-95"
          >
            Cargar historial anterior <ChevronDown size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
