"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp"; // Asumiendo que tu Firebase está aquí
import { useRouter } from "next/navigation";
import { Zap, Mail, KeyRound, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Usamos el motor de Firebase para loguear
      await signInWithEmailAndPassword(auth, email, password);
      // Si todo sale bien, lo mandamos al Dashboard principal del admin
      router.push("/admin");
    } catch (err: any) {
      // Manejo simple de errores para el usuario
      console.error(err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError(
          "Las credenciales ingresadas son incorrectas. Verifica tu correo y contraseña.",
        );
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Demasiados intentos fallidos. Esta cuenta ha sido temporalmente bloqueada por seguridad.",
        );
      } else {
        setError(
          "Hubo un problema de conexión. Por favor, intenta de nuevo más tarde.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        {/* Sección del Logo y Encabezado */}
        <div className="p-10 bg-gray-950 text-white flex flex-col items-center text-center border-b border-gray-800">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-200/20 mb-6">
            <Zap size={40} className="text-white" fill="white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            AYR STEEL
          </h1>
          <p className="text-sm font-bold text-blue-500 uppercase tracking-widest mt-1">
            Plataforma de Control ERP
          </p>
          <p className="text-gray-400 mt-6 leading-relaxed">
            Ingresa tus credenciales de empleado para acceder al panel de
            administración y control de planta.
          </p>
        </div>

        {/* Formulario de Login */}
        <form onSubmit={handleLogin} className="p-10 space-y-6">
          {/* Alerta de Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="shrink-0 mt-0.5" size={20} />
              <p className="text-sm font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Input Correo */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 block">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition outline-none"
                placeholder="ejemplo@ayrsteel.com"
              />
            </div>
          </div>

          {/* Input Contraseña */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 block">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <KeyRound
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full p-4 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-3 transition-all duration-200 ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-100 hover:shadow-blue-200 active:scale-[0.98]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Autenticando Acceso...
              </>
            ) : (
              <>Ingresar al Panel de Control</>
            )}
          </button>
        </form>

        <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-medium">
            © 2026 AYR STEEL Industria Metalúrgica - Sistema ERP Privado
          </p>
        </div>
      </div>
    </div>
  );
}
