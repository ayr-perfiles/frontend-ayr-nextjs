"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth, UserRole } from "@/context/AuthContext";
import AdminShell from "@/components/layout/AdminShell";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Loader2, Zap } from "lucide-react";

const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/admin/sales": ["ADMIN"],
  "/admin/quotations": ["ADMIN"],
  "/admin/settings": ["ADMIN"],
  "/admin/setup": ["ADMIN"],
  "/admin/users": ["ADMIN"],
  "/admin/reports": ["ADMIN", "SUPERVISOR"],
  "/admin/coils": ["ADMIN", "SUPERVISOR"],
  "/admin/lines": ["ADMIN", "SUPERVISOR"],
  "/admin/lines/drywall/operator": ["ADMIN", "SUPERVISOR", "OPERATOR"],
  "/admin/lines/metallic-roofing/production": ["ADMIN", "SUPERVISOR", "OPERATOR"],
  "/admin": ["ADMIN", "SUPERVISOR"],
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading, authError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !authError) {
      if (!user) {
        router.push("/login");
        return;
      }
      if (!role) {
        // FIX 2: Usuario logueado pero sin rol (sesión corrupta/obsoleta) -> limpiar persistencia y desloguear
        const cleanupSession = async () => {
          const { getAuth, signOut } = await import("firebase/auth");
          await signOut(getAuth());
          router.push("/login");
        };
        cleanupSession();
        return;
      }

      const currentRouteKey = Object.keys(ROUTE_PERMISSIONS).find(
        (route) => pathname === route || pathname.startsWith(route + "/"),
      );

      if (currentRouteKey) {
        const allowedRoles = ROUTE_PERMISSIONS[currentRouteKey];
        if (!allowedRoles.includes(role)) {
          if (role === "OPERATOR") {
            router.push("/admin/lines/drywall/operator");
          } else if (role === "SUPERVISOR") {
            router.push("/admin");
          } else {
            router.push("/login");
          }
        }
      }
    }
  }, [user, role, loading, authError, router, pathname]);

  if (loading || (user && !role && !authError)) {
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

  if (authError) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 text-gray-800 p-4">
        <div className="flex flex-col items-center max-w-md w-full bg-white rounded-3xl shadow-lg border border-gray-100 p-8 text-center gap-6">
          <div className="bg-red-100 p-4 rounded-full text-red-600">
            <Zap size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error de Conexión</h2>
            <p className="text-sm text-gray-500">
              No pudimos verificar tu sesión. Es posible que tengas problemas de red o conexión a nuestros servidores.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={async () => {
                const { getAuth, signOut } = await import("firebase/auth");
                await signOut(getAuth());
                window.location.href = "/login";
              }}
              className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cerrar Sesión
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Reintentar
            </button>
          </div>
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
  return (
    <AuthProvider>
      <AuthGuard>
        <AdminShell>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AdminShell>
      </AuthGuard>
    </AuthProvider>
  );
}
