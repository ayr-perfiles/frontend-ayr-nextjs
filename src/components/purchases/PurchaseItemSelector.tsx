"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/clientApp";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { Search, Plus, Trash2, Info } from "lucide-react";
import type { PurchaseItem } from "@/core/purchases/types";

interface Props {
  businessLine: 'roofing' | 'trading';
  onAdd: (item: PurchaseItem) => void;
}

export function PurchaseItemSelector({ businessLine, onAdd }: Props) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedSku, setSelectedSku] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [unitCost, setUnitCost] = useState<number | "">("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const colName = businessLine === 'roofing' ? 'roofing_catalog' : 'trading_catalog';
      const snap = await getDocs(query(collection(db, colName), orderBy("displayName")));
      setCatalog(snap.docs.map(d => ({ sku: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, [businessLine]);

  const filtered = catalog.filter(p => 
    p.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (!selectedSku || !qty || !unitCost) return;
    
    const product = catalog.find(p => p.sku === selectedSku);
    if (!product) return;

    onAdd({
      sku: selectedSku,
      productName: product.displayName,
      quantity: Number(qty),
      unitCostCurrency: Number(unitCost),
      unitCostPEN: 0, // Se calculará en el form principal basado en el TC
    });

    setQty("");
    setUnitCost("");
  };

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
          <Plus size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Agregar Ítem</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase">Línea: {businessLine}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-6">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Producto</label>
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
          >
            <option value="">Seleccionar producto...</option>
            {catalog.map(p => (
              <option key={p.sku} value={p.sku}>{p.sku} - {p.displayName}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Cantidad</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value ? Number(e.target.value) : "")}
            placeholder="0"
            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Costo Unit. (Sin IGV)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value ? Number(e.target.value) : "")}
              placeholder="0.00"
              className="w-full p-2.5 pl-7 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="md:col-span-1">
          <button
            onClick={handleAdd}
            disabled={!selectedSku || !qty || !unitCost}
            className="w-full h-[42px] bg-slate-800 hover:bg-black text-white rounded-lg flex items-center justify-center transition disabled:opacity-30"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
