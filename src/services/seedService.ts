import { db } from "@/lib/firebase/clientApp";
import { writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { Coil } from "@/types";

// Ahora incluimos masterWidth (mm), thickness (mm) y pricePerKg (S/)
const mockCoils: Partial<Coil>[] = [
  {
    id: "PD03-01",
    initialWeight: 5000.0,
    currentWeight: 5000.0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.02,
    status: "AVAILABLE",
  },
  {
    id: "PD03-02",
    initialWeight: 4820.0,
    currentWeight: 4820.0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.05,
    status: "AVAILABLE",
  },
  {
    id: "PD03-03",
    initialWeight: 6100.0,
    currentWeight: 0,
    masterWidth: 1200,
    thickness: 0.4,
    pricePerKg: 2.95,
    status: "PROCESSED",
  }, // Ya cortada
  {
    id: "PD03-04",
    initialWeight: 5250.0,
    currentWeight: 2100.0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.02,
    status: "IN_PROGRESS",
  }, // A la mitad
  {
    id: "PD03-05",
    initialWeight: 5900.2,
    currentWeight: 5900.2,
    masterWidth: 1219,
    thickness: 0.5,
    pricePerKg: 2.85,
    status: "AVAILABLE",
  }, // Otra medida comercial
  {
    id: "PD03-06",
    initialWeight: 4500.0,
    currentWeight: 4500.0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.1,
    status: "AVAILABLE",
  }, // Comprada más cara
  {
    id: "PD03-07",
    initialWeight: 5350.8,
    currentWeight: 0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.0,
    status: "PROCESSED",
  },
  {
    id: "PD03-08",
    initialWeight: 4950.0,
    currentWeight: 4950.0,
    masterWidth: 1200,
    thickness: 0.4,
    pricePerKg: 2.98,
    status: "AVAILABLE",
  },
  {
    id: "PD03-09",
    initialWeight: 5700.0,
    currentWeight: 1500.0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.02,
    status: "IN_PROGRESS",
  },
  {
    id: "PD03-10",
    initialWeight: 5400.0,
    currentWeight: 5400.0,
    masterWidth: 1192,
    thickness: 0.45,
    pricePerKg: 3.02,
    status: "AVAILABLE",
  },
];

export const seedCoils = async () => {
  const batch = writeBatch(db);

  mockCoils.forEach((coil) => {
    // Al usar el mismo ID (ej: PD03-01), Firestore SOBREESCRIBIRÁ las bobinas viejas
    // arreglando automáticamente tu base de datos sin duplicar registros.
    const coilRef = doc(db, "coils", coil.id as string);

    batch.set(coilRef, {
      ...coil,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        provider: "Aceros de Prueba S.A.",
        observations: "Datos financieros y dimensionales actualizados",
      },
    });
  });

  try {
    await batch.commit();
    console.log("¡10 bobinas de prueba actualizadas correctamente!");
    return true;
  } catch (error) {
    console.error("Error insertando bobinas:", error);
    return false;
  }
};
