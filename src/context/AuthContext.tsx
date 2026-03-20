"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth"; // <-- Añade signOut aquí
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/clientApp";
import { toast } from "react-hot-toast/headless";

export type UserRole = "ADMIN" | "SUPERVISOR" | "OPERATOR";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);

        try {
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // --- NUEVO: VALIDACIÓN DE USUARIO ACTIVO ---
            if (userData.isActive === false) {
              await signOut(auth); // Lo deslogueamos a la fuerza
              setUser(null);
              setRole(null);
              toast.error(
                "❌ Acceso Denegado: Tu cuenta ha sido suspendida. Contacta a gerencia.",
              );
            } else {
              setUser(firebaseUser);
              setRole(userData.role as UserRole);
            }
          } else {
            // El primer usuario (Tú) se crea como ADMIN y ACTIVO por defecto
            const newRole: UserRole = "ADMIN";
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: newRole,
              isActive: true, // <-- Guardamos que está activo
              createdAt: new Date(),
            });
            setUser(firebaseUser);
            setRole(newRole);
          }
        } catch (error) {
          console.error("Error obteniendo rol:", error);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
