import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

interface SunatCpeValidatorProps {
  purchaseId: string;
  invoiceData: {
    numRuc: string;
    codComp: string;
    serie: string;
    numero: string;
    fechaEmision: string; // YYYY-MM-DD
    monto: number;
  };
  validation?: {
    valido: boolean;
    estadoCp: string;
    estadoRuc: string;
    condDomiRuc: string;
    fecha: any;
  };
  onValidated?: () => void;
}

export function SunatCpeValidator({ purchaseId, invoiceData, validation, onValidated }: SunatCpeValidatorProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleValidate = async () => {
    setIsLoading(true);
    const validateFn = httpsCallable(functions, "validarCpeSunat");
    toast.loading("Validando comprobante en SUNAT...", { id: "sunat-validate" });

    try {
      const result: any = await validateFn({
        purchaseId,
        numRuc: invoiceData.numRuc,
        codComp: invoiceData.codComp,
        numeroSerie: invoiceData.serie,
        numero: invoiceData.numero,
        fechaEmision: invoiceData.fechaEmision,
        monto: invoiceData.monto.toFixed(2),
      });

      if (result.data.success) {
        const { valido, estadoCp } = result.data.result;
        if (valido) {
          toast.success(`VÁLIDO: ${estadoCp}`, { id: "sunat-validate" });
        } else {
          toast.error(`NO VÁLIDO: ${estadoCp}`, { id: "sunat-validate" });
        }
        if (onValidated) onValidated();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al validar en SUNAT", { id: "sunat-validate" });
    } finally {
      setIsLoading(false);
    }
  };

  if (validation) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div 
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black border ${
            validation.valido 
              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
              : "bg-red-50 text-red-600 border-red-100"
          }`}
          title={`Estado: ${validation.estadoCp} | RUC: ${validation.estadoRuc} | Condición: ${validation.condDomiRuc}`}
        >
          {validation.valido ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {validation.valido ? "VÁLIDO" : "INVÁLIDO"}
        </div>
        <button 
          onClick={handleValidate}
          disabled={isLoading}
          className="text-[9px] text-slate-400 hover:text-blue-600 flex items-center gap-1 font-bold"
        >
          {isLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          RE-VALIDAR
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleValidate}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg text-[10px] font-black transition disabled:opacity-50 border border-slate-200"
    >
      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
      VALIDAR SUNAT
    </button>
  );
}
