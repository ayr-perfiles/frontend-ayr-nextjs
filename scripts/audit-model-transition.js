/**
 * AUDIT_MODEL_TRANSITION.JS
 * -------------------------
 * Script de AUDITORÍA DE SOLO LECTURA para analizar la transición del modelo de corte.
 * Compara 'coil.plannedStrips' (modelo viejo) vs 'cut_orders/strips_stock' (modelo nuevo).
 *
 * REGLAS ABSOLUTAS:
 * 1. SOLO LECTURA. El script NO escribe, NO recibe, NO borra nada.
 * 2. Diseñado para correr contra un emulador o copia de staging.
 * 3. NO usar en producción sin confirmación explícita (ALLOW_PRODUCTION_AUDIT=true).
 *
 * USO:
 * 1. Configurar GOOGLE_APPLICATION_CREDENTIALS con el JSON de tu service account.
 * 2. node scripts/audit-model-transition.js
 */

import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// --- ESM SHIM PARA __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SEGURIDAD ---
const PROD_PROJECT_ID = "ayrsteel-2026";

async function startAudit() {
  // Inicialización preferencial por emulador si está presente
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: "ayrsteel-2026" });
    console.log("🎮 Conectado al EMULADOR de Firestore.");
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  } else {
    console.error(
      "❌ ERROR: Faltan credenciales (GOOGLE_APPLICATION_CREDENTIALS) o host de emulador (FIRESTORE_EMULATOR_HOST).",
    );
    process.exit(1);
  }

  const db = admin.firestore();
  const projectId = admin.app().options.projectId || "unknown";

  console.log(`\n🔍 INICIANDO AUDITORÍA EN PROYECTO: ${projectId}`);

  if (
    projectId.includes(PROD_PROJECT_ID) &&
    process.env.ALLOW_PRODUCTION_AUDIT !== "true"
  ) {
    console.error("\n⚠️ ADVERTENCIA: Detectado entorno de PRODUCCIÓN.");
    console.error(
      "Para correr la auditoría en prod, define la variable de entorno ALLOW_PRODUCTION_AUDIT=true.",
    );
    console.error(
      "Se recomienda usar una copia de los datos (export/import) en un entorno seguro.",
    );
    process.exit(1);
  }

  const report = {
    timestamp: new Date().toISOString(),
    projectId,
    summary: {},
    coils: {
      byStatus: {},
      trappedOldModel: [],
      statusMismatches: [],
      orphanEnTercero: [],
    },
    cutOrders: { byStatus: {}, invalidCoilRefs: [], statusMismatches: [] },
    strips: { stock: {}, reconciliationMismatches: [], trappedPending: [] },
    production: { bySku: {}, oldFlowLogs: [], orphanLogs: [] },
    financials: { usdSuspiciousRate: [], missingRate: [] },
    obsoleteFields: { totalFound: 0, samples: [] },
  };

  try {
    console.log("⌛ Cargando datos de Firestore (Solo lectura)...");

    // Carga paralela de colecciones principales
    const [
      coilSnap,
      orderSnap,
      stockSnap,
      moveSnap,
      logSnap,
      saleSnap,
      purchaseSnap,
    ] = await Promise.all([
      db.collection("coils").get(),
      db.collection("cut_orders").get(),
      db.collection("strips_stock").get(),
      db.collection("strips_movements").get(),
      db.collection("production_logs").get(),
      db.collection("sales").get(),
      db.collection("purchases").get(),
    ]);

    const coils = coilSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const orders = orderSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const logs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const stockDocs = stockSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const moves = moveSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 1. AUDITORÍA DE BOBINAS
    console.log("-> Analizando Bobinas...");
    const activeOrderCoilIds = new Set(
      orders
        .filter((o) => o.status !== "ANULADA")
        .flatMap((o) => o.coils.map((c) => c.coilId)),
    );

    coils.forEach((coil) => {
      const status = coil.status || "UNKNOWN";
      report.coils.byStatus[status] = (report.coils.byStatus[status] || 0) + 1;

      // Detectar plan viejo
      if (coil.plannedStrips && coil.plannedStrips.length > 0) {
        const pending = coil.plannedStrips.some((s) => s.pendingCount > 0);
        report.coils.trappedOldModel.push({
          id: coil.id,
          status,
          isPending: pending,
          totalStrips: coil.plannedStrips.length,
        });

        // Inconsistencia: AVAILABLE pero con plan a medio cortar
        const progress = coil.plannedStrips.some(
          (s) => s.initialCount !== s.pendingCount,
        );
        if (status === "AVAILABLE" && progress) {
          report.coils.statusMismatches.push({
            id: coil.id,
            msg: "Bobina disponible pero plan tiene progreso",
          });
        }
      }

      // Huérfanas en Tercero
      if (status === "EN_TERCERO" && !activeOrderCoilIds.has(coil.id)) {
        report.coils.orphanEnTercero.push(coil.id);
      }
    });

    // 2. AUDITORÍA DE ÓRDENES DE CORTE
    console.log("-> Analizando Órdenes de Corte...");
    const coilMap = new Map(coils.map((c) => [c.id, c]));

    orders.forEach((order) => {
      report.cutOrders.byStatus[order.status] =
        (report.cutOrders.byStatus[order.status] || 0) + 1;

      order.coils.forEach((ref) => {
        const fullCoil = coilMap.get(ref.coilId);
        if (!fullCoil) {
          report.cutOrders.invalidCoilRefs.push({
            orderId: order.id,
            coilId: ref.coilId,
          });
        } else {
          // Coherencia de status
          if (order.status === "ENVIADO" && fullCoil.status !== "EN_TERCERO") {
            report.cutOrders.statusMismatches.push({
              orderId: order.id,
              coilId: fullCoil.id,
              orderStatus: order.status,
              coilStatus: fullCoil.status,
            });
          }
          if (order.status === "RECIBIDO" && fullCoil.status !== "PROCESSED") {
            report.cutOrders.statusMismatches.push({
              orderId: order.id,
              coilId: fullCoil.id,
              orderStatus: order.status,
              coilStatus: fullCoil.status,
            });
          }
        }
      });
    });

    // 3. RECONCILIACIÓN DE FLEJES
    console.log("-> Reconciliando Flejes...");
    const movesByWidth = {};
    moves.forEach((m) => {
      if (!m.widthMm) return;
      if (!movesByWidth[m.widthMm]) movesByWidth[m.widthMm] = { calculated: 0 };
      const qty = m.quantity || 0;
      if (m.type === "ENTRADA") movesByWidth[m.widthMm].calculated += qty;
      if (m.type === "SALIDA") movesByWidth[m.widthMm].calculated -= qty;
      if (m.type === "AJUSTE") movesByWidth[m.widthMm].calculated += qty;
    });

    stockDocs.forEach((s) => {
      const actual = s.totalStrips || 0;
      const expected = movesByWidth[s.widthMm]?.calculated || 0;
      if (actual !== expected) {
        report.strips.reconciliationMismatches.push({
          width: s.widthMm,
          actual,
          expected,
          diff: actual - expected,
        });
      }
    });

    // Flejes atrapados en modelo viejo (pendientes)
    const trappedPending = {};
    coils.forEach((c) => {
      if (Array.isArray(c.plannedStrips)) {
        c.plannedStrips.forEach((ps) => {
          const qty = Number(ps.pendingCount) || 0;
          if (qty > 0) {
            const key = `${ps.sku}_${ps.width}`;
            if (!trappedPending[key])
              trappedPending[key] = {
                sku: ps.sku,
                width: ps.width,
                total: 0,
                coils: [],
              };
            trappedPending[key].total += qty;
            trappedPending[key].coils.push(c.id);
          }
        });
      }
    });
    report.strips.trappedPending = Object.values(trappedPending);

    // 4. AUDITORÍA DE PRODUCCIÓN
    console.log("-> Analizando Producción...");
    logs.forEach((log) => {
      report.production.bySku[log.sku] =
        (report.production.bySku[log.sku] || 0) + (log.piecesProduced || 0);

      if (log.parentCoilId) {
        report.production.oldFlowLogs.push(log.id);
        if (!coilMap.has(log.parentCoilId)) {
          report.production.orphanLogs.push({
            logId: log.id,
            parentCoilId: log.parentCoilId,
          });
        }
      }
    });

    // 5. AUDITORÍA FINANCIERA
    console.log("-> Analizando Finanzas...");
    const finCollections = [
      { name: "coils", snap: coilSnap },
      { name: "sales", snap: saleSnap },
      { name: "purchases", snap: purchaseSnap },
    ];

    finCollections.forEach((coll) => {
      coll.snap.docs.forEach((doc) => {
        const data = doc.data();
        const meta = data.metadata || data.sunat || data;
        const currency = data.currency || meta.currency;
        const rate = data.exchangeRate || meta.exchangeRate;

        if (currency === "USD") {
          if (!rate || rate <= 0)
            report.financials.missingRate.push(`${coll.name}/${doc.id}`);
          if (rate === 3.75 || rate === 3.8) {
            report.financials.usdSuspiciousRate.push({
              id: `${coll.name}/${doc.id}`,
              rate,
            });
          }
        }

        // 6. CAMPOS OBSOLETOS (ej. affectsStock en sales)
        if (coll.name === "sales" && data.affectsStock !== undefined) {
          report.obsoleteFields.totalFound++;
          if (report.obsoleteFields.samples.length < 10) {
            report.obsoleteFields.samples.push({
              id: doc.id,
              field: "affectsStock",
            });
          }
        }
      });
    });

    // GENERAR RESUMEN
    const trappedStripsTotal = report.strips.trappedPending.reduce(
      (s, i) => s + i.total,
      0,
    );
    const trappedCoilsCount = new Set(
      report.strips.trappedPending.flatMap((i) => i.coils),
    ).size;

    report.summary = {
      verdict: `Flejes atrapados en modelo viejo: ${trappedStripsTotal} unidades en ${trappedCoilsCount} bobinas.`,
      inconsistencies: {
        orphanCoils: report.coils.orphanEnTercero.length,
        cutOrderMismatches: report.cutOrders.statusMismatches.length,
        stockDescuadres: report.strips.reconciliationMismatches.length,
        suspiciousRates: report.financials.usdSuspiciousRate.length,
        orphanProductionLogs: report.production.orphanLogs.length,
      },
      counts: {
        totalCoils: coils.length,
        totalOrders: orders.length,
        totalLogs: logs.length,
      },
    };

    // Guardar reporte JSON
    const reportPath = path.join(__dirname, "audit_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Salida por consola
    printFinalReport(report);
  } catch (error) {
    console.error("\n❌ Error crítico durante la auditoría:", error);
  }
}

