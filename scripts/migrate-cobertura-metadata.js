/**
 * scripts/migrate-cobertura-metadata.js
 *
 * Migración one-shot: escribe widthMm y densityFactor en productos de cobertura aluzinc.
 *
 * Decisiones de diseño:
 * - Colección: metallic_roofing_catalog
 * - Solo familias COBERTURA y PLANCHA (ACCESORIO y BOBINA no usan densityFactor).
 * - Idempotente: omite documentos que ya tengan widthMm (migración ya aplicada).
 * - widthMm default: 1200mm (override manual posterior desde la UI).
 * - densityFactor: 0.008 para todo aluzinc (C1 corregido — natural y prepintado usan igual factor)
 * - metaSource: 'parser' para distinguir de overrides manuales.
 * - NO sobreescribe si el doc ya tiene widthMm (campo elegido como flag de idempotencia).
 *
 * Uso:
 *   npx tsx scripts/migrate-cobertura-metadata.js          # dry-run (reporta pero no escribe)
 *   CONFIRM_BACKUP=true npx tsx scripts/migrate-cobertura-metadata.js --apply
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'ayrsteel-2026';
const COLLECTION = 'metallic_roofing_catalog';
const WIDTH_MM_DEFAULT = 1200;
const APPLY = process.argv.includes('--apply');

if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId: PROJECT_ID });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

/** Todo aluzinc (natural o prepintado) usa 0.008. Devuelve null solo si color es undefined/null (campo faltante). */
function deriveDensityFactor(color) {
  if (color === undefined || color === null) return null;
  return 0.008;
}

async function run() {
  console.log(`\n🚀 Migración metadata cobertura (${APPLY ? 'MODO EJECUCIÓN' : 'MODO SIMULACIÓN'})\n`);

  if (APPLY && process.env.CONFIRM_BACKUP !== 'true') {
    console.error('❌ ERROR: Confirma backup antes de ejecutar: CONFIRM_BACKUP=true');
    process.exit(1);
  }

  const snap = await db
    .collection(COLLECTION)
    .where('family', 'in', ['COBERTURA', 'PLANCHA'])
    .get();

  const rows = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const sku = docSnap.id;

    // Idempotencia: skip si ya tiene widthMm
    if (data.widthMm !== undefined) {
      rows.push({ SKU: sku, Estado: '⏩ YA MIGRADO', widthMm: data.widthMm, densityFactor: data.densityFactor });
      continue;
    }

    const densityFactor = deriveDensityFactor(data.color);
    if (densityFactor === null) {
      rows.push({ SKU: sku, Estado: '⚠️ REVISAR — color undefined', widthMm: WIDTH_MM_DEFAULT, densityFactor: '?' });
      continue;
    }

    rows.push({
      SKU: sku,
      Family: data.family,
      Color: data.color === '' ? '(natural)' : (data.color || '—'),
      Estado: APPLY ? '✅ ESCRITO' : '📝 PENDIENTE',
      widthMm: WIDTH_MM_DEFAULT,
      densityFactor,
    });

    if (APPLY) {
      await db.collection(COLLECTION).doc(sku).update({
        widthMm: WIDTH_MM_DEFAULT,
        densityFactor,
        metaSource: 'parser',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.log('📋 Resumen de productos:');
  console.table(rows);

  const pendientes = rows.filter((r) => r.Estado === '📝 PENDIENTE');
  const skippedReview = rows.filter((r) => r.Estado && r.Estado.startsWith('⚠️'));
  const yaHechos = rows.filter((r) => r.Estado && r.Estado.startsWith('⏩'));

  console.log('\n📊 Totales:');
  console.log(`  Procesados:     ${snap.size}`);
  console.log(`  Ya migrados:    ${yaHechos.length}`);
  console.log(`  Pendientes:     ${pendientes.length}`);
  if (skippedReview.length > 0) {
    console.log(`  Requieren revisión: ${skippedReview.length}`);
    console.log('  SKUs con revisión pendiente:', skippedReview.map((r) => r.SKU).join(', '));
  }

  if (!APPLY) {
    console.log('\n💡 Fin de dry-run. Usa CONFIRM_BACKUP=true --apply para ejecutar.');
  } else {
    console.log('\n🏁 Migración completada.');
  }
}

run().catch((err) => {
  console.error('\n💥 Error fatal:', err);
  process.exit(1);
});
