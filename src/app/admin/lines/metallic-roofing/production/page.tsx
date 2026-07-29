"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Factory, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { MetallicProductionHistory } from "@/modules/metallic-roofing/components/production/MetallicProductionHistory";
import { listProducts } from "@/modules/metallic-roofing/services/catalogService";
import { QuoteDetailsModalLoader } from "@/components/sales/QuoteDetailsModalLoader";

function ProductionHistoryWrapper() {
  const [skuToFamily, setSkuToFamily] = useState<Record<string, string>>({});
  const [openQuoteId, setOpenQuoteId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    listProducts({ active: true })
      .then((products) => {
        if (!isMounted) return;
        const mapping: Record<string, string> = {};
        for (const p of products) {
          mapping[p.sku] = p.family;
        }
        setSkuToFamily(mapping);
      })
      .catch((err) => console.error("Error loading products:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <MetallicProductionHistory skuToFamily={skuToFamily} onOpenQuote={setOpenQuoteId} />
      {openQuoteId && (
        <QuoteDetailsModalLoader 
          quoteId={openQuoteId} 
          onClose={() => setOpenQuoteId(null)} 
        />
      )}
    </>
  );
}

// ─── Export (con Suspense por useSearchParams) ─────────────────────────────────

export default function MetallicProductionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-16">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      }
    >
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <Factory size={22} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Producción Conformado
              </h1>
              <p className="text-slate-500 font-medium text-sm">
                Aluzinc · Trazabilidad de máquina y control de costos
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link
              href="/admin/lines/metallic-roofing/production/new"
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black uppercase tracking-widest text-xs"
            >
              <Plus size={18} /> Nueva Producción
            </Link>
          </div>
        </div>

        <ProductionHistoryWrapper />
      </div>
    </Suspense>
  );
}