function printFinalReport(report) {
  const { summary, coils, financials, obsoleteFields } = report;

  console.log("\n" + "=".repeat(60));
  console.log("📋 REPORTE DE AUDITORÍA DE TRANSICIÓN DE MODELO");
  console.log("=".repeat(60));
  console.log(`VERDICTO: ${summary.verdict}`);
  console.log("-".repeat(60));

  console.log(`\n1. BOBINAS Y ÓRDENES:`);
  console.log(`   - Bobinas Totales:    ${summary.counts.totalCoils}`);
  console.log(
    `   - Bobinas Huérfanas:  ${summary.inconsistencies.orphanCoils} (Status EN_TERCERO sin orden activa)`,
  );
  console.log(
    `   - Descuadres Status:  ${summary.inconsistencies.cutOrderMismatches} (Orden vs Bobina)`,
  );

  console.log(`\n2. STOCK DE FLEJES:`);
  console.log(
    `   - Descuadres Stock:   ${summary.inconsistencies.stockDescuadres} (Movimientos vs StockDoc)`,
  );
  console.log(`   - Flejes Pendientes (Modelo Viejo):`);
  report.strips.trappedPending.slice(0, 5).forEach((t) => {
    console.log(
      `     * ${t.sku} (${t.width}mm): ${t.total} unidades en ${t.coils.length} bobinas`,
    );
  });
  if (report.strips.trappedPending.length > 5)
    console.log(
      `     * ... y ${report.strips.trappedPending.length - 5} tipos más.`,
    );

  console.log(`\n3. FINANZAS Y LEGACY:`);
  console.log(
    `   - T.C. Sospechosos:   ${summary.inconsistencies.suspiciousRates} (USD con rate 3.75/3.80)`,
  );
  console.log(
    `   - Campos Obsoletos:   ${obsoleteFields.totalFound} docs con 'affectsStock'`,
  );

  console.log(`\n4. MUESTRA DE INCONSISTENCIAS (Primeras 5):`);
  if (summary.inconsistencies.orphanCoils > 0) {
    console.log(
      `   - Bobinas huérfanas: ${coils.orphanEnTercero.slice(0, 5).join(", ")}`,
    );
  }
  if (financials.usdSuspiciousRate.length > 0) {
    console.log(
      `   - Rates sospechosos: ${financials.usdSuspiciousRate
        .slice(0, 5)
        .map((r) => r.id)
        .join(", ")}`,
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    "✅ Auditoría terminada. Reporte completo: scripts/audit_report.json",
  );
  console.log("=".repeat(60) + "\n");
}

startAudit();
