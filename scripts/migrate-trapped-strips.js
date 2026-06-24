/**
 * scripts/migrate-trapped-strips.js
 *
 * Migración de "flejes atrapados" del modelo viejo (coil.plannedStrips)
 * al nuevo modelo (strips_stock + strips_movements).
 *
 * Basado en la auditoría v6.4:
 * - 32 flejes pendientes en 3 anchos (175, 124, 149).
 * - Bobinas origen: F001-12506-17, F001-12507-20, F001-35231-3, F001-35231-4.
 *
 * Reglas:
 * 1. Dry-run por defecto. --apply para ejecutar.
 * 2. Peso = (coil.initialWeight / coil.masterWidth) * stripWidthMm.
 * 3. Costo (kg) = coil.pricePerKg (convertido a PEN si es USD).
 * 4. WAC = Σ(peso * costoKg) / Σ(peso).
 * 5. Idempotente vía referenceId "MIGRATION_TRAPPED_v1".
 *
 * Uso:
 *   npx tsx scripts/migrate-trapped-strips.js [--apply]
 */

import admin from "firebase-admin";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const PROJECT_ID = "ayrsteel-2026"; // Cambiar si es necesario
const MIGRATION_REF = "MIGRATION_TRAPPED_v1";
const APPLY = process.argv.includes("--apply");
const ALLOW_PARTIAL = process.argv.includes("--allow-partial");
const CONFIRM_BACKUP = process.env.CONFIRM_BACKUP === "true";

