"use client";

import { useState } from "react";
import { updateUserRole, updateUserStatus, AppUser } from "@/services/userService";
import { useAuth, UserRole } from "@/context/AuthContext";
import { db, firebaseConfig } from "@/lib/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { Users, UserPlus, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

import { useUsers } from "@/core/hooks/useUsers";
import { UserFilters } from "@/components/users/UserFilters";
import { UserTable } from "@/components/users/UserTable";

export default function UsersPage() {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(15);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("OPERATOR");

  const { users, loading, totalCount, currentPage, hasNextPage, nextPage, prevPage, refresh } = useUsers({
    pageSize, searchTerm, roleFilter, statusFilter,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

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

      toast.success(`✅ Usuario ${newEmail} creado exitosamente.`);
      setIsModalOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("OPERATOR");
      refresh();
    } catch (error: unknown) {
      if (error instanceof Error && (error as Error & { code?: string }).code === "auth/email-already-in-use") {
        toast.error("❌ Ese correo ya está registrado en el sistema.");
      } else {
        toast.error(`❌ Error al crear usuario: ${error instanceof Error ? error.message : "Error desconocido"}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (confirm(`¿Enviar un enlace de recuperación de contraseña a ${email}?`)) {
      try {
        await sendPasswordResetEmail(getAuth(), email);
        toast.success("✅ Enlace enviado con éxito.");
      } catch (error: unknown) {
        toast.error(`❌ Error al enviar correo: ${error instanceof Error ? error.message : "Error desconocido"}`);
      }
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await updateUserRole(userId, role);
      toast.success("Nivel de acceso actualizado.");
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar rol");
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean, userEmail: string) => {
    if (userEmail === user?.email) return toast.error("⚠️ No puedes desactivar tu propia cuenta.");
    if (confirm(`¿Estás seguro de ${currentStatus ? "desactivar" : "reactivar"} a ${userEmail}?`)) {
      try {
        await updateUserStatus(userId, !currentStatus);
        toast.success(`Usuario ${!currentStatus ? "reactivado" : "suspendido"}.`);
        refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Error al cambiar estado");
      }
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-900 tracking-tight">
            <Users className="text-blue-600" /> Gestión de Personal
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Administra los roles, accesos y contraseñas del sistema.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-sm font-black uppercase tracking-widest text-xs w-full md:w-auto"
        >
          <UserPlus size={18} /> Nuevo Usuario
        </button>
      </div>

      <UserFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        isSearching={loading && !!searchTerm}
      />

      <div className="relative">
        <UserTable
          users={users}
          currentUserId={user?.uid}
          currentPage={currentPage}
          pageSize={pageSize}
          isLoading={loading}
          onRoleChange={handleRoleChange}
          onToggleStatus={handleToggleStatus}
          onResetPassword={handleResetPassword}
        />
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
          <p className="text-sm font-black text-blue-600">{totalCount} Empleados</p>
        </div>
        <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
          <button
            onClick={prevPage}
            disabled={currentPage === 1 || loading}
            className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
            Página <span className="font-black text-slate-800 text-sm mx-1">{currentPage}</span> de {totalPages || 1}
          </div>
          <button
            onClick={nextPage}
            disabled={!hasNextPage || loading}
            className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-end">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none cursor-pointer bg-slate-50"
          >
            <option value={15}>15 registros</option>
            <option value={30}>30 registros</option>
          </select>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black tracking-tight">Nuevo Empleado</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                  Crear credenciales de acceso
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  placeholder="operador@empresa.com"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                  Contraseña Inicial
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                  Nivel de Acceso (Rol)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="OPERATOR">Operario (Solo Terminal Móvil)</option>
                  <option value="SUPERVISOR">Jefe de Planta (Supervisor)</option>
                  <option value="ADMIN">Gerencia (Acceso Total)</option>
                </select>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-blue-600 text-white p-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
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
