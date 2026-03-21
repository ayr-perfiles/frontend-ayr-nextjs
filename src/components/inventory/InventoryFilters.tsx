import { Search, Filter, X, Loader2 } from "lucide-react";
import { Coil } from "@/types";

interface InventoryFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  isSearching: boolean;
  showSuggestions: boolean;
  suggestions: Coil[];
  onSelectSuggestion: (id: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  onClear: () => void;
  searchInputRef: React.RefObject<HTMLDivElement | null>;
}

export function InventoryFilters({
  searchTerm,
  setSearchTerm,
  isSearching,
  showSuggestions,
  suggestions,
  onSelectSuggestion,
  statusFilter,
  setStatusFilter,
  onClear,
  searchInputRef,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="relative flex-1 flex gap-2" ref={searchInputRef}>
        <div className="relative w-full">
          {isSearching ? (
            <Loader2
              className="absolute left-3 top-2.5 text-blue-500 animate-spin"
              size={18}
            />
          ) : (
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={18}
            />
          )}
          <input
            type="text"
            placeholder="Buscar serie o proveedor..."
            className={`pl-10 w-full p-2 border rounded-lg outline-none focus:border-blue-500 font-medium transition ${
              searchTerm && !showSuggestions
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-white border-gray-200"
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  onClick={() => onSelectSuggestion(suggestion.id)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <p className="font-bold text-gray-800 text-sm">
                    {suggestion.id}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    {suggestion.metadata?.provider ||
                      "Proveedor no especificado"}{" "}
                    • {suggestion.masterWidth}mm
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        {searchTerm && (
          <button
            onClick={onClear}
            className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition"
            title="Limpiar búsqueda"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Filter className="text-gray-400" size={18} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-medium text-gray-700 bg-gray-50 cursor-pointer"
        >
          <option value="ALL">Todas las Bobinas</option>
          <option value="AVAILABLE">Solo Disponibles</option>
          <option value="IN_PROGRESS">En Máquina (Proceso)</option>
        </select>
      </div>
    </div>
  );
}
