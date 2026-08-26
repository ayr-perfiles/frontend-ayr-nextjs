import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc } from "firebase/firestore";
import { makeRulesEnv, asAdmin, asSupervisor, asOperator, UID } from "./helpers/rulesEnv";

// TANDA 1 RED — 2026-08-26. Ancla la brecha de permisos destapada en el recon
// de este mismo dia (PASO 0/0-bis/0-ter/0-quater): OPERATOR hoy es isStaff() en
// firestore.rules y puede crear/actualizar sales, coils, production_logs, las 8
// colecciones de STAFF_CRUD, crear en las append-only, y crear/actualizar/BORRAR
// customers/contacts/coil_finishes -- pese a que la UI no le da NINGUNA superficie
// de escritura (la unica pantalla que alcanza, /admin/lines/drywall/operator via
// HistoryTab, es 100% lectura). Este archivo describe el comportamiento DESEADO
// (mas restrictivo), todavia no implementado en la rule -- los GRUPO 1-5 estan
// escritos para fallar HOY (assertFails sobre una escritura que la rule permisiva
// deja pasar). No tocar firestore.rules en esta tanda.
//
// Aislado con su propio projectId, mismo molde que los 5 archivos hermanos.

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeRulesEnv("demo-rules-operator-writes");
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

async function seed(col: string, id = "seeded"): Promise<void> {
  await env.withSecurityRulesDisabled(async (god) => {
    await setDoc(doc(god.firestore(), col, id), { seed: true });
  });
}

// Misma shape que baseSale()/seedSale() de sales.rules.test.ts — replicada, no
// inventada. Necesaria SOLO para GRUPO 2: la rule de update de `sales`
// (firestore.rules:80-81) lee `resource.data.status`/`request.resource.data.status`
// sin accessor seguro. Sobre un doc sembrado con `seed()` genérico (sin `status`),
// esa lectura hace fallar la evaluación de la rule y Firestore deniega para
// CUALQUIER rol — el test terminaría midiendo el sembrado, no el permiso de
// OPERATOR. Con `status` en un valor NO-VOIDED (aquí "COMPLETED"), la condición
// se evalúa de verdad y el resultado sí depende del rol.
function baseSale() {
  return {
    status: "COMPLETED",
    totalAmount: 1180,
    subtotal: 1000,
    igv: 180,
    exchangeRate: 3.75,
    currency: "PEN",
    paymentType: "CONTADO",
    items: [{ sku: "TEST-SKU", quantity: 2, unitPrice: 500 }],
    customerName: "CLIENTE TEST",
  };
}

async function seedSale(id: string): Promise<void> {
  await env.withSecurityRulesDisabled(async (god) => {
    await setDoc(doc(god.firestore(), "sales", id), baseSale());
  });
}

const STAFF_CRUD = [
  "coils",
  "cut_orders",
  "strips_stock",
  "production_logs",
  "inventory_stock",
  "roofing_stock",
  "metallic_roofing_stock",
  "trading_stock",
];

const STAFF_FULL = ["customers", "contacts", "coil_finishes"];

const APPEND_ONLY = [
  "audit_logs",
  "strips_movements",
  "kardex_movements",
  "roofing_stock_movements",
  "metallic_roofing_stock_movements",
  "trading_stock_movements",
  "services_stock_movements",
];

