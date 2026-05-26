"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { BusinessLineModule } from "@/core/contracts";
import { drywallModule } from "@/modules/drywall";

/**
 * Registro central de módulos activos.
 * Para agregar una nueva línea: importar el módulo y añadirlo al array.
 */
const ACTIVE_MODULES: BusinessLineModule[] = [drywallModule];

const STORAGE_KEY = "selectedBusinessLine";

interface BusinessLineContextType {
  activeModule: BusinessLineModule;
  availableModules: BusinessLineModule[];
  setActiveModuleId: (id: string) => void;
}

const BusinessLineContext = createContext<BusinessLineContextType>({
  activeModule: drywallModule,
  availableModules: ACTIVE_MODULES,
  setActiveModuleId: () => {},
});

export function BusinessLineProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeModuleId, setActiveModuleIdState] = useState<string>(
    drywallModule.id,
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ACTIVE_MODULES.some((m) => m.id === saved)) {
      setActiveModuleIdState(saved);
    }
  }, []);

  const setActiveModuleId = (id: string) => {
    setActiveModuleIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeModule =
    ACTIVE_MODULES.find((m) => m.id === activeModuleId) ?? drywallModule;

  return (
    <BusinessLineContext.Provider
      value={{ activeModule, availableModules: ACTIVE_MODULES, setActiveModuleId }}
    >
      {children}
    </BusinessLineContext.Provider>
  );
}

export const useBusinessLine = () => useContext(BusinessLineContext);
