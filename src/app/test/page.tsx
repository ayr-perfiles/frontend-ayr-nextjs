"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import { doc, setDoc } from "firebase/firestore";

export default function TestPage() {
  const [status, setStatus] = useState("Esperando...");

  useEffect(() => {
    const seedDatabase = async () => {
      try {
        await setDoc(doc(db, "coils", "PD03-08"), {
          peso_inicial: 5519,
          peso_actual: 5519,
          estado: "DISPONIBLE",
          fecha_ingreso: new Date(),
          metadata: {
            fleje_en_stock: "2 P89",
            plan_corte_sugerido: "LOTE PASADO",
          },
        });
        setStatus("✅ ¡Bobina creada con éxito en Firestore!");
      } catch (error) {
        console.error(error);
        setStatus("❌ Error: " + error);
      }
    };

    seedDatabase();
  }, []);

  return (
    <div className="p-10">
      <h1>Prueba de Conexión Firebase</h1>
      <p>Estado: {status}</p>
    </div>
  );
}
