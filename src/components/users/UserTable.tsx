import React from "react";
import { AppUser } from "@/services/userService";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Power,
  AlertCircle,
} from "lucide-react";
import { UserRole } from "@/context/AuthContext";

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
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto min-h-[250px]">
      <table className="w-full text-left min-w-[800px] border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-100">
          <tr>
            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-12">
              #
            </th>
            <th className="p-4 pl-2 text-xs font-black text-slate-400 uppercase tracking-widest">
              Empleado
            </th>
            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">
              Nivel de Acceso
            </th>
            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">
              Seguridad
            </th>
            <th className="p-4 pr-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-36">
              Estado de Acceso
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {users.length === 0 && !isLoading ? (
            <tr>
              <td colSpan={5} className="p-12 text-center text-slate-400">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg">
                  No hay usuarios
                </h3>
                <p className="font-medium text-slate-500 mt-1">
                  No se encontraron empleados con los filtros actuales.
                </p>
              </td>
            </tr>
          ) : (
            users.map((profile, idx) => {
              const rowNumber = (currentPage - 1) * pageSize + idx + 1;
              const isMe = profile.id === currentUserId;

              return (
                <tr
                  key={profile.id}
                  className={`transition ${!profile.isActive ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-blue-50/30"}`}
                >
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4 pl-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border-2 ${profile.isActive ? "bg-blue-100 text-blue-700 border-white" : "bg-red-100 text-red-700 border-red-50"}`}
                      >
                        {profile.email.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p
                          className={`font-bold ${!profile.isActive ? "text-slate-400 line-through" : "text-slate-800"}`}
                        >
                          {profile.email}
                        </p>
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">
                          {isMe ? "(Tú)" : "Usuario"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <select
                      value={profile.role}
                      disabled={!profile.isActive}
                      onChange={(e) =>
                        onRoleChange(profile.id, e.target.value as UserRole)
                      }
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
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => onResetPassword(profile.email)}
                      disabled={!profile.isActive}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Restablecer Contraseña"
                    >
                      <KeyRound size={20} />
                    </button>
                  </td>
                  <td className="p-4 pr-6">
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
                          onToggleStatus(
                            profile.id,
                            profile.isActive || false,
                            profile.email,
                          )
                        }
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 outline-none ${profile.isActive ? "bg-emerald-500" : "bg-red-300"}`}
                        title={
                          profile.isActive
                            ? "Suspender acceso"
                            : "Reactivar acceso"
                        }
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${profile.isActive ? "translate-x-6" : "translate-x-1"}`}
                        />
                        <Power
                          className={`absolute text-white transition-opacity ${profile.isActive ? "left-2 opacity-100" : "left-6 opacity-0"} scale-75`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
