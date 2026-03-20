import { useState, useEffect } from "react";
import { AppUser, getUsers, updateUserRole } from "@/services/userService";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Shield,
  UserCheck,
  Wrench,
  Loader2,
  AlertCircle,
} from "lucide-react";

export function UsersSettings() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await getUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (
    userId: string,
    newRole: "ADMIN" | "SUPERVISOR" | "OPERATOR",
  ) => {
    if (!confirm(`¿Estás seguro de cambiar el rol a ${newRole}?`)) return;

    setProcessingId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      alert("✅ Rol actualizado correctamente.");
    } catch (error) {
      alert("❌ Ocurrió un error al cambiar el rol.");
    } finally {
      setProcessingId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Shield size={14} className="text-purple-600" />;
      case "SUPERVISOR":
        return <UserCheck size={14} className="text-blue-600" />;
      case "OPERATOR":
        return <Wrench size={14} className="text-emerald-600" />;
      default:
        return <Wrench size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-500" size={24} /> Gestión de Usuarios y
            Roles
          </h2>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Controla los niveles de acceso (Admin, Supervisor, Operador) en la
            plataforma.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center text-blue-500">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Usuario
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Correo Electrónico
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                    Nivel de Acceso
                  </th>
                  <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-gray-400 font-bold flex flex-col items-center"
                    >
                      <AlertCircle size={32} className="mb-2 opacity-50" />
                      No se encontraron usuarios en la colección "users".
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isMe = currentUser?.uid === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-4 pl-6">
                          <p className="font-black text-gray-900 flex items-center gap-2">
                            {u.name || "Usuario Sin Nombre"}
                            {isMe && (
                              <span className="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">
                                Tú
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">
                            UID: {u.id.slice(0, 8)}...
                          </p>
                        </td>
                        <td className="p-4 font-medium text-gray-600">
                          {u.email}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border ${
                                u.role === "ADMIN"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : u.role === "SUPERVISOR"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : u.role === "OPERATOR"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                            >
                              {getRoleIcon(u.role)} {u.role || "OPERATOR"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {processingId === u.id && (
                              <Loader2
                                size={16}
                                className="animate-spin text-blue-500"
                              />
                            )}
                            <select
                              disabled={isMe || processingId === u.id}
                              value={u.role || "OPERATOR"}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as any)
                              }
                              className="p-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100 cursor-pointer"
                            >
                              <option value="ADMIN">Administrador</option>
                              <option value="SUPERVISOR">Supervisor</option>
                              <option value="OPERATOR">Operador</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
