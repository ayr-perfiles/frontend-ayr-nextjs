"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useBusinessLine } from "@/context/BusinessLineContext";
import { BusinessLineSelector } from "./BusinessLineSelector";
import type { MenuItem } from "@/core/contracts";
import {
  LayoutDashboard,
  Database,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronRight,
  Zap,
  LogOut,
  Users,
  History,
  Contact2,
  ShieldAlert,
  Smartphone,
  Package,
  Layers,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

// Resuelve el nombre de ícono (string) a componente Lucide
function resolveIcon(name: string): ComponentType<LucideProps> {
  const map: Record<string, ComponentType<LucideProps>> = {
    Database,
    Factory,
    Smartphone,
    Package,
    Layers,
  };
  return map[name] ?? Layers;
}

// Convierte MenuItem del módulo al shape que espera el renderizador del sidebar
function moduleItemToNavItem(item: MenuItem) {
  return {
    name: item.label,
    href: item.href,
    icon: resolveIcon(item.icon),
    allowedRoles: (item.roles ?? ["ADMIN", "SUPERVISOR", "OPERATOR"]) as UserRole[],
  };
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const { activeModule } = useBusinessLine();

  const menuGroups = [
    {
      title: "Visión General",
      items: [
        {
          name: "Dashboard",
          href: "/admin",
          icon: LayoutDashboard,
          allowedRoles: ["ADMIN"] as UserRole[],
        },
      ],
    },
    {
      title: activeModule.displayName,
      items: activeModule.sidebarItems.map(moduleItemToNavItem),
    },
    {
      title: "Área Comercial",
      items: [
        {
          name: "Ventas",
          href: "/admin/sales",
          icon: ShoppingCart,
          allowedRoles: ["ADMIN", "SUPERVISOR"] as UserRole[],
        },
        {
          name: "Clientes",
          href: "/admin/customers",
          icon: Contact2,
          allowedRoles: ["ADMIN", "SUPERVISOR"] as UserRole[],
        },
      ],
    },
    {
      title: "Control y Auditoría",
      items: [
        {
          name: "Kardex",
          href: "/admin/kardex",
          icon: History,
          allowedRoles: ["ADMIN", "SUPERVISOR"] as UserRole[],
        },
        {
          name: "Reportes",
          href: "/admin/reports",
          icon: BarChart3,
          allowedRoles: ["ADMIN", "SUPERVISOR"] as UserRole[],
        },
        {
          name: "Auditoría",
          href: "/admin/audit",
          icon: ShieldAlert,
          allowedRoles: ["ADMIN"] as UserRole[],
        },
      ],
    },
    {
      title: "Administración",
      items: [
        {
          name: "Usuarios",
          href: "/admin/users",
          icon: Users,
          allowedRoles: ["ADMIN"] as UserRole[],
        },
        {
          name: "Configuración",
          href: "/admin/settings",
          icon: Settings,
          allowedRoles: ["ADMIN"] as UserRole[],
        },
      ],
    },
  ];

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 font-sans shadow-sm z-40">
      {/* LOGO EMPRESA */}
      <div className="p-8 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tighter italic leading-none">
              AYR STEEL
            </h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
              ERP Privado
            </p>
          </div>
        </div>
      </div>

      {/* SELECTOR DE LÍNEA DE NEGOCIO */}
      <BusinessLineSelector />

      {/* MENÚ DE NAVEGACIÓN AGRUPADO */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group, groupIndex) => {
          const filteredItems = group.items.filter((item) =>
            item.allowedRoles.includes(role as UserRole),
          );

          if (filteredItems.length === 0) return null;

          return (
            <div key={groupIndex} className="space-y-1">
              <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {group.title}
              </p>

              {filteredItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group flex items-center justify-between p-3 rounded-xl transition-all duration-200
                      ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-gray-500 font-semibold hover:bg-gray-50 hover:text-gray-900"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`transition-colors ${isActive ? "text-blue-600" : "text-gray-400 group-hover:text-blue-500"}`}
                      >
                        <item.icon size={20} />
                      </div>
                      <span className="text-sm">{item.name}</span>
                    </div>
                    {isActive && (
                      <ChevronRight size={16} className="text-blue-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* FOOTER DE USUARIO */}
      <div className="p-6 border-t border-gray-50 bg-gray-50/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center text-sm font-black text-blue-700">
            {role ? role.substring(0, 2) : "US"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-gray-800 truncate">
              {user?.email?.split("@")[0]}
            </p>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              {role}
            </p>
          </div>
        </div>

        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center justify-center gap-2 p-2.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition font-bold text-xs uppercase tracking-wider border border-transparent hover:border-red-100"
        >
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
