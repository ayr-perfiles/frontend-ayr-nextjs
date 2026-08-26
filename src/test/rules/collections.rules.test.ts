import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { makeRulesEnv, asAdmin, asSupervisor, asOperator } from "./helpers/rulesEnv";

// Ultima tanda de cobertura: las 17 colecciones que quedaban sin custodio propio.
// Solo 5 (purchases, customers, coils, production_logs, metallic_roofing_stock)
// pasaron por la matriz medida contra el emulador en TANDA 1A/1A-bis. Las otras
// 12 se assertean contra la RULE DECLARADA en firestore.rules — si alguna de esas
// 12 sale roja, es un HALLAZGO REAL (la rule no hace lo que dice), no un error de
// este archivo. products/supplier_sku_map ya estan en foundation.rules.test.ts,
// no se repiten acá.

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeRulesEnv("demo-rules-collections");
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const ROLES = [
  { label: "ADMIN", dbFn: asAdmin },
  { label: "SUPERVISOR", dbFn: asSupervisor },
  { label: "OPERATOR", dbFn: asOperator },
] as const;

async function seed(col: string, id = "seeded"): Promise<void> {
  await env.withSecurityRulesDisabled(async (god) => {
    await setDoc(doc(god.firestore(), col, id), { seed: true });
  });
}

