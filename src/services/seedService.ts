import { db } from "@/lib/firebase/clientApp";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore"; // Usamos doc y setDoc
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

// --- SCRIPT DE REPARACIÓN TOTAL (BOBINAS, LOGS E INVENTARIO) ---
export const fixAllHistoricalCosts = async () => {
  const coilsRef = collection(db, "coils");

  // Buscamos tanto las que están a medias como las que ya se terminaron
  const q = query(
    coilsRef,
    where("status", "in", ["IN_PROGRESS", "PROCESSED"]),
  );
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return { count: 0, message: "No hay bobinas para arreglar." };
  }

  const batch = writeBatch(db);
  let operationsCount = 0;
  let fixedCoils = 0;

  // Diccionario temporal para guardar el último costo de cada producto
  const latestCostsPerSku: Record<string, number> = {};

  for (const docSnap of querySnapshot.docs) {
    const coil = docSnap.data() as Coil;

    // VALIDACIÓN ESTRICTA PARA ELIMINAR EL ERROR DE TYPESCRIPT
    const masterWidth = coil.masterWidth || 1200;
    const initialWeight = coil.initialWeight || 0;
    const pricePerKg = coil.pricePerKg || 0;

    if (!coil.plannedStrips || initialWeight === 0 || pricePerKg === 0)
      continue;

    // 1. Calculamos el Ancho Útil
    const totalPlannedWidth = coil.plannedStrips.reduce(
      (sum, s) => sum + s.width * s.initialCount,
      0,
    );

    // 2. Costo Total
    const totalCoilCost = initialWeight * pricePerKg;
    const leftoverWidth = masterWidth - totalPlannedWidth;

    // 3. Aplicamos lógica de absorción de merma (Si sobra <= 40mm)
    let effectiveCostPerMm = totalCoilCost / masterWidth;
    if (leftoverWidth > 0 && leftoverWidth <= 40) {
      effectiveCostPerMm = totalCoilCost / totalPlannedWidth;
    }

    // 4. Actualizamos el precio de los flejes en la bobina
    const updatedStrips = coil.plannedStrips.map((strip) => ({
      ...strip,
      costPerStrip: Number((strip.width * effectiveCostPerMm).toFixed(2)),
    }));

    batch.update(docSnap.ref, {
      plannedStrips: updatedStrips,
      "metadata.costCorrectionApplied": true,
    });
    operationsCount++;
    fixedCoils++;

    // 5. CORREGIR LOS LOGS DE PRODUCCIÓN DE ESTA BOBINA
    const logsRef = collection(db, "production_logs");
    const logsQuery = query(logsRef, where("parentCoilId", "==", coil.id));
    const logsSnap = await getDocs(logsQuery);

    for (const logDoc of logsSnap.docs) {
      const logData = logDoc.data();

      const updatedStrip = updatedStrips.find((s) => s.sku === logData.sku);
      if (updatedStrip && logData.piecesProduced > 0) {
        // Recalculamos el costo exacto por pieza que hizo el operador
        const correctedCostPerPiece = Number(
          (updatedStrip.costPerStrip / logData.piecesProduced).toFixed(4),
        );

        batch.update(logDoc.ref, {
          stripCost: updatedStrip.costPerStrip,
          costPerPiece: correctedCostPerPiece,
          "metadata.costCorrected": true,
        });
        operationsCount++;

        // Guardamos el costo corregido en nuestro diccionario
        latestCostsPerSku[logData.sku] = correctedCostPerPiece;
      }
    }

    // Firebase tiene un límite de 500 operaciones por batch.
    if (operationsCount > 450) {
      console.warn("Límite de batch cercano, ejecutando en bloques...");
      await batch.commit();
      return {
        count: fixedCoils,
        message: `Se arreglaron las primeras ${fixedCoils} bobinas. Presiona el botón de nuevo para continuar con el resto.`,
      };
    }
  }

  // 6. PASO FINAL: ACTUALIZAR EL COSTO EN EL INVENTARIO GLOBAL
  for (const [sku, cost] of Object.entries(latestCostsPerSku)) {
    const stockRef = doc(db, "inventory_stock", sku);
    // Usamos update en lugar de set para no borrar otros datos del stock (como la cantidad)
    batch.update(stockRef, {
      lastCostPerPiece: cost,
      "metadata.costCorrected": true,
    });
    operationsCount++;
  }

  if (operationsCount > 0) {
    await batch.commit();
  }

  return {
    count: fixedCoils,
    message: `¡Reparación Completada! Se arreglaron ${fixedCoils} bobinas y el stock de ${Object.keys(latestCostsPerSku).length} SKUs.`,
  };
};
