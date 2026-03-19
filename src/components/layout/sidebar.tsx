// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
//   LayoutDashboard,
//   Database,
//   Factory,
//   ShoppingCart,
//   BarChart3,
//   Settings,
//   ChevronRight,
//   Zap,
//   LogOut,
// } from "lucide-react";
// import { signOut } from "firebase/auth";
// import { auth } from "@/lib/firebase/clientApp";

// export default function Sidebar() {
//   const pathname = usePathname();

//   // Configuración de los enlaces del menú
//   const menuItems = [
//     {
//       name: "Dashboard",
//       href: "/admin/dashboard",
//       icon: LayoutDashboard,
//       description: "Vista general y KPIs",
//     },
//     {
//       name: "Inventario",
//       href: "/admin/inventory",
//       icon: Database,
//       description: "Materia prima (Bobinas)",
//     },
//     {
//       name: "Producción",
//       href: "/admin/production",
//       icon: Factory,
//       description: "Corte y Conformado",
//     },
//     {
//       name: "Ventas",
//       href: "/admin/sales",
//       icon: ShoppingCart,
//       description: "Ventas y Cotizaciones",
//     },
//     {
//       name: "Reportes",
//       href: "/admin/reports",
//       icon: BarChart3,
//       description: "Eficiencia y Mermas",
//     },
//     {
//       name: "Configuración",
//       href: "/admin/settings",
//       icon: Settings,
//       description: "Ajustes del sistema",
//     },
//   ];

//   return (
//     <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
//       {/* Logo / Header del Sidebar */}
//       <div className="p-8 border-b border-gray-50">
//         <div className="flex items-center gap-3">
//           <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
//             <Zap size={24} className="text-white" fill="white" />
//           </div>
//           <div>
//             <h1 className="text-xl font-black text-gray-800 tracking-tighter">
//               AYR STEEL
//             </h1>
//             <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
//               ERP Industrial
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Navegación Principal */}
//       <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
//         {menuItems.map((item) => {
//           const isActive =
//             pathname === item.href ||
//             (item.href !== "/admin" && pathname.startsWith(item.href));

//           return (
//             <Link
//               key={item.href}
//               href={item.href}
//               className={`
//                 group flex items-center justify-between p-3 rounded-xl transition-all duration-200
//                 ${
//                   isActive
//                     ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
//                     : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
//                 }
//               `}
//             >
//               <div className="flex items-center gap-4">
//                 <div
//                   className={`
//                   p-2 rounded-lg transition-colors
//                   ${isActive ? "bg-white text-blue-600 shadow-sm" : "bg-transparent group-hover:bg-white"}
//                 `}
//                 >
//                   <item.icon size={20} />
//                 </div>
//                 <div>
//                   <p className="text-sm font-bold leading-none">{item.name}</p>
//                   <p className="text-[10px] mt-1 opacity-70 font-medium">
//                     {item.description}
//                   </p>
//                 </div>
//               </div>
//               {isActive && <ChevronRight size={16} className="text-blue-400" />}
//             </Link>
//           );
//         })}
//       </nav>

//       {/* Footer del Sidebar (Info de Usuario/Versión) */}
//       <div className="p-6 border-t border-gray-50 bg-gray-50/50">
//         <div className="flex items-center gap-3 mb-4">
//           <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white shadow-sm flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
//             AD
//           </div>
//           <div className="flex-1 overflow-hidden">
//             <p className="text-xs font-bold text-gray-800 truncate">
//               Administrador
//             </p>
//             <p className="text-[10px] text-gray-500 font-medium">
//               Planta Lima V1
//             </p>
//           </div>
//         </div>
//         <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">
//           v2.0.0 Stable
//         </div>
//       </div>

//       <button
//         onClick={() => signOut(auth)}
//         className="w-full mt-4 flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl transition font-bold text-sm"
//       >
//         <LogOut size={20} />
//         Cerrar Sesión
//       </button>
//     </aside>
//   );
// }

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { useAuth, UserRole } from "@/context/AuthContext";
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
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role } = useAuth(); // Traemos el rol del contexto

  // Aquí definimos qué roles pueden ver qué botones
  const menuItems = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      description: "Vista financiera",
      allowedRoles: ["ADMIN"], // Solo Gerencia
    },
    {
      name: "Inventario",
      href: "/admin/inventory",
      icon: Database,
      description: "Materia prima",
      allowedRoles: ["ADMIN", "SUPERVISOR"], // Todos
    },
    {
      name: "Producción",
      href: "/admin/production",
      icon: Factory,
      description: "Corte y Conformado",
      allowedRoles: ["ADMIN", "SUPERVISOR"], // Todos
    },
    {
      name: "Ventas",
      href: "/admin/sales",
      icon: ShoppingCart,
      description: "Cotizaciones y Tickets",
      allowedRoles: ["ADMIN"], // Solo Gerencia
    },
    {
      name: "Reportes",
      href: "/admin/reports",
      icon: BarChart3,
      description: "Eficiencia y Mermas",
      allowedRoles: ["ADMIN", "SUPERVISOR"], // Gerencia y Jefes de planta
    },
    {
      name: "Usuarios",
      href: "/admin/users",
      icon: Users, // Asegúrate de importar Users de lucide-react
      description: "Roles y Accesos",
      allowedRoles: ["ADMIN"],
    },
    {
      name: "Configuración",
      href: "/admin/settings",
      icon: Settings,
      description: "Ajustes del sistema",
      allowedRoles: ["ADMIN"], // Solo Gerencia
    },
    {
      name: "Terminal Móvil",
      href: "/admin/operator",
      icon: Factory,
      description: "Registro rápido en planta",
      allowedRoles: ["ADMIN", "SUPERVISOR", "OPERATOR"], // El Operador ve esto como su módulo principal
    },
  ];

  // Filtramos el menú para mostrar solo lo que el usuario tiene permitido ver
  const filteredMenu = menuItems.filter((item) =>
    item.allowedRoles.includes(role as UserRole),
  );

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 font-sans">
      <div className="p-8 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tighter italic">
              AYR STEEL
            </h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              ERP Privado
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {filteredMenu.map((item) => {
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
                    ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }
              `}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg transition-colors ${isActive ? "bg-white text-blue-600 shadow-sm" : "bg-transparent group-hover:bg-white"}`}
                >
                  <item.icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">{item.name}</p>
                  <p className="text-[10px] mt-1 opacity-70 font-medium">
                    {item.description}
                  </p>
                </div>
              </div>
              {isActive && <ChevronRight size={16} className="text-blue-400" />}
            </Link>
          );
        })}
      </nav>

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

        {/* BOTÓN CERRAR SESIÓN */}
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center justify-center gap-2 p-3 text-red-500 hover:bg-red-50 rounded-xl transition font-bold text-xs uppercase tracking-wider"
        >
          <LogOut size={16} /> Salir del Sistema
        </button>
      </div>
    </aside>
  );
}
