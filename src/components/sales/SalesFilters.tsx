import { Search, Loader2, X, Filter, Calendar } from "lucide-react";

interface SalesFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  isSearching: boolean;
  showSuggestions: boolean;
  setShowSuggestions: (val: boolean) => void;
  suggestions: any[];
  selectedCustomerDoc: string | null;
  searchInputRef: React.RefObject<HTMLDivElement | null>;
  setLimitCount: (val: number) => void;
  onSelectSuggestion: (docNumber: string, customerName: string) => void;
  onClearSearch: () => void;
}

export function SalesFilters(props: SalesFiltersProps) {
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isSearching,
    showSuggestions,
    setShowSuggestions,
    suggestions,
    selectedCustomerDoc,
    searchInputRef,
    setLimitCount,
    onSelectSuggestion,
    onClearSearch,
  } = props;

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        {/* RANGO DE FECHAS */}
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* Fecha Inicio */}
          <div className="flex-1 md:w-40">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Calendar size={12} /> Desde
            </label>
            <input
              type="date"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setLimitCount(30);
              }}
            />
          </div>

          {/* Fecha Fin */}
          <div className="flex-1 md:w-40">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Calendar size={12} /> Hasta
            </label>
            <input
              type="date"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium"
              value={endDate}
              min={startDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setLimitCount(30);
              }}
            />
          </div>
        </div>

        {/* FILTRO DE ESTADO (PRODUCTO/ESTADO) */}
        <div className="w-full md:w-48">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Filter size={12} /> Estado de Operación
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setLimitCount(30);
            }}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium text-gray-700"
          >
            <option value="ALL">Todos los Documentos</option>
            <option value="COMPLETED">Ventas Cerradas</option>
            <option value="QUOTATION">Cot. Pendientes</option>
            <option value="CONVERTED">Cot. Aprobadas (Histórico)</option>
          </select>
        </div>

        {/* BUSCADOR DE CLIENTES (BOBINA/CLIENTE) */}
        <div className="w-full flex-1 relative" ref={searchInputRef}>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Search size={12} /> Cliente o Documento
          </label>

          <div className="relative">
            {isSearching ? (
              <Loader2
                className="absolute left-3 top-2.5 text-blue-500 animate-spin"
                size={16}
              />
            ) : (
              <Search
                className="absolute left-3 top-2.5 text-gray-400"
                size={16}
              />
            )}

            <input
              type="text"
              placeholder="Ej: Constructora SAC o 20123456789..."
              className={`w-full p-2.5 pl-9 border rounded-lg outline-none focus:border-blue-500 text-sm font-medium transition ${
                selectedCustomerDoc
                  ? "bg-blue-50 border-blue-300 text-blue-800"
                  : "bg-gray-50 border-gray-200 text-gray-800"
              }`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value === "") onClearSearch();
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
            />

            {/* DROPDOWN DE SUGERENCIAS */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map((suggestion) => {
                  const docNum =
                    suggestion.documentNumber || suggestion.objectID;
                  return (
                    <div
                      key={suggestion.objectID}
                      onClick={() =>
                        onSelectSuggestion(docNum, suggestion.name)
                      }
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <p className="font-bold text-gray-800 text-sm truncate">
                        {suggestion.name}
                      </p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Doc: {docNum}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BOTÓN LIMPIAR TODO */}
        {(startDate ||
          endDate ||
          statusFilter !== "ALL" ||
          selectedCustomerDoc) && (
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setStatusFilter("ALL");
              onClearSearch();
            }}
            className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-bold transition flex-shrink-0 mb-px"
            title="Limpiar todos los filtros"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
