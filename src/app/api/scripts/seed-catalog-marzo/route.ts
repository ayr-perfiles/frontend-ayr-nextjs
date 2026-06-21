import { NextResponse } from 'next/server';
import { initAdmin } from "@/lib/firebase/adminApp";

type Line = "metallic-roofing" | "roofing" | "trading" | "services";

interface SeedRow {
  sku: string;
  name: string;
  line: Line;
}

const ROWS: SeedRow[] = [
  { sku: "COB030ROJO", name: "COBERTURA DE ALUZINC 0.30MM ROJO", line: "metallic-roofing" },
  { sku: "COB030AZUL", name: "COBERTURA DE ALUZINC 0.30MM AZUL", line: "metallic-roofing" },
  { sku: "COB035ROJO", name: "COBERTURA DE ALUZINC 0.35MM ROJO", line: "metallic-roofing" },
  { sku: "COB040ROJO", name: "COBERTURA DE ALUZINC 0.40MM ROJO", line: "metallic-roofing" },
  { sku: "COB040AZUL", name: "COBERTURA DE ALUZINC 0.40MM AZUL", line: "metallic-roofing" },
  { sku: "COB040NATURAL", name: "COBERTURA DE ALUZINC 0.40MM NATURAL", line: "metallic-roofing" },
  { sku: "PL030RJ6MT", name: "COBERTURA DE ALUZINC RA-4 0.30 ROJO 6M", line: "metallic-roofing" },
  { sku: "PL030AZ6MT", name: "COBERTURA DE ALUZINC RA-4 0.30 AZUL 6M", line: "metallic-roofing" },
  { sku: "PL040RJ6MT", name: "COBERTURA DE ALUZINC RA-4 0.40 ROJO 6M", line: "metallic-roofing" },
  { sku: "PL040NT6MT", name: "COBERTURA DE ALUZINC RA-4 0.40 NATURAL 6M", line: "metallic-roofing" },
  { sku: "PL040X6MT", name: "COBERTURA DE ALUZINC AZUL RA-4 0.40 6M", line: "metallic-roofing" },
  { sku: "ACCES030ROJO", name: "ACCESORIO DE ALUZINC 0.30MM ROJO", line: "metallic-roofing" },
  { sku: "UPVC6MT", name: "TC5 UPVC ROJO 1.5 MM X 1.075 X 6M", line: "roofing" },
  { sku: "UPVC6MTAZUL", name: "TC5 UPVC AZUL 1.5 MM X 1.075 X 6M", line: "roofing" },
  { sku: "UPVC36MT", name: "TC5 UPVC ROJO 1.5 MM X 1.075 X 3.6M", line: "roofing" },
  { sku: "UPVC36MTAZUL", name: "TC5 UPVC AZUL 1.5 MM X 1.075 X 3.6M", line: "roofing" },
  { sku: "COBPOLI", name: "POLICARBONATO TIPO PV4 DE 6.00M", line: "trading" },
  { sku: "POLI600", name: "POLICARBONATO TIPO PV4 DE 6.00M", line: "trading" },
  { sku: "CONFORMADO", name: "SERVICIO DE CONFORMADO", line: "services" },
];

function parseThickness(sku: string): number {
  const m = sku.match(/(?:COB|PL|ACCES)(\d{3})/);
  if (m) return parseInt(m[1], 10) / 100;
  return 0.3;
}
function parseColor(sku: string, name: string): string | undefined {
  const hay = (sku + " " + name).toUpperCase();
  if (hay.includes("NATURAL") || /\bNT\b/.test(sku)) return "NATURAL";
  if (hay.includes("AZUL") || /\bAZ\b/.test(sku) || sku.endsWith("X6MT")) return "AZUL";
  if (hay.includes("ROJO") || /\bRJ\b/.test(sku)) return "ROJO";
  return undefined;
}
function parseLengthMt(sku: string): number | undefined {
  if (sku.includes("36MT")) return 3.6;
  if (sku.includes("6MT")) return 6;
  return undefined;
}

function buildMetallic(r: SeedRow) {
  const family = r.sku.startsWith("PL") ? "PLANCHA" : r.sku.startsWith("ACCES") ? "ACCESORIO" : "COBERTURA";
  const unit = family === "COBERTURA" ? "METRO" : "PIEZA";
  const length = family === "PLANCHA" ? parseLengthMt(r.sku) : undefined;
  return {
    sku: r.sku,
    displayName: r.name,
    family,
    finish: "ALUZINC",
    color: parseColor(r.sku, r.name),
    thickness: parseThickness(r.sku),
    unit,
    active: true,
    ...(length ? { length } : {}),
  };
}

function buildRoofing(r: SeedRow) {
  const color = r.sku.includes("AZUL") ? "AZUL" : "ROJO";
  const length = r.sku.includes("36MT") ? 3.6 : 6;
  return {
    sku: r.sku,
    displayName: r.name,
    material: "UPVC",
    color,
    thickness: 1.5,
    width: 1.075,
    length,
    unit: "PIEZA",
  };
}

function buildTrading(r: SeedRow) {
  const unit = r.sku === "COBPOLI" ? "METRO" : "PIEZA";
  return {
    sku: r.sku,
    displayName: r.name,
    category: "POLICARBONATO",
    spec: "PV4 6.00M",
    unit,
    active: true,
  };
}

function buildServices(r: SeedRow) {
  return {
    sku: r.sku,
    displayName: r.name,
    description: "Servicio de conformado por tonelada",
    unit: "TONELADA",
    active: true,
  };
}

function buildInput(r: SeedRow): any {
  switch (r.line) {
    case "metallic-roofing": return buildMetallic(r);
    case "roofing": return buildRoofing(r);
    case "trading": return buildTrading(r);
    case "services": return buildServices(r);
  }
}

/**
 * GET /api/scripts/seed-catalog-marzo
 * Siembra catálogos desde facturación de marzo 2026 usando Firebase Admin.
 */
export async function GET() {
  try {
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    const summary: Record<string, { created: number; updated: number; failed: number }> = {};
    
    for (const r of ROWS) {
      summary[r.line] ??= { created: 0, updated: 0, failed: 0 };
      const input = buildInput(r);
      const collectionName = `${r.line}_catalog`;
      
      try {
        const docRef = db.collection(collectionName).doc(r.sku);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
          await docRef.update({ ...input, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          summary[r.line].updated++;
        } else {
          await docRef.set({ 
            ...input, 
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
          summary[r.line].created++;
        }
      } catch (err) {
        summary[r.line].failed++;
        console.error(`✗ [${r.line}] ${r.sku}:`, err);
      }
    }

    return NextResponse.json({
      message: "Siembra de catálogo completada (via Admin).",
      summary,
      excluded: ["drywall (PRODUCT_CATALOG)", "BOB* (coils)", "ANTI (anticipo)"]
    });
  } catch (error: any) {
    console.error("[API Seed Catalog Marzo]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import admin from 'firebase-admin';
