/**
 * scripts/backfill-production-line.js
 *
 * Backfill del campo `line: "drywall"` en la colección `production_logs`.
 * Necesario porque el Historial de Producción ahora filtra por `line` y los
 * registros antiguos no lo tienen, lo que causa que Firestore los ignore.
 *
 * Reglas:
 * 1. Dry-run por defecto. --apply para ejecutar.
 * 2. Idempotente: Solo actualiza si `line` falta o no es "drywall".
 * 3. Requiere CONFIRM_BACKUP=true para --apply.
 * 4. Usa Batched Writes para eficiencia (lotes de 500).
 *
 * Uso:
 *   npx tsx scripts/backfill-production-line.js [--apply]
 */

import admin from "firebase-admin";

// Configuración
const PROJECT_ID = "ayrsteel-2026";
const APPLY = process.argv.includes("--apply");
const CONFIRM_BACKUP = process.env.CONFIRM_BACKUP === "true";

// Inicializar Firebase
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId: PROJECT_ID });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

async function run() {
  console.log(
    `\n🚀 Iniciando backfill de 'line' en production_logs (${APPLY ? "MODO EJECUCIÓN" : "MODO SIMULACIÓN"})\n`,
  );

  if (APPLY && !CONFIRM_BACKUP) {
    console.error(
      "❌ ERROR: Para ejecutar con --apply debes confirmar que hiciste backup de Firestore con la variable CONFIRM_BACKUP=true",
    );
    process.exit(1);
  }

  // 1. Obtener todos los logs
  console.log("🔍 Leyendo documentos de 'production_logs'...");
  const logsSnap = await db.collection("production_logs").get();

  if (logsSnap.empty) {
    console.log("✅ No se encontraron documentos en 'production_logs'.");
    return;
  }

  const toUpdate = [];
  const alreadyOk = [];

  logsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.line === "drywall") {
      alreadyOk.push(doc.id);
    } else {
      toUpdate.push({
        id: doc.id,
        ref: doc.ref,
      });
    }
  });

  console.log(`📊 Estadísticas:`);
  console.log(`- Total documentos: ${logsSnap.size}`);
  console.log(`- Ya tienen line="drywall": ${alreadyOk.length}`);
  console.log(`- Pendientes de actualizar: ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log("\n✅ Todos los documentos están al día. Nada que hacer.");
    return;
  }

  if (!APPLY) {
    console.log("\n👀 Muestra de IDs que se actualizarían:");
    console.log(
      toUpdate
        .slice(0, 10)
        .map((t) => t.id)
        .join(", ") + (toUpdate.length > 10 ? "..." : ""),
    );
    console.log(
      "\n💡 Fin de simulación. Usa --apply para ejecutar (requiere CONFIRM_BACKUP=true).",
    );
    return;
  }

  // 2. Ejecutar actualizaciones en lotes
  console.log(`\n⚙️ Ejecutando actualizaciones en lotes (batch size: 500)...`);

  const BATCH_SIZE = 500;
  let updatedCount = 0;
  let batch = db.batch();
  let currentBatchCount = 0;

  for (let i = 0; i < toUpdate.length; i++) {
    const docInfo = toUpdate[i];

    // Solo actualizar el campo 'line'
    batch.update(docInfo.ref, {
      line: "drywall",
      // Opcional: podrías querer marcar que fue un backfill, pero según requisitos solo 'line'
    });

    currentBatchCount++;
    updatedCount++;

    if (currentBatchCount === BATCH_SIZE || i === toUpdate.length - 1) {
      await batch.commit();
      console.log(
        `✅ Lote completado. Progresado: ${updatedCount}/${toUpdate.length}`,
      );
      batch = db.batch();
      currentBatchCount = 0;
    }
  }

  console.log(
    `\n🏁 Backfill finalizado con éxito. ${updatedCount} documentos actualizados.`,
  );
}

run().catch((err) => {
  console.error("\n💥 Error fatal:", err);
  process.exit(1);
});
