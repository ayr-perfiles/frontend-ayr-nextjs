"use client";

/**
 * Combobox buscable genérico — el canónico del repo para listas dinámicas grandes
 * (cotizaciones, bobinas, SKUs...) que hoy usan `<select>` nativo sin filtro.
 *
 * Contrato: el componente NUNCA toca lógica de negocio. `onChange` emite SOLO el id
 * elegido (`getId(opt)`); el caller decide qué hacer con eso (cascada de resets,
 * delegar a un handler existente, etc.). El componente solo filtra (vía
 * `filterSearchableOptions`) y muestra — es thin client puro.
 *
 * Posicionamiento del listado desplegable: mismo patrón que `RowActionsMenu.tsx`
 * (Portal a document.body + getBoundingClientRect con flip + listeners de
 * click/scroll/resize en window para cerrar).
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ChevronDown } from "lucide-react";
import { filterSearchableOptions } from "./searchableSelectLogic";

interface SearchableSelectProps<T> {
  value: string;
  onChange: (id: string) => void;
  options: T[];
  getId: (opt: T) => string;
  getLabel: (opt: T) => string;
  searchFields: (opt: T) => string[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function SearchableSelect<T>({
  value,
  onChange,
  options,
  getId,
  getLabel,
  searchFields,
  placeholder = "Buscar...",
  disabled = false,
  loading = false,
  emptyMessage = "Sin resultados",
  className = "",
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = options.find((opt) => getId(opt) === value) ?? null;
  const filteredOptions = isOpen ? filterSearchableOptions(options, query, searchFields) : [];

  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spacing = 4;
    const padding = 8;
    const maxHeight = 260;

    let top = rect.bottom + window.scrollY + spacing;
    const left = rect.left + window.scrollX;

    if (rect.bottom + maxHeight + spacing > window.innerHeight) {
      top = rect.top + window.scrollY - maxHeight - spacing;
    }

    setMenuPosition({ top, left: Math.max(padding, left), width: rect.width });
  };

  useEffect(() => {
    if (isOpen) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const close = () => setIsOpen(false);
    const reposition = () => updatePosition();

    window.addEventListener("click", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const openList = () => {
    if (disabled || loading) return;
    setQuery("");
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  const selectOption = (opt: T) => {
    onChange(getId(opt));
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openList();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filteredOptions[highlightedIndex];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setQuery("");
    }
  };

  const displayValue = isOpen ? query : selectedOption ? getLabel(selectedOption) : "";

  return (
    <div ref={wrapperRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="searchable-select-listbox"
          autoComplete="off"
          disabled={disabled || loading}
          placeholder={loading ? "Cargando..." : placeholder}
          value={displayValue}
          onFocus={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full border-2 border-slate-200 rounded-xl p-3 pr-9 text-sm font-bold outline-none focus:border-blue-400 bg-white disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        />
        {loading ? (
          <Loader2 size={16} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        ) : (
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
      </div>

      {mounted &&
        isOpen &&
        !disabled &&
        !loading &&
        createPortal(
          <div
            ref={listRef}
            id="searchable-select-listbox"
            role="listbox"
            className="absolute bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] py-1 overflow-y-auto animate-in fade-in zoom-in-95"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: 260,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 font-medium">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const id = getId(opt);
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={id === value}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-4 py-2 text-sm font-semibold transition-all ${
                      idx === highlightedIndex
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {getLabel(opt)}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
