import React, { useState, useRef, useEffect } from "react";
import { Search, Loader2, X, Filter, ChevronDown, Globe } from "lucide-react";
import { toast } from "react-hot-toast";

interface CustomerFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  isSearching: boolean;
}

export function CustomerFilters({
  searchTerm,
  setSearchTerm,
  isSearching,
}: CustomerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDeepSearch = async () => {
    const target = searchTerm.trim();
    if (target.length !== 8 && target.length !== 11) {
      return toast.error("Ingresa un DNI (8) o RUC (11) válido para buscar en registros oficiales.");
    }

    setIsDeepSearching(true);
    try {
      const res = await fetch(`/api/consulta-doc?numero=${target}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "No se encontró el documento.");
      
      const isRUC = target.length === 11;
      const nombre = isRUC
        ? (data.razon_social ?? data.razonSocial)
        : `${data.nombres ?? data.first_name} ${data.apellidoPaterno ?? data.first_last_name} ${data.apellidoMaterno ?? data.second_last_name}`;
      
      toast.success(
        <div>
          <p className="font-bold">¡Documento encontrado!</p>
          <p className="text-xs">{nombre}</p>
        </div>,
        { duration: 5000 }
      );
      
      // Aquí podríamos abrir un modal para crear el cliente con estos datos
      // Por ahora solo notificamos que se encontró.
    } catch (err: any) {
      toast.error(err.message || "Error en la búsqueda externa.");
    } finally {
      setIsDeepSearching(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div
      className="flex flex-col sm:flex-row gap-3 relative z-30"
      ref={menuRef}
    >
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          {isSearching || isDeepSearching ? (
            <Loader2 className="text-blue-500 animate-spin" size={18} />
          ) : (
            <Search className="text-slate-400" size={18} />
          )}
        </div>
        <input
          type="text"
          placeholder="Buscar por Razón Social, RUC o DNI..."
          className="w-full pl-10 pr-24 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-medium text-slate-700 transition shadow-sm uppercase"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDeepSearch()}
        />
        <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="p-2 text-slate-400 hover:text-red-500 transition"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={handleDeepSearch}
            disabled={isDeepSearching || (searchTerm.length !== 8 && searchTerm.length !== 11)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tight hover:bg-blue-100 disabled:opacity-30 transition border border-blue-100"
            title="Búsqueda profunda en SUNAT/RENIEC"
          >
            {isDeepSearching ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
            Oficial
          </button>
        </div>
      </div>

      <div className="relative sm:w-auto w-full">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition border shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Filter size={18} className="text-slate-400" /> Opciones{" "}
          <ChevronDown
            size={16}
            className={`ml-1 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 sm:left-auto left-0 top-full mt-2 w-full sm:w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 z-50">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={14} /> Opciones de CRM
            </h4>
            <p className="text-xs font-medium text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-slate-100">
              Más filtros (ej. Por Deuda o Ciudad) se activarán próximamente.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-xl text-sm font-bold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
