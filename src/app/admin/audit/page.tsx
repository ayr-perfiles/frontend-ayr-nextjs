"use client";

import { useEffect, useState } from "react";
import { getAuditLogs, AuditLog } from "@/services/auditService";
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  Trash2,
  Edit2,
  AlertTriangle,
  Info,
  Loader2,
  FileText,
} from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      const data = await getAuditLogs();
      setLogs(data);
      setIsLoading(false);
    };
    loadLogs();
  }, []);

  // Filtrado en memoria por email, detalles o ID de entidad
  const filteredLogs = logs.filter(
    (log) =>
      (log.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Función para dar formato visual según el tipo de acción
  const getActionBadge = (action: string) => {
    switch (action) {
      case "VOID_COIL":
      case "VOID_PRODUCTION":
        return (
          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-200">
            <Trash2 size={12} /> Anulación
          </span>
        );
      case "EDIT_COIL":
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200">
            <Edit2 size={12} /> Edición
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-200">
            <Info size={12} /> {action}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* CABECERA Y BUSCADOR */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-purple-600" /> Registro de Auditoría
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Supervisa las acciones críticas realizadas por tu equipo en el
            sistema.
          </p>
        </div>

        <div className="w-full md:w-96 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por usuario, bobina o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-purple-500 transition"
          />
        </div>
      </div>

      {/* TABLA DE REGISTROS */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center text-purple-500">
            <Loader2 size={48} className="animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center">
            <AlertTriangle size={48} className="mb-4 opacity-50" />
            <h3 className="text-xl font-black text-gray-500">
              No hay registros
            </h3>
            <p className="font-medium mt-2">
              Aún no se han realizado acciones críticas o no coinciden con tu
              búsqueda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Clock size={12} /> Fecha y Hora
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Usuario
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Acción
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Entidad Afectada
                  </th>
                  <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Detalles Técnicos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-purple-50/30 transition">
                    <td className="p-4 pl-6">
                      <p className="text-sm font-bold text-gray-800">
                        {log.timestamp?.toDate
                          ? log.timestamp
                              .toDate()
                              .toLocaleDateString("es-PE", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                          : "---"}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {log.timestamp?.toDate
                          ? log.timestamp
                              .toDate()
                              .toLocaleTimeString("es-PE", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                          : "---"}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <User size={14} className="text-gray-400" />{" "}
                        {log.userEmail.split("@")[0]}
                      </p>
                    </td>
                    <td className="p-4">{getActionBadge(log.action)}</td>
                    <td className="p-4">
                      <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1 w-max">
                        <FileText size={12} /> {log.entityId}
                      </span>
                    </td>
                    <td className="p-4 pr-6">
                      <p className="text-xs font-medium text-gray-600 max-w-sm leading-relaxed">
                        {log.details}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
