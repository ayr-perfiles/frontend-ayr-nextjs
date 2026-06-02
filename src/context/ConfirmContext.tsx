"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

export type ConfirmVariant = "default" | "danger" | "warning";

export interface ConfirmRequireInput {
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  matchValue?: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  requireInput?: ConfirmRequireInput;
}

export type ConfirmResult = boolean | { confirmed: boolean; value: string };

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<any>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [inputValue, setInputValue] = useState("");
  const resolver = useRef<((value: ConfirmResult) => void) | null>(null);

  const confirm = useCallback((confirmOptions: ConfirmOptions): Promise<any> => {
    setOptions(confirmOptions);
    setInputValue(confirmOptions.requireInput?.defaultValue || "");
    setIsOpen(true);

    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (!resolver.current) return;
    
    if (options?.requireInput) {
      resolver.current({ confirmed: false, value: "" });
    } else {
      resolver.current(false);
    }
    
    setIsOpen(false);
    setOptions(null);
  }, [options]);

  const handleConfirm = useCallback(() => {
    if (!resolver.current) return;

    if (options?.requireInput) {
      resolver.current({ confirmed: true, value: inputValue.trim() });
    } else {
      resolver.current(true);
    }

    setIsOpen(false);
    setOptions(null);
  }, [options, inputValue]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        handleCancel();
      }
      
      if (e.key === "Enter" && !isConfirmDisabled) {
        // Prevent form submission if in a form
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel, handleConfirm]);

  const isConfirmDisabled = options?.requireInput 
    ? (options.requireInput.required && !inputValue.trim()) || 
      (options.requireInput.matchValue !== undefined && inputValue.trim() !== options.requireInput.matchValue)
    : false;

  const variantStyles = {
    default: "bg-blue-600 hover:bg-blue-700 shadow-blue-100",
    danger: "bg-red-600 hover:bg-red-700 shadow-red-100",
    warning: "bg-amber-500 hover:bg-amber-600 shadow-amber-100",
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCancel}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-6 flex justify-between items-start ${options.variant === 'danger' ? 'bg-red-50/50' : 'bg-slate-50/50'}`}>
              <div className="flex gap-3">
                {options.variant === 'danger' && (
                  <div className="bg-red-100 p-2 rounded-xl text-red-600">
                    <AlertTriangle size={24} />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {options.title}
                  </h3>
                  {options.message && (
                    <div className="text-slate-500 font-medium mt-1 text-sm leading-relaxed">
                      {options.message}
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Input area */}
            {options.requireInput && (
              <div className="p-6 pt-0">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  {options.requireInput.label}
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder={options.requireInput.placeholder}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                {options.requireInput.matchValue && (
                  <p className="mt-2 text-[10px] font-bold text-slate-400 italic">
                    Escribe exactamente <span className="text-slate-600 not-italic">"{options.requireInput.matchValue}"</span> para confirmar.
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="p-6 pt-2 flex flex-col-reverse sm:flex-row gap-3 justify-end">
              <button
                autoFocus={!options.requireInput}
                onClick={handleCancel}
                className="px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl transition"
              >
                {options.cancelLabel || "Cancelar"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className={`px-8 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-lg disabled:opacity-50 disabled:shadow-none ${variantStyles[options.variant || "default"]}`}
              >
                {options.confirmLabel || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

/**
 * MODO DE USO:
 * 
 * 1. En el componente:
 *    const confirm = useConfirm();
 * 
 * 2. Acción simple:
 *    if (await confirm({ 
 *      title: "Anular Bobina", 
 *      message: "¿Seguro?", 
 *      variant: "danger" 
 *    })) { ... }
 * 
 * 3. Con Input (Reemplaza prompt):
 *    const res = await confirm({
 *      title: "Motivo de anulación",
 *      requireInput: { label: "Escriba el motivo", required: true }
 *    });
 *    if (res.confirmed) { console.log(res.value); }
 * 
 * 4. Con Validación Exacta:
 *    const res = await confirm({
 *      title: "⚠️ ACCIÓN CRÍTICA",
 *      message: "Esto borrará TODO.",
 *      variant: "danger",
 *      requireInput: { label: 'Escribe "ELIMINAR"', matchValue: "ELIMINAR" }
 *    });
 */
