"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth, UserRole } from "@/context/AuthContext";
import Sidebar from "@/components/layout/sidebar";
import { Loader2, Zap, Menu, X } from "lucide-react";

const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/admin/sales": ["ADMIN"],
  "/admin/settings": ["ADMIN"],
  "/admin/users": ["ADMIN"],
  "/admin/reports": ["ADMIN", "SUPERVISOR"],
  "/admin/inventory": ["ADMIN", "SUPERVISOR"],
  "/admin/production": ["ADMIN", "SUPERVISOR"],
  "/admin/operator": ["ADMIN", "SUPERVISOR", "OPERATOR"],
  "/admin": ["ADMIN"],
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
        return;
      }
      if (!role) return;

      const currentRouteKey = Object.keys(ROUTE_PERMISSIONS).find(
        (route) => pathname === route || pathname.startsWith(route + "/"),
      );

      if (currentRouteKey) {
        const allowedRoles = ROUTE_PERMISSIONS[currentRouteKey];
        if (!allowedRoles.includes(role)) {
          if (role === "OPERATOR") {
            router.push("/admin/operator");
          } else if (role === "SUPERVISOR") {
            router.push("/admin/inventory");
          } else {
            router.push("/login");
          }
        }
      }
    }
  }, [user, role, loading, router, pathname]);

  if (loading || (user && !role)) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 text-gray-800">
        <div className="flex items-center gap-3 p-6 bg-white rounded-3xl shadow-lg border border-gray-100">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200">
            <Zap size={28} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tighter italic">
              AYR STEEL
            </h1>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              Cargando...
            </p>
          </div>
          <Loader2 className="animate-spin ml-6 text-gray-400" size={32} />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMobileTerminal = pathname === "/admin/operator";

  // ESTADO PARA EL MENÚ MÓVIL
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Cerrar el menú móvil automáticamente cuando el usuario cambia de página
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <AuthProvider>
      <AuthGuard>
        <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
          {/* =========================================
              CABECERA MÓVIL (Visible solo en pantallas pequeñas)
              ========================================= */}
          <div className="lg:hidden absolute top-0 left-0 w-full bg-gray-900 text-white p-4 flex justify-between items-center z-30 shadow-md">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-blue-500" fill="currentColor" />
              <h1 className="text-lg font-black tracking-tighter italic">
                AYR STEEL
              </h1>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 bg-gray-800 rounded-xl hover:bg-gray-700 transition active:scale-95"
            >
              <Menu size={24} />
            </button>
          </div>

          {/* =========================================
              SIDEBAR (Lateral) Y OVERLAY MÓVIL
              ========================================= */}
          {/* Overlay oscuro para móvil */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Contenedor del Sidebar */}
          <div
            className={`
            fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
            lg:relative lg:translate-x-0
            ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          `}
          >
            {/* Botón para cerrar en móvil */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden absolute top-4 -right-12 p-2 bg-white text-gray-900 rounded-xl shadow-xl"
            >
              <X size={24} />
            </button>

            <Sidebar />
          </div>

          {/* =========================================
              CONTENIDO PRINCIPAL
              ========================================= */}
          <main
            className={`flex-1 overflow-y-auto ${isMobileTerminal ? "p-0 pt-16 lg:pt-0" : "p-4 pt-20 lg:p-8 lg:pt-8"}`}
          >
            {children}
          </main>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
