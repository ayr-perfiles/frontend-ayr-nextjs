/**
 * scripts/fix-density-factor-natural.js
 *
 * Corrige densityFactor en SKUs de cobertura que fueron migrados con el valor
 * incorrecto 0.00785 para productos naturales/galv aluzinc.
 *
 * Modelo correcto: todo material aluzinc (natural o prepintado) → 0.008.
 * El valor 0.00785 solo aplica a galvanizado/drywall.
 *
 * Criterio de selección:
 *   - family in ['COBERTURA', 'PLANCHA']
 *   - metaSource === 'parser'    (solo migración automática, no ediciones manuales)
 *   - densityFactor === 0.00785  (valor bugueado por migrate-cobertura-metadata.js)
 *
 * Uso:
 *   npx tsx scripts/fix-density-factor-natural.js          # dry-run (reporta pero no escribe)
 *   CONFIRM_BACKUP=true npx tsx scripts/fix-density-factor-natural.js --apply
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'ayrsteel-2026';
const COLLECTION = 'metallic_roofing_catalog';
const APPLY = process.argv.includes('--apply');
const OLD_VALUE = 0.00785;
const CORRECT_VALUE = 0.008;

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
  console.log(`\n🔧 Fix densityFactor natural/galv aluzinc (${APPLY ? 'MODO EJECUCIÓN' : 'MODO SIMULACIÓN'})\n`);

  if (APPLY && process.env.CONFIRM_BACKUP !== 'true') {
    console.error('❌ ERROR: Confirma backup antes de ejecutar: CONFIRM_BACKUP=true');
    process.exit(1);
  }

  const snap = await db
    .collection(COLLECTION)
    .where('family', 'in', ['COBERTURA', 'PLANCHA'])
    .where('metaSource', '==', 'parser')
    .where('densityFactor', '==', OLD_VALUE)
    .get();

  if (snap.empty) {
    console.log('✅ No hay SKUs que corregir. densityFactor ya está correcto en todos los productos auto-migrados.');
    return;
  }

  const rows = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const sku = docSnap.id;

    rows.push({
      SKU: sku,
      Family: data.family,
      Color: data.color === '' ? '(natural)' : (data.color || '—'),
      densityFactor_antes: OLD_VALUE,
      densityFactor_después: CORRECT_VALUE,
      Estado: APPLY ? '✅ CORREGIDO' : '📝 PENDIENTE',
    });

    if (APPLY) {
      await db.collection(COLLECTION).doc(sku).update({
        densityFactor: CORRECT_VALUE,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.log('📋 SKUs afectados:');
  console.table(rows);

  console.log(`\n📊 Total: ${snap.size} SKU${snap.size !== 1 ? 's' : ''} con densityFactor=${OLD_VALUE} (metaSource=parser)`);

  if (!APPLY) {
    console.log('\n💡 Fin de dry-run. Usa CONFIRM_BACKUP=true --apply para ejecutar.');
  } else {
    console.log('\n🏁 Corrección completada. densityFactor actualizado a', CORRECT_VALUE);
  }
}

run().catch((err) => {
  console.error('\n💥 Error fatal:', err);
  process.exit(1);
});