describe("firestore.rules — collections (catalogos, staff-crud, staff-full, admin-only)", () => {
  describe("GRUPO Q — catalogos (read staff, write admin/supervisor)", () => {
    // NO MEDIDA — rule declarada. Los 4 catalogos de este grupo NO estaban en la
    // matriz medida contra el emulador (roofing_catalog, metallic_roofing_catalog,
    // trading_catalog, services_catalog). products/supplier_sku_map, que sí lo
    // estaban, ya viven en foundation.rules.test.ts.
    const CATALOGOS = ["roofing_catalog", "metallic_roofing_catalog", "trading_catalog", "services_catalog"];

    it.each(CATALOGOS)("%s: ADMIN/SUPERVISOR escriben, OPERATOR solo lee", async (col) => {
      await seed(col);
      await assertSucceeds(setDoc(doc(asAdmin(env), col, "nuevo-admin"), { seed: true }));
      await assertSucceeds(updateDoc(doc(asAdmin(env), col, "seeded"), { probe: 1 }));
      await assertSucceeds(deleteDoc(doc(asAdmin(env), col, "seeded")));

      await seed(col);
      await assertSucceeds(setDoc(doc(asSupervisor(env), col, "nuevo-supervisor"), { seed: true }));
      await assertSucceeds(updateDoc(doc(asSupervisor(env), col, "seeded"), { probe: 1 }));

      await assertSucceeds(getDoc(doc(asOperator(env), col, "seeded")));
      await assertFails(setDoc(doc(asOperator(env), col, "nuevo-operator"), { seed: true }));
      await assertFails(updateDoc(doc(asOperator(env), col, "seeded"), { probe: 1 }));
      await assertFails(deleteDoc(doc(asOperator(env), col, "seeded")));
    });
  });

  describe("GRUPO R — purchases (read también restringido, molde propio)", () => {
    // OPERATOR sin lectura: purchases es la unica no-admin-only que
    // tambien le cierra el read. Medido, no deducido.
    it("purchases: ADMIN y SUPERVISOR acceso total", async () => {
      await seed("purchases");
      await assertSucceeds(getDoc(doc(asAdmin(env), "purchases", "seeded")));
      await assertSucceeds(setDoc(doc(asAdmin(env), "purchases", "nuevo-admin"), { seed: true }));
      await assertSucceeds(updateDoc(doc(asAdmin(env), "purchases", "seeded"), { probe: 1 }));
      await assertSucceeds(deleteDoc(doc(asAdmin(env), "purchases", "seeded")));

      await seed("purchases");
      await assertSucceeds(getDoc(doc(asSupervisor(env), "purchases", "seeded")));
      await assertSucceeds(setDoc(doc(asSupervisor(env), "purchases", "nuevo-supervisor"), { seed: true }));
      await assertSucceeds(updateDoc(doc(asSupervisor(env), "purchases", "seeded"), { probe: 1 }));
    });

    it("purchases: OPERATOR no lee ni escribe", async () => {
      await seed("purchases");
      const db = asOperator(env);
      await assertFails(getDoc(doc(db, "purchases", "seeded")));
      await assertFails(setDoc(doc(db, "purchases", "nuevo"), { seed: true }));
      await assertFails(updateDoc(doc(db, "purchases", "seeded"), { probe: 1 }));
      await assertFails(deleteDoc(doc(db, "purchases", "seeded")));
    });
  });

  describe("GRUPO S — staff CRUD + delete admin-only", () => {
    // MEDIDAS: coils, production_logs, metallic_roofing_stock.
    // NO MEDIDA — rule declarada: cut_orders, strips_stock, inventory_stock,
    // roofing_stock, trading_stock.
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

    it.each(STAFF_CRUD)("%s: ADMIN/SUPERVISOR/OPERATOR get/create/update, ADMIN delete", async (col) => {
      await seed(col);
      for (const role of ROLES) {
        await assertSucceeds(getDoc(doc(role.dbFn(env), col, "seeded")));
      }
      for (const role of ROLES) {
        await assertSucceeds(setDoc(doc(role.dbFn(env), col, `nuevo-${role.label}`), { seed: true }));
      }
      for (const role of ROLES) {
        await assertSucceeds(updateDoc(doc(role.dbFn(env), col, "seeded"), { probe: 1 }));
      }
      await assertSucceeds(deleteDoc(doc(asAdmin(env), col, "seeded")));
    });

    it.each(STAFF_CRUD)("%s: solo ADMIN borra", async (col) => {
      await seed(col);
      await assertFails(deleteDoc(doc(asSupervisor(env), col, "seeded")));
      await assertFails(deleteDoc(doc(asOperator(env), col, "seeded")));
    });
  });

  describe("GRUPO T — staff full (los 3 roles todo, delete incluido)", () => {
    // customers/contacts/coil_finishes no tienen delete admin-only, a diferencia de
    // coils/sales/production_logs. Se ancla el comportamiento MEDIDO (OPERATOR borra
    // clientes). Si esa asimetria es deseable o no es decision de negocio, otro frente.
    // MEDIDA: customers. NO MEDIDA — rule declarada: contacts, coil_finishes.
    const STAFF_FULL = ["customers", "contacts", "coil_finishes"];

    it.each(STAFF_FULL)("%s: ADMIN/SUPERVISOR/OPERATOR get/create/update/delete", async (col) => {
      await seed(col);
      for (const role of ROLES) {
        await assertSucceeds(getDoc(doc(role.dbFn(env), col, "seeded")));
      }
      for (const role of ROLES) {
        await assertSucceeds(setDoc(doc(role.dbFn(env), col, `nuevo-${role.label}`), { seed: true }));
      }
      for (const role of ROLES) {
        await assertSucceeds(updateDoc(doc(role.dbFn(env), col, "seeded"), { probe: 1 }));
      }
      for (const role of ROLES) {
        await assertSucceeds(deleteDoc(doc(role.dbFn(env), col, "seeded")));
      }
    });
  });

  describe("GRUPO U — integrations (admin-only, molde de settings)", () => {
    // NO MEDIDA — rule declarada.
    it("integrations: solo ADMIN", async () => {
      await seed("integrations");
      const db = asAdmin(env);
      await assertSucceeds(getDoc(doc(db, "integrations", "seeded")));
      await assertSucceeds(setDoc(doc(db, "integrations", "nuevo"), { seed: true }));
      await assertSucceeds(updateDoc(doc(db, "integrations", "seeded"), { probe: 1 }));
      await assertSucceeds(deleteDoc(doc(db, "integrations", "seeded")));
    });

    it("integrations: SUPERVISOR y OPERATOR sin acceso", async () => {
      await seed("integrations");
      await assertFails(getDoc(doc(asSupervisor(env), "integrations", "seeded")));
      await assertFails(getDoc(doc(asOperator(env), "integrations", "seeded")));
      await assertFails(setDoc(doc(asSupervisor(env), "integrations", "nuevo-supervisor"), { seed: true }));
      await assertFails(setDoc(doc(asOperator(env), "integrations", "nuevo-operator"), { seed: true }));
    });
  });
});
