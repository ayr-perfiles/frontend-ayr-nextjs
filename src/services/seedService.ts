import { db } from "@/lib/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; // Usamos doc y setDoc
import { Coil } from "@/types";
import { toast } from "react-hot-toast/headless";

export const seedFiftyAvailableCoils = async () => {
  const providers = [
    "Aceros del Sur",
    "Multi-Perfiles",
    "Importadora Industrial",
    "Siderúrgica Global",
  ];
  const widths = [1000, 1192, 1200, 1219];
  const thicknesses = [0.45, 0.5, 0.6, 0.75, 0.9];

  console.log("Iniciando carga de 50 bobinas sincronizadas...");

  try {
    for (let i = 1; i <= 50; i++) {
      const serieId = `PD03-${i.toString().padStart(2, "0")}`;
      const randomWeight = Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;

      // CREAMOS LA REFERENCIA CON EL ID ESPECÍFICO
      const coilRef = doc(db, "coils", serieId);

      const newCoil: Partial<Coil> = {
        id: serieId,
        initialWeight: randomWeight,
        currentWeight: randomWeight,
        masterWidth: widths[Math.floor(Math.random() * widths.length)],
        thickness: thicknesses[Math.floor(Math.random() * thicknesses.length)],
        pricePerKg: 1.15,
        status: "AVAILABLE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: {
          provider: providers[Math.floor(Math.random() * providers.length)],
          observations: "Carga masiva sincronizada",
        },
      };

      // USAMOS setDoc PARA QUE EL ID DEL DOCUMENTO SEA LA SERIE
      await setDoc(coilRef, newCoil);
      console.log(`Sincronizada: ${serieId}`);
    }

    toast.success(
      "✅ 50 bobinas generadas. Ahora sí puedes procesarlas sin errores.",
    );
  } catch (error) {
    console.error("Error en el seed:", error);
    toast.error("Error al generar los datos.");
  }
};
