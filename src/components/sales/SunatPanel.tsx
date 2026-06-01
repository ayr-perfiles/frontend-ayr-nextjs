import React, { useState } from "react";
import {
  Cloud,
  CloudOff,
  Send,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { functions, storage } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref } from "firebase/storage";
import toast from "react-hot-toast";

interface SunatPanelProps {
  saleId: string;
  sunatData?: any;
  onRefresh: () => void;
}

export function SunatPanel({ saleId, sunatData, onRefresh }: SunatPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case "ACEPTADO":
        return "text-emerald-600 bg-emerald-50 border-emerald-100";
      case "RECHAZADO":
        return "text-red-600 bg-red-50 border-red-100";
      case "BAJA_ACEPTADA":
        return "text-slate-600 bg-slate-100 border-slate-200";
      case "BAJA_PENDIENTE":
        return "text-orange-600 bg-orange-50 border-orange-100";
      default:
        return "text-blue-600 bg-blue-50 border-blue-100";
    }
  };

  const handleEmit = async () => {
    setIsLoading(true);
    const emitFn = httpsCallable(functions, "emitirComprobante");
    toast.loading("Comunicando con SUNAT...", { id: "sunat-emit" });

    try {
      const result: any = await emitFn({ saleId });
      if (result.data.success) {
        toast.success(`Comprobante ${result.data.documentId} aceptado`, {
          id: "sunat-emit",
        });
        onRefresh();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al emitir comprobante", {
        id: "sunat-emit",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoid = async () => {
    const motivo = prompt("Ingrese el motivo de la anulación ante SUNAT:");
    if (!motivo) return;

    setIsVoiding(true);
    const voidFn = httpsCallable(functions, "comunicarBaja");
    toast.loading("Enviando comunicación de baja...", { id: "sunat-void" });

    try {
      const result: any = await voidFn({ saleId, motivo });
      if (result.data.success) {
        toast.success("Comunicación de baja enviada a SUNAT", {
          id: "sunat-void",
        });
        onRefresh();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al anular comprobante", {
        id: "sunat-void",
      });
    } finally {
      setIsVoiding(false);
    }
  };

  const handleCheckVoidStatus = async () => {
    if (!sunatData?.ticketBaja) return;

    setIsLoading(true);
    const checkFn = httpsCallable(functions, "consultarEstadoBaja");
    toast.loading("Consultando estado del ticket...", { id: "sunat-check" });

    try {
      const result: any = await checkFn({
        ticket: sunatData.ticketBaja,
        saleId,
      });
      if (result.data.success) {
        toast.success(`Estado: ${result.data.estado}`, { id: "sunat-check" });
        onRefresh();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al consultar estado", {
        id: "sunat-check",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async (path: string, fileName: string) => {
    try {
      const fileRef = ref(storage, path);
      const url = await getDownloadURL(fileRef);
      window.open(url, "_blank");
    } catch (error) {
      toast.error("No se pudo descargar el archivo");
    }
  };

  const estado = sunatData?.estado || "NO_EMITIDO";

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Cloud size={14} className="text-blue-500" /> Comprobante Electrónico
        </h3>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatusColor(estado)}`}
        >
          {estado.replace("_", " ")}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {estado === "NO_EMITIDO" ? (
          <div className="text-center py-2">
            <CloudOff size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-medium">
              Este comprobante aún no ha sido enviado a SUNAT.
            </p>
            <button
              onClick={handleEmit}
              disabled={isLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              EMITIR COMPROBANTE
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                  Serie-Número
                </p>
                <p className="text-xs font-bold text-slate-700">
                  {sunatData.documentId || "---"}
                </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                  Hash (Digest)
                </p>
                <p className="text-[10px] font-mono font-medium text-slate-500 truncate">
                  {sunatData.hash || "---"}
                </p>
              </div>
            </div>

            {sunatData.mensajeSunat && (
              <div
                className={`p-3 rounded-lg border text-[11px] flex gap-2 ${estado === "RECHAZADO" ? "bg-red-50 border-red-100 text-red-700" : "bg-blue-50 border-blue-100 text-blue-700"}`}
              >
                {estado === "RECHAZADO" ? (
                  <AlertCircle size={14} className="shrink-0" />
                ) : (
                  <CheckCircle2 size={14} className="shrink-0" />
                )}
                <p>{sunatData.mensajeSunat}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Documentos
              </p>
              <div className="flex flex-wrap gap-2">
                {sunatData.pdfPath && (
                  <button
                    onClick={() =>
                      downloadFile(sunatData.pdfPath, "comprobante.pdf")
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FileText size={12} className="text-red-500" /> PDF
                  </button>
                )}
                {sunatData.xmlPath && (
                  <button
                    onClick={() =>
                      downloadFile(sunatData.xmlPath, "comprobante.xml")
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Download size={12} className="text-blue-500" /> XML
                  </button>
                )}
                {sunatData.cdrPath && (
                  <button
                    onClick={() =>
                      downloadFile(sunatData.cdrPath, "constancia.zip")
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <CheckCircle2 size={12} className="text-emerald-500" /> CDR
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              {estado === "ACEPTADO" && (
                <button
                  onClick={handleVoid}
                  disabled={isVoiding}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-[11px] hover:bg-red-600 hover:text-white transition border border-red-100 disabled:opacity-50"
                >
                  {isVoiding ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  ANULAR ANTE SUNAT
                </button>
              )}
              {estado === "BAJA_PENDIENTE" && (
                <button
                  onClick={handleCheckVoidStatus}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-orange-50 text-orange-600 rounded-lg font-bold text-[11px] hover:bg-orange-600 hover:text-white transition border border-orange-100 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  VERIFICAR ANULACIÓN
                </button>
              )}
              {estado === "RECHAZADO" && (
                <button
                  onClick={handleEmit}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg font-bold text-[11px] hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  RE-INTENTAR EMISIÓN
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
