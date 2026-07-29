import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { Sale } from "@/types";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import { Loader2 } from "lucide-react";

interface QuoteDetailsModalLoaderProps {
  quoteId: string;
  onClose: () => void;
}

export function QuoteDetailsModalLoader({ quoteId, onClose }: QuoteDetailsModalLoaderProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    getDoc(doc(db, "sales", quoteId))
      .then((snap) => {
        if (!isMounted) return;
        if (!snap.exists()) {
          setError(true);
        } else {
          setSale({ ...snap.data(), id: snap.id } as Sale);
        }
      })
      .catch((err) => {
        console.error("Error loading quote", err);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => {
      isMounted = false;
    };
  }, [quoteId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow-xl flex items-center gap-3">
          <Loader2 className="animate-spin text-emerald-500" />
          <span className="text-slate-600 font-medium">Cargando cotización...</span>
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Cotización no disponible</h3>
          <p className="text-sm text-slate-500 mb-6">El documento no fue encontrado o fue eliminado.</p>
          <button 
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return <SaleDetailsModal sale={sale} onClose={onClose} />;
}
