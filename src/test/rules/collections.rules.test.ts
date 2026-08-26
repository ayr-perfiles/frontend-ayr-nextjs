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

    // ANCLA VOLTEADA (2026-08-26, decisión del dueño / canWrite()): create/update
    // eran isStaff() (los 3 roles), ahora son canWrite() (ADMIN+SUPERVISOR). El
    // read sigue siendo isStaff() — OPERATOR sigue leyendo, solo deja de escribir.
    // Ver TANDA 2, GRUPO 1 de operatorWrites.rules.test.ts.
    it.each(STAFF_CRUD)("%s: los 3 leen, ADMIN/SUPERVISOR crean y actualizan, OPERATOR no, ADMIN borra", async (col) => {
      await seed(col);
      for (const role of ROLES) {
        await assertSucceeds(getDoc(doc(role.dbFn(env), col, "seeded")));
      }
      await assertSucceeds(setDoc(doc(asAdmin(env), col, "nuevo-ADMIN"), { seed: true }));
      await assertSucceeds(setDoc(doc(asSupervisor(env), col, "nuevo-SUPERVISOR"), { seed: true }));
      await assertFails(setDoc(doc(asOperator(env), col, "nuevo-OPERATOR"), { seed: true }));
      await assertSucceeds(updateDoc(doc(asAdmin(env), col, "seeded"), { probe: 1 }));
      await assertSucceeds(updateDoc(doc(asSupervisor(env), col, "seeded"), { probe: 2 }));
      await assertFails(updateDoc(doc(asOperator(env), col, "seeded"), { probe: 3 }));
      await assertSucceeds(deleteDoc(doc(asAdmin(env), col, "seeded")));
    });

    it.each(STAFF_CRUD)("%s: solo ADMIN borra", async (col) => {
      await seed(col);
      await assertFails(deleteDoc(doc(asSupervisor(env), col, "seeded")));
      await assertFails(deleteDoc(doc(asOperator(env), col, "seeded")));
    });
  });

  describe("GRUPO T — staff full (delete ahora ADMIN-only)", () => {
    // ANCLA VOLTEADA (2026-08-26, decisión del dueño / canWrite() + delete admin-only):
    // customers/contacts/coil_finishes SÍ tenían delete abierto a los 3 roles (asimetría
    // registrada como deuda vs. coils/sales/production_logs) — el dueño decidió cerrarla
    // por simetría: create/update pasan a canWrite() (ADMIN+SUPERVISOR) y delete pasa a
    // isAdmin() (antes cualquiera de los 3 borraba). Ver TANDA 2, GRUPO 3/4 de
    // operatorWrites.rules.test.ts.
    const STAFF_FULL = ["customers", "contacts", "coil_finishes"];

    it.each(STAFF_FULL)(
      "%s: los 3 leen, ADMIN/SUPERVISOR crean y actualizan, OPERATOR no, solo ADMIN borra",
      async (col) => {
        await seed(col);
        for (const role of ROLES) {
          await assertSucceeds(getDoc(doc(role.dbFn(env), col, "seeded")));
        }
        await assertSucceeds(setDoc(doc(asAdmin(env), col, "nuevo-ADMIN"), { seed: true }));
        await assertSucceeds(setDoc(doc(asSupervisor(env), col, "nuevo-SUPERVISOR"), { seed: true }));
        await assertFails(setDoc(doc(asOperator(env), col, "nuevo-OPERATOR"), { seed: true }));
        await assertSucceeds(updateDoc(doc(asAdmin(env), col, "seeded"), { probe: 1 }));
        await assertSucceeds(updateDoc(doc(asSupervisor(env), col, "seeded"), { probe: 2 }));
        await assertFails(updateDoc(doc(asOperator(env), col, "seeded"), { probe: 3 }));
        await assertFails(deleteDoc(doc(asSupervisor(env), col, "seeded")));
        await assertFails(deleteDoc(doc(asOperator(env), col, "seeded")));
        await assertSucceeds(deleteDoc(doc(asAdmin(env), col, "seeded")));
      },
    );
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
