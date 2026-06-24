import React from "react";
import { AppUser } from "@/services/userService";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Power,
} from "lucide-react";
import { UserRole } from "@/context/AuthContext";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";

interface UserTableProps {
  users: AppUser[];
  currentUserId?: string;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  onRoleChange: (userId: string, newRole: UserRole) => void;
  onToggleStatus: (
    userId: string,
    currentStatus: boolean,
    email: string,
  ) => void;
  onResetPassword: (email: string) => void;
}

export function UserTable({
  users,
  currentUserId,
  currentPage,
  pageSize,
  isLoading,
  onRoleChange,
  onToggleStatus,
  onResetPassword,
}: UserTableProps) {
  const columns: ColumnDef<AppUser>[] = [
    {
      key: "employee",
      header: "Empleado",
      render: (profile) => {
        const isMe = profile.id === currentUserId;
        return (
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border-2 ${
                profile.isActive
                  ? "bg-blue-100 text-blue-700 border-white"
                  : "bg-red-100 text-red-700 border-red-50"
              }`}
            >
              {profile.email.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p
                className={`font-bold ${
                  !profile.isActive ? "text-slate-400 line-through" : "text-slate-800"
                }`}
              >
                {profile.email}
              </p>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">
                {isMe ? "(Tú)" : "Usuario"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Nivel de Acceso",
      align: "center",
      render: (profile) => (
        <select
          value={profile.role}
          disabled={!profile.isActive}
          onChange={(e) => onRoleChange(profile.id, e.target.value as UserRole)}
          className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border outline-none cursor-pointer transition ${
            profile.role === "ADMIN"
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : profile.role === "SUPERVISOR"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-slate-100 text-slate-600 border-slate-200"
          } ${!profile.isActive && "opacity-50 cursor-not-allowed"}`}
        >
          <option value="ADMIN">Gerencia (Admin)</option>
          <option value="SUPERVISOR">Jefe Planta (Sup)</option>
          <option value="OPERATOR">Operario (Terminal)</option>
        </select>
      ),
    },
    {
      key: "security",
      header: "Seguridad",
      align: "center",
      render: (profile) => (
        <button
          onClick={() => onResetPassword(profile.email)}
          disabled={!profile.isActive}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Restablecer Contraseña"
        >
          <KeyRound size={20} />
        </button>
      ),
    },
    {
      key: "status",
      header: "Estado de Acceso",
      align: "center",
      width: "w-40",
      render: (profile) => (
        <div className="flex justify-center items-center gap-3">
          {profile.isActive ? (
            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest w-20">
              <ShieldCheck size={14} /> Activo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest w-20">
              <ShieldAlert size={14} /> Suspendido
            </span>
          )}
          <button
            onClick={() =>
              onToggleStatus(profile.id, profile.isActive || false, profile.email)
            }
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 outline-none ${
              profile.isActive ? "bg-emerald-500" : "bg-red-300"
            }`}
            title={profile.isActive ? "Suspender acceso" : "Reactivar acceso"}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                profile.isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
            <Power
              className={`absolute text-white transition-opacity ${
                profile.isActive ? "left-2 opacity-100" : "left-6 opacity-0"
              } scale-75`}
            />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      getRowKey={(u) => u.id}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[800px]"
      getRowClassName={(profile) =>
        `transition ${
          !profile.isActive ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-blue-50/30"
        }`
      }
      emptyState={{
        icon: "AlertCircle",
        title: "No hay usuarios",
        description: "No se encontraron empleados con los filtros actuales.",
      }}
    />
  );
}
