"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { db } from "@/lib/firebase/clientApp";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { getCatalog, ProductConfig } from "@/services/catalogService";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { processSingleStrip } from "@/services/productionService";
import { useAuth } from "@/context/AuthContext";
import { Coil } from "@/types";
import {
  Factory,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Plus,
  Minus,
  Search,
  Loader2,
  X,
  Info,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

export function ProduceTab() {
  const { user } = useAuth();
  const [activeCoils, setActiveCoils] = useState<Coil[]>([]);
  const [selectedCoilId, setSelectedCoilId] = useState<string | null>(null);
  const [selectedStripSku, setSelectedStripSku] = useState<string | null>(null);
  const [pieces, setPieces] = useState<number | string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Coil[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);

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
    getCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const getSuggestions = async () => {
      setIsSearching(true);
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.COILS,
          searchParams: {
            query: searchTerm,
            filters: "status:IN_PROGRESS",
            hitsPerPage: 5,
          },
        });
        setSuggestions(
          hits.map((hit: any) => ({ ...hit, id: hit.objectID })) as Coil[],
        );
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error buscando:", error);
      } finally {
        setIsSearching(false);
      }
    };
    const timeoutId = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const expectedPieces = useMemo(() => {
    if (
      !selectedStripSku ||
      !catalog.length ||
      !selectedCoil ||
      !selectedCoil.initialWeight ||
      !selectedCoil.masterWidth
    )
      return 0;
    const product = catalog.find((p) => p.sku === selectedStripSku);
    if (!product || !product.standardWeight) return 0;
    const activeStrip = selectedCoil.plannedStrips?.find(
      (s) => s.sku === selectedStripSku,
    );
    if (!activeStrip) return 0;

    const weightPerMm = selectedCoil.initialWeight / selectedCoil.masterWidth;
    const stripWeight = activeStrip.width * weightPerMm;
    return Math.floor(stripWeight / product.standardWeight);
  }, [selectedStripSku, catalog, selectedCoil]);

  const numericPieces = typeof pieces === "number" ? pieces : Number(pieces);
  const isExceeding = numericPieces > Math.ceil(expectedPieces * 1.05);

  const handleProcess = async () => {
    if (numericPieces <= 0)
      return toast.error("Ingresa una cantidad mayor a 0");
    if (isExceeding)
      return toast.error("La cantidad supera el límite físico del fleje.");
    if (!selectedCoil || !selectedStrip) return;

    setIsProcessing(true);
    const processPromise = processSingleStrip(
      selectedCoil.id,
      selectedStrip.sku,
      numericPieces,
      user?.email || "Operador",
    );

    toast
      .promise(processPromise, {
        loading: "Registrando corte...",
        success: `✅ Registrado: ${numericPieces} piezas de ${selectedStrip.sku}.`,
        error: (err) => `❌ Error: ${err.message}`,
      })
      .then(() => {
        setPieces("");
        setSelectedStripSku(null);
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  if (selectedStrip) {
    return (
      <div className="animate-in fade-in max-w-md mx-auto space-y-6">
        <button
          onClick={() => {
            setPieces("");
            setSelectedStripSku(null);
          }}
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
          <div className="flex justify-between items-end mb-4 px-2">
            <p className="font-bold text-gray-500 uppercase tracking-widest text-[10px]">
              Piezas Producidas
            </p>
            {expectedPieces > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-1 rounded-md flex items-center gap-1">
                <Info size={12} /> Máx. Esperado: ~{expectedPieces}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 mb-2">
            <button
              onClick={() => setPieces((prev) => Math.max(0, Number(prev) - 1))}
              className="w-16 h-16 shrink-0 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center active:bg-red-200 transition"
            >
              <Minus size={32} />
            </button>
            <input
              type="number"
              value={pieces}
              onChange={(e) =>
                setPieces(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="0"
              className={`w-full text-5xl font-black text-center border-2 rounded-2xl p-4 outline-none transition-colors ${isExceeding ? "border-red-400 text-red-600 bg-red-50 focus:border-red-500" : "border-gray-200 text-gray-800 bg-gray-50 focus:border-blue-500 focus:bg-white"}`}
            />
            <button
              onClick={() => setPieces((prev) => Number(prev) + 1)}
              className="w-16 h-16 shrink-0 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center active:bg-green-200 transition"
            >
              <Plus size={32} />
            </button>
          </div>

          <div className="h-8 mb-6 px-2">
            {isExceeding ? (
              <p className="text-xs font-bold text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1">
                <AlertTriangle size={14} /> ¡Imposible! (Máx:{" "}
                {Math.ceil(expectedPieces * 1.05)})
              </p>
            ) : (
              typeof pieces === "number" &&
              expectedPieces > 0 && (
                <p className="text-xs font-bold text-gray-400 flex justify-between animate-in slide-in-from-top-1">
                  <span>Eficiencia de corte:</span>
                  <span
                    className={
                      pieces < expectedPieces * 0.9
                        ? "text-orange-500"
                        : "text-green-500"
                    }
                  >
                    {((pieces / expectedPieces) * 100).toFixed(1)}%
                  </span>
                </p>
              )
            )}
          </div>

          <button
            onClick={handleProcess}
            disabled={isProcessing || numericPieces <= 0 || isExceeding}
            className="w-full bg-blue-600 text-white p-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-50 shadow-xl shadow-blue-200 disabled:shadow-none"
          >
            {isProcessing ? "GUARDANDO..." : "REGISTRAR CORTE"}{" "}
            {!isProcessing && <CheckCircle2 size={28} />}
          </button>
        </div>
      </div>
    );
  }

  if (selectedCoil) {
    return (
      <div className="animate-in fade-in max-w-md mx-auto space-y-4">
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
                className={`w-full p-6 rounded-3xl text-left flex justify-between items-center transition active:scale-95 ${isAvailable ? "bg-white border-2 border-transparent hover:border-blue-500 shadow-sm" : "bg-gray-100 opacity-60"}`}
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
    );
  }

  return (
    <div className="animate-in fade-in max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6 px-2 mt-4 md:mt-0">
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

      <div className="relative flex gap-2 mb-4 z-40" ref={searchInputRef}>
        <div className="relative w-full">
          {isSearching ? (
            <Loader2
              className="absolute left-4 top-4 text-blue-500 animate-spin"
              size={20}
            />
          ) : (
            <Search className="absolute left-4 top-4 text-gray-400" size={20} />
          )}
          <input
            type="text"
            placeholder="Buscar bobina en proceso..."
            className={`pl-12 w-full p-4 bg-white border-2 rounded-2xl outline-none font-bold text-lg transition-colors shadow-sm ${searchTerm && !showSuggestions ? "border-blue-400 text-blue-800" : "border-gray-100 focus:border-blue-500"}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  onClick={() => {
                    setSelectedCoilId(suggestion.id);
                    setSearchTerm("");
                    setShowSuggestions(false);
                  }}
                  className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center"
                >
                  <div>
                    <p className="font-black text-gray-800 text-lg">
                      {suggestion.id}
                    </p>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                      {suggestion.metadata?.provider || "Proveedor"}
                    </p>
                  </div>
                  <ChevronRight className="text-blue-300" size={20} />
                </div>
              ))}
            </div>
          )}
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="px-4 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {activeCoils.length === 0 ? (
        <div className="bg-orange-50 p-8 rounded-3xl text-center border border-orange-100">
          <AlertCircle className="mx-auto text-orange-400 mb-4" size={48} />
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
  );
}
