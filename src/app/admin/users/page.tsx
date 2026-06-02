"use client";

import { useState } from "react";
import { updateUserRole, updateUserStatus, AppUser } from "@/services/userService";
import { useAuth, UserRole } from "@/context/AuthContext";
import { db, firebaseConfig } from "@/lib/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { Users, UserPlus, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { useUsers } from "@/core/hooks/useUsers";
import { UserFilters } from "@/components/users/UserFilters";
import { UserTable } from "@/components/users/UserTable";
import { TablePagination } from "@/components/ui/TablePagination";
import { useConfirm } from "@/context/ConfirmContext";

export default function UsersPage() {
  const { user, role } = useAuth();
  const confirm = useConfirm();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(15);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("OPERATOR");

  const { users, loading, totalCount, currentPage, nextPage, prevPage, refresh } = useUsers({
    pageSize, searchTerm, roleFilter, statusFilter,
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    setIsCreating(true);
    try {
      const apps = getApps();
      const secondaryApp =
        apps.find((app) => app.name === "Secondary") || initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      await secondaryAuth.signOut();

      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: newEmail,
        role: newRole,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      toast.success("Usuario creado con éxito.");
      setIsModalOpen(false);
      setNewEmail("");
      setNewPassword("");
      refresh();
    } catch (error: any) {
      toast.error(error.message || "Error al crear usuario.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (
      await confirm({
        title: "Recuperar Contraseña",
        message: `¿Enviar un enlace de recuperación de contraseña a ${email}?`,
        variant: "default",
      })
    ) {
      try {
        await sendPasswordResetEmail(getAuth(), email);
        toast.success("✅ Enlace enviado con éxito.");
      } catch (error: unknown) {
        toast.error(`❌ Error al enviar correo: ${error instanceof Error ? error.message : "Error desconocido"}`);
      }
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean, userEmail: string) => {
    if (userEmail === user?.email) return toast.error("⚠️ No puedes desactivar tu propia cuenta.");
    if (
      await confirm({
        title: `${currentStatus ? "Desactivar" : "Reactivar"} Usuario`,
        message: `¿Estás seguro de ${currentStatus ? "desactivar" : "reactivar"} a ${userEmail}?`,
        variant: "warning",
      })
    ) {
      try {
        await updateUserStatus(userId, !currentStatus);
        toast.success(`Usuario ${!currentStatus ? "reactivado" : "suspendido"}.`);
        refresh();
      } catch (error: unknown) {
        toast.error(`❌ Error: ${error instanceof Error ? error.message : "Error al actualizar estado"}`);
      }
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success("Rol actualizado con éxito.");
      refresh();
    } catch (error: unknown) {
      toast.error(`❌ Error: ${error instanceof Error ? error.message : "Error al actualizar rol"}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800 tracking-tight">
            <Users className="text-blue-600" /> Control de Accesos
          </h1>
          <p className="text-slate-500 text-sm font-medium">Gestión de usuarios y roles del sistema</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition active:scale-95 shadow-xl shadow-blue-100 uppercase text-xs tracking-widest"
        >
          <UserPlus size={20} /> Nuevo Empleado
        </button>
      </div>

      <UserFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onClear={() => {
          setSearchTerm("");
          setRoleFilter("ALL");
          setStatusFilter("ALL");
        }}
      />

      <div className="relative">
        <UserTable
          users={users}
          role={role}
          onResetPassword={handleResetPassword}
          onToggleStatus={handleToggleStatus}
          onRoleChange={handleRoleChange}
        />
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalCount}
        onPageChange={(page) => {
          if (page > currentPage) nextPage();
          else if (page < currentPage) prevPage();
        }}
        onPageSizeChange={setPageSize}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Nuevo Usuario</h2>
                <p className="text-slate-500 text-sm font-medium">Registro de personal operativo</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Correo Corporativo</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition"
                    placeholder="ejemplo@ayrsteel.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Contraseña Temporal</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition"
                    placeholder="Min. 6 caracteres"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Rol Asignado</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition appearance-none"
                  >
                    <option value="OPERATOR">Operador (Planta)</option>
                    <option value="COMMERCIAL">Comercial (Ventas)</option>
                    <option value="ADMIN">Administrador (Full)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest transition shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                {isCreating ? <><Loader2 className="animate-spin" /> CREANDO...</> : "REGISTRAR EMPLEADO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