// Inicializar Firebase (usa ADC o emulator según env)
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId: PROJECT_ID });
} else {
  // En prod, requiere credenciales cargadas en el entorno
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

async function run() {
  console.log(
    `\n🚀 Iniciando migración de flejes atrapados (${APPLY ? "MODO EJECUCIÓN" : "MODO SIMULACIÓN"})\n`,
  );

  if (APPLY && !CONFIRM_BACKUP) {
    console.error(
      "❌ ERROR: Para ejecutar con --apply debes confirmar que hiciste backup con la variable CONFIRM_BACKUP=true",
    );
    process.exit(1);
  }

  // 1. Obtener bobinas con flejes pendientes
  const coilsSnap = await db
    .collection("coils")
    .where("status", "in", ["IN_PROGRESS", "AVAILABLE", "EN_TERCERO"])
    .get();

  const trappedStrips = [];
  const nonMigratable = [];

  for (const doc of coilsSnap.docs) {
    const coil = doc.data();
    if (!coil.plannedStrips || coil.plannedStrips.length === 0) continue;

    for (const strip of coil.plannedStrips) {
      if (strip.pendingCount > 0 && !strip.migratedToStripsStock) {
        // Validar datos críticos para peso y costo
        if (!coil.initialWeight || !coil.masterWidth) {
          nonMigratable.push({
            coilId: doc.id,
            reason: "Falta initialWeight o masterWidth",
            strip,
          });
          continue;
        }
        if (coil.pricePerKg === undefined || coil.pricePerKg === null) {
          nonMigratable.push({
            coilId: doc.id,
            reason: "Falta pricePerKg",
            strip,
          });
          continue;
        }

        // Calcular costo en PEN
        let costPerKgPEN = coil.pricePerKg;
        if (coil.metadata?.currency === "USD") {
          if (!coil.metadata.exchangeRate) {
            nonMigratable.push({
              coilId: doc.id,
              reason: "Precio en USD sin exchangeRate",
              strip,
            });
            continue;
          }
          costPerKgPEN = coil.pricePerKg * coil.metadata.exchangeRate;
        }

        const weightPerMm = coil.initialWeight / coil.masterWidth;
        const stripWeight = strip.width * weightPerMm;

        trappedStrips.push({
          coilId: doc.id,
          widthMm: strip.width,
          count: strip.pendingCount,
          weight: stripWeight * strip.pendingCount,
          costPerKg: costPerKgPEN,
          sku: strip.sku,
          originalStrip: strip,
        });
      }
    }
  }

  if (trappedStrips.length === 0) {
    console.log(
      "✅ No se encontraron flejes atrapados pendientes (o ya fueron migrados).",
    );
    return;
  }

  // 2. Consolidar por ancho
  const consolidated = {};
  for (const s of trappedStrips) {
    if (!consolidated[s.widthMm]) {
      consolidated[s.widthMm] = {
        widthMm: s.widthMm,
        totalCount: 0,
        totalWeight: 0,
        weightedCostSum: 0,
        sourceCoils: new Set(),
        details: [],
      };
    }
    const c = consolidated[s.widthMm];
    c.totalCount += s.count;
    c.totalWeight += s.weight;
    c.weightedCostSum += s.costPerKg * s.weight;
    c.sourceCoils.add(s.coilId);
    c.details.push({
      coilId: s.coilId,
      count: s.count,
      weight: s.weight,
      costPerKg: s.costPerKg,
    });
  }

  // 3. Reporte de dry-run y validación de integridad
  const partialWidths = new Set();
  for (const nm of nonMigratable) {
    partialWidths.add(nm.strip.width);
  }

  console.log("📋 Resumen de flejes a migrar:");
  console.table(
    Object.values(consolidated).map((c) => {
      const isPartial = partialWidths.has(c.widthMm);
      return {
        Ancho: `${c.widthMm}mm`,
        Estado: isPartial ? "⚠️ PARCIAL/INCOMPLETO" : "✅ COMPLETO",
        Cantidad: c.totalCount,
        "Peso Total (kg)": c.totalWeight.toFixed(2),
        "WAC (S/ por kg)": (c.weightedCostSum / c.totalWeight).toFixed(4),
        "Bobinas Origen": Array.from(c.sourceCoils).join(", "),
      };
    }),
  );

  console.log("\n🔍 Desglose detallado por bobina:");
  for (const c of Object.values(consolidated)) {
    console.log(`\nAncho: ${c.widthMm}mm`);
    console.table(
      c.details.map((d) => ({
        Coil: d.coilId,
        Cantidad: d.count,
        "Peso (kg)": d.weight.toFixed(2),
        "Costo Kg (S/)": d.costPerKg.toFixed(4),
      })),
    );
  }

  if (nonMigratable.length > 0) {
    console.log("\n⚠️ Flejes NO migrables por falta de datos:");
    console.table(
      nonMigratable.map((n) => ({
        Coil: n.coilId,
        Motivo: n.reason,
        Ancho: n.strip.width,
        Cant: n.strip.pendingCount,
      })),
    );
  }

  if (!APPLY) {
    console.log(
      "\n💡 Fin de simulación. Usa --apply para ejecutar (requiere CONFIRM_BACKUP=true).",
    );
    if (partialWidths.size > 0) {
      console.log(
        "⚠️ ATENCIÓN: Hay anchos marcados como PARCIALES. Se requiere --allow-partial para migrarlos.",
      );
    }
    return;
  }

  // 4. Ejecución (Transaccional por ancho)
  console.log("\n⚙️ Ejecutando transacciones...");

  for (const widthStr of Object.keys(consolidated)) {
    const width = Number(widthStr);
    const data = consolidated[width];
    const isPartial = partialWidths.has(width);

    if (isPartial && !ALLOW_PARTIAL) {
      console.error(
        `❌ ABORTADO: El ancho ${width}mm está incompleto y no se pasó --allow-partial.`,
      );
      continue;
    }

    try {
      await db.runTransaction(async (transaction) => {
        // ===== FASE 1: TODAS LAS LECTURAS =====

        // 1. Idempotencia: Verificar si ya existe movimiento
        const moveQuery = db
          .collection("strips_movements")
          .where("widthMm", "==", width)
          .where("referenceId", "==", MIGRATION_REF)
          .limit(1);

        const existingMoves = await transaction.get(moveQuery);

        // 2. Leer stock actual
        const stockRef = db.collection("strips_stock").doc(width.toString());
        const stockSnap = await transaction.get(stockRef);

        // 3. Leer TODAS las bobinas origen del ancho (ANTES de escribir)
        const coilRefs = Array.from(data.sourceCoils).map((id) =>
          db.collection("coils").doc(id),
        );
        const coilSnaps =
          coilRefs.length > 0 ? await transaction.getAll(...coilRefs) : [];

        // ===== FASE 2: CÁLCULOS (sin I/O) =====

        if (!existingMoves.empty) {
          console.log(`⏩ Ancho ${width}mm ya fue migrado. Omitiendo.`);
          return;
        }

        let currentStock = {
          widthMm: width,
          totalStrips: 0,
          totalWeight: 0,
          avgCostPerKg: 0,
          lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (stockSnap.exists) {
          currentStock = stockSnap.data();
        }

        const newTotalWeight = currentStock.totalWeight + data.totalWeight;
        const newTotalStrips = currentStock.totalStrips + data.totalCount;
        const newAvgCostPerKg =
          newTotalWeight > 0
            ? (currentStock.totalWeight * currentStock.avgCostPerKg +
                data.weightedCostSum) /
              newTotalWeight
            : 0;

        // ===== FASE 3: TODAS LAS ESCRITURAS =====

        // a. Escribir strips_stock
        transaction.set(stockRef, {
          ...currentStock,
          totalWeight: newTotalWeight,
          totalStrips: newTotalStrips,
          avgCostPerKg: newAvgCostPerKg,
          lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        });

        // b. Crear strips_movements (ENTRADA)
        const moveRef = db.collection("strips_movements").doc();
        transaction.set(moveRef, {
          type: "ENTRADA",
          widthMm: width,
          quantity: data.totalCount,
          weight: data.totalWeight,
          costPerKg: data.weightedCostSum / data.totalWeight,
          referenceId: MIGRATION_REF,
          description: "Migración inicial de flejes pendientes (modelo viejo)",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          user: "SYSTEM_MIGRATION",
        });

        // c. Marcar bobinas (Preservando histórico)
        for (const coilSnap of coilSnaps) {
          if (coilSnap.exists) {
            const coilData = coilSnap.data();
            const updatedStrips = coilData.plannedStrips.map((s) => {
              if (
                s.width === width &&
                s.pendingCount > 0 &&
                !s.migratedToStripsStock
              ) {
                return {
                  ...s,
                  migratedToStripsStock: true,
                  originalPendingCount: s.pendingCount,
                };
              }
              return s;
            });
            transaction.update(coilSnap.ref, {
              plannedStrips: updatedStrips,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      });
      console.log(`✅ Ancho ${width}mm migrado exitosamente.`);
    } catch (err) {
      console.error(`❌ Error migrando ancho ${width}mm:`, err.message);
    }
  }

  console.log("\n🏁 Migración finalizada.");
}

run().catch((err) => {
  console.error("\n💥 Error fatal:", err);
  process.exit(1);
});
