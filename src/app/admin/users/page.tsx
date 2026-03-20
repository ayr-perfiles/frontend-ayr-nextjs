"use client";

import { useEffect, useState } from "react";
import { db, firebaseConfig } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useAuth, UserRole } from "@/context/AuthContext";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Power,
  Search,
  UserPlus,
  X,
  KeyRound,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: any;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // ESTADOS DEL MODAL DE CREACIÓN
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("OPERATOR");

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserProfile[];

      const normalizedUsers = usersData.map((u) => ({
        ...u,
        isActive: u.isActive !== undefined ? u.isActive : true,
      }));
      setUsers(normalizedUsers);
    });
    return () => unsub();
  }, []);

  // --- 1. FUNCIÓN PARA CREAR USUARIO (TRUCO APP SECUNDARIA) ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6)
      return toast.error("La contraseña debe tener al menos 6 caracteres.");

    setIsCreating(true);
    try {
      // Inicializamos una app secundaria temporal para no cerrar la sesión del ADMIN actual
      const apps = getApps();
      const secondaryApp =
        apps.find((app) => app.name === "Secondary") ||
        initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      // 1. Creamos el usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newEmail,
        newPassword,
      );

      // 2. Cerramos la sesión de esa app secundaria inmediatamente
      await secondaryAuth.signOut();

      // 3. Guardamos su perfil y rol en Firestore usando nuestra app principal
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
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("❌ Ese correo ya está registrado en el sistema.");
      } else {
        toast.error(`❌ Error al crear usuario: ${error.message}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // --- 2. ENVIAR CORREO PARA CAMBIAR CONTRASEÑA ---
  const handleResetPassword = async (email: string) => {
    if (
      confirm(`¿Enviar un enlace de recuperación de contraseña a ${email}?`)
    ) {
      try {
        const auth = getAuth(); // App principal
        await sendPasswordResetEmail(auth, email);
        toast.success(
          "✅ Enlace enviado. El usuario recibirá un correo para establecer su nueva contraseña.",
        );
      } catch (error: any) {
        toast.error(`❌ Error al enviar correo: ${error.message}`);
      }
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (error: any) {
      toast.error("Error al cambiar el rol: " + error.message);
    }
  };

  const handleToggleStatus = async (
    userId: string,
    currentStatus: boolean,
    userEmail: string,
  ) => {
    if (userEmail === user?.email)
      return toast.error("⚠️ No puedes desactivar tu propia cuenta.");
    const action = currentStatus ? "desactivar" : "reactivar";
    if (confirm(`¿Estás seguro de ${action} a ${userEmail}?`)) {
      try {
        await updateDoc(doc(db, "users", userId), { isActive: !currentStatus });
      } catch (error: any) {
        toast.error("Error al cambiar estado: " + error.message);
      }
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800">
            <Users className="text-blue-600" /> Gestión de Personal
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administra los roles, accesos y contraseñas del sistema.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition shadow-sm font-black uppercase tracking-widest text-xs"
        >
          <UserPlus size={18} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por correo electrónico..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full outline-none font-medium text-gray-700"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-200">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">
                  Empleado
                </th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">
                  Nivel de Acceso
                </th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">
                  Seguridad
                </th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">
                  Estado del Acceso
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((profile) => (
                <tr
                  key={profile.id}
                  className={`transition ${!profile.isActive ? "bg-red-50/30" : "hover:bg-blue-50/30"}`}
                >
                  {/* COLUMNA 1: INFO */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border-2 ${profile.isActive ? "bg-blue-100 text-blue-700 border-white" : "bg-red-100 text-red-700 border-red-50"}`}
                      >
                        {profile.email.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p
                          className={`font-bold ${!profile.isActive ? "text-gray-400 line-through" : "text-gray-800"}`}
                        >
                          {profile.email}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {profile.id === user?.uid ? "(Tú)" : "Usuario"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* COLUMNA 2: ROL */}
                  <td className="p-4 text-center">
                    <select
                      value={profile.role}
                      disabled={!profile.isActive}
                      onChange={(e) =>
                        handleRoleChange(profile.id, e.target.value as UserRole)
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border outline-none cursor-pointer transition
                        ${
                          profile.role === "ADMIN"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : profile.role === "SUPERVISOR"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                        }
                        ${!profile.isActive && "opacity-50 cursor-not-allowed"}
                      `}
                    >
                      <option value="ADMIN">Gerencia (Admin)</option>
                      <option value="SUPERVISOR">
                        Jefe Planta (Supervisor)
                      </option>
                      <option value="OPERATOR">Operario (Terminal)</option>
                    </select>
                  </td>

                  {/* COLUMNA 3: RESET CONTRASEÑA */}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleResetPassword(profile.email)}
                      disabled={!profile.isActive}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Enviar correo para cambiar contraseña"
                    >
                      <KeyRound size={20} />
                    </button>
                  </td>

                  {/* COLUMNA 4: SWITCH DE ESTADO */}
                  <td className="p-4">
                    <div className="flex justify-center items-center gap-3">
                      {profile.isActive ? (
                        <span className="flex items-center gap-1 text-xs font-black text-green-600 uppercase tracking-widest">
                          <ShieldCheck size={16} /> Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-black text-red-500 uppercase tracking-widest">
                          <ShieldAlert size={16} /> Suspendido
                        </span>
                      )}

                      <button
                        onClick={() =>
                          handleToggleStatus(
                            profile.id,
                            profile.isActive,
                            profile.email,
                          )
                        }
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 outline-none ${profile.isActive ? "bg-green-500" : "bg-red-200"}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${profile.isActive ? "translate-x-8" : "translate-x-1"}`}
                        />
                        <Power
                          className={`absolute text-white transition-opacity ${profile.isActive ? "left-2 opacity-100" : "left-8 opacity-0"} scale-75`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================
          MODAL: CREAR NUEVO USUARIO
          ========================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Nuevo Empleado
                </h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                  Crear credenciales de acceso
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="hover:bg-white/10 p-2 rounded-full transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-8 space-y-5">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-widest">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  placeholder="operador@ayrsteel.com"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-widest">
                  Contraseña Inicial
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-widest">
                  Nivel de Acceso (Rol)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="OPERATOR">Operario (Solo Kiosko Móvil)</option>
                  <option value="SUPERVISOR">
                    Supervisor (Ver Inventario y Producción)
                  </option>
                  <option value="ADMIN">Gerencia (Acceso Total)</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-50 shadow-xl shadow-blue-200"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="animate-spin" /> CREANDO...
                    </>
                  ) : (
                    "REGISTRAR USUARIO"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
