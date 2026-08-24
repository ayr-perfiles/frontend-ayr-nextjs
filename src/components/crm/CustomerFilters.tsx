import React, { useState } from "react";
import { Loader2, Globe } from "lucide-react";
import { toast } from "react-hot-toast";
import { TableFilters } from "@/components/ui/TableFilters";

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
  const [isDeepSearching, setIsDeepSearching] = useState(false);

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
    } catch (err: any) {
      toast.error(err.message || "Error en la búsqueda externa.");
    } finally {
      setIsDeepSearching(false);
    }
  };

  return (
    <TableFilters
      search={{
        value: searchTerm,
        onChange: (val) => setSearchTerm(val.toUpperCase()),
        placeholder: "Buscar por Razón Social, RUC o DNI...",
        isSearching: isSearching || isDeepSearching,
        onClear: () => setSearchTerm(""),
      }}
      rightSlot={
        <button
          onClick={handleDeepSearch}
          disabled={isDeepSearching || (searchTerm.length !== 8 && searchTerm.length !== 11)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 disabled:opacity-30 transition border border-blue-100 shadow-sm shadow-blue-50 h-[50px]"
          title="Búsqueda profunda en SUNAT/RENIEC"
        >
          {isDeepSearching ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          Oficial
        </button>
      }
    />
  );
}