describe("firestore.rules — RED deseado: OPERATOR sin escritura (v6.65.0, no implementado)", () => {
  describe("GRUPO 1 — OPERATOR no crea ni actualiza STAFF_CRUD", () => {
    it.each(STAFF_CRUD)("%s: OPERATOR create -> assertFails, update -> assertFails", async (col) => {
      await seed(col);
      const db = asOperator(env);
      await assertFails(setDoc(doc(db, col, "nuevo-operator"), { seed: true }));
      await assertFails(updateDoc(doc(db, col, "seeded"), { probe: 1 }));
    });
  });

  describe("GRUPO 2 — OPERATOR no toca sales", () => {
    it("sales: OPERATOR create -> assertFails", async () => {
      const db = asOperator(env);
      await assertFails(setDoc(doc(db, "sales", "nuevo-operator"), { seed: true }));
    });

    it("sales: OPERATOR update de campo benigno (customerName) -> assertFails", async () => {
      await seedSale("V-op-1");
      const db = asOperator(env);
      await assertFails(updateDoc(doc(db, "sales", "V-op-1"), { customerName: "MUTADO" }));
    });

    it("sales/{id}/history: OPERATOR create -> assertFails", async () => {
      const db = asOperator(env);
      await assertFails(setDoc(doc(db, "sales", "V-op-2", "history", "h-operator"), { seed: true }));
    });
  });

  describe("GRUPO 3 — OPERATOR no escribe catalogos de contacto (STAFF_FULL)", () => {
    it.each(STAFF_FULL)(
      "%s: OPERATOR create -> assertFails, update -> assertFails, delete -> assertFails",
      async (col) => {
        await seed(col);
        const db = asOperator(env);
        await assertFails(setDoc(doc(db, col, "nuevo-operator"), { seed: true }));
        await assertFails(updateDoc(doc(db, col, "seeded"), { probe: 1 }));
        await assertFails(deleteDoc(doc(db, col, "seeded")));
      },
    );
  });

  describe("GRUPO 4 — SUPERVISOR no BORRA STAFF_FULL", () => {
    // decisión de negocio del dueño 2026-08-26 — simetría con coils/production_logs,
    // borrado destructivo sin auditoría queda ADMIN-only. Hoy customers/contacts/
    // coil_finishes NO tienen delete admin-only (ver GRUPO T de collections.rules.test.ts,
    // que ancla el comportamiento MEDIDO opuesto) — este grupo describe el destino.
    it.each(STAFF_FULL)("%s: SUPERVISOR delete -> assertFails", async (col) => {
      await seed(col);
      await assertFails(deleteDoc(doc(asSupervisor(env), col, "seeded")));
    });
  });

  describe("GRUPO 5 — OPERATOR no crea en append-only", () => {
    it.each(APPEND_ONLY)("%s: OPERATOR create -> assertFails", async (col) => {
      const db = asOperator(env);
      await assertFails(setDoc(doc(db, col, "nuevo-operator"), { seed: true }));
    });
  });

  describe("GRUPO 6 — control positivo (ADMIN sigue pudiendo, obligatorio)", () => {
    it.each(STAFF_CRUD)("%s: ADMIN create -> assertSucceeds, update -> assertSucceeds", async (col) => {
      await seed(col);
      const db = asAdmin(env);
      await assertSucceeds(setDoc(doc(db, col, "nuevo-admin"), { seed: true }));
      await assertSucceeds(updateDoc(doc(db, col, "seeded"), { probe: 1 }));
    });

    it.each(STAFF_FULL)(
      "%s: ADMIN create -> assertSucceeds, update -> assertSucceeds, delete -> assertSucceeds",
      async (col) => {
        await seed(col);
        const db = asAdmin(env);
        await assertSucceeds(setDoc(doc(db, col, "nuevo-admin"), { seed: true }));
        await assertSucceeds(updateDoc(doc(db, col, "seeded"), { probe: 1 }));
        await assertSucceeds(deleteDoc(doc(db, col, "seeded")));
      },
    );
  });

  describe("GRUPO 7 — regresión de lectura (NO es RED, debe pasar ya)", () => {
    // la terminal de drywall (/admin/lines/drywall/operator, HistoryTab, onSnapshot)
    // es la ÚNICA superficie de OPERATOR en prod, con 2 usuarios reales. isStaff()
    // debe seguir gobernando el read.
    it("production_logs: OPERATOR get -> assertSucceeds", async () => {
      await seed("production_logs");
      await assertSucceeds(getDoc(doc(asOperator(env), "production_logs", "seeded")));
    });

    it("production_logs: OPERATOR query sobre la colección -> assertSucceeds", async () => {
      await seed("production_logs");
      const db = asOperator(env);
      await assertSucceeds(getDocs(collection(db, "production_logs")));
    });

    // segunda superficie viva: AuthContext lee users/{uid} propio para resolver el rol.
    it("users/{propio uid}: OPERATOR get -> assertSucceeds", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "users", UID.operator), { role: "OPERATOR", isActive: true });
      });
      await assertSucceeds(getDoc(doc(asOperator(env), "users", UID.operator)));
    });
  });
});
