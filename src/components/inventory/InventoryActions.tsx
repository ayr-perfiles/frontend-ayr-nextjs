"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  Scissors,
  Edit2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Coil } from "@/types";

interface InventoryActionsProps {
  coil: Coil;
  role: string | null | undefined;
  isVoided: boolean;
  onProcess: () => void;
  onEdit: () => void;
  onVoid: () => void;
}

export default function InventoryActions({
  coil,
  role,
  isVoided,
  onProcess,
  onEdit,
  onVoid,
}: InventoryActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  // Evita errores de hidratación en Next.js
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cierra el menú automáticamente si el usuario hace scroll
  useEffect(() => {
    const handleScroll = () => setIsOpen(false);
    if (isOpen) {
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  if (isVoided) {
    return (
      <span className="flex items-center justify-center gap-1 text-[10px] font-black text-red-400 uppercase tracking-widest">
        <AlertCircle size={14} /> Sin Efecto
      </span>
    );
  }

  const openMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        // Posicionamos el menú justo debajo del botón
        top: rect.bottom + window.scrollY + 4,
        // Alinear a la derecha restando el ancho aproximado del menú (160px)
        left: rect.right - 160,
      });
      setIsOpen(true);
    }
  };

  return (
    <>
      <div className="relative flex justify-center">
        <button
          ref={buttonRef}
          onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
          className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* PORTAL: Renderiza el menú en el body, fuera del contenedor de la tabla */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            style={{ pointerEvents: "none" }}
          >
            {/* Overlay invisible en toda la pantalla para cerrar al clic */}
            <div
              className="absolute inset-0"
              style={{ pointerEvents: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />

            {/* Menú Flotante */}
            <div
              className="absolute w-40 bg-white border border-gray-100 rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                pointerEvents: "auto",
              }}
            >
              <button
                onClick={() => {
                  setIsOpen(false);
                  onProcess();
                }}
                disabled={coil.status === "PROCESSED"}
                className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 font-bold disabled:opacity-50 flex items-center gap-2"
              >
                <Scissors size={16} /> Procesar
              </button>

              {role === "ADMIN" && coil.status === "AVAILABLE" && (
                <>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onEdit();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition font-bold"
                  >
                    <Edit2 size={16} className="text-gray-400" /> Editar
                  </button>
                  <div className="h-px bg-gray-100 my-1 mx-2" />
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onVoid();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-black flex items-center gap-2 transition"
                  >
                    <Trash2 size={16} /> Anular
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
