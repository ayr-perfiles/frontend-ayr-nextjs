import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  makeRulesEnv,
  asAdmin,
  asSupervisor,
  asOperator,
  asNoRole,
  asJunkRole,
  asAnon,
  UID,
} from "./helpers/rulesEnv";

// Cobertura de fundación de firestore.rules: los 6 helpers (isSignedIn/hasRole/
// isAdmin/isStaff/isOwner/fieldsUnchanged) y el catch-all deny-all final. NO
// cubre la lógica de negocio por colección (eso es tanda aparte) — cubre que
// los HELPERS que sostienen a las 35 colecciones discriminan de verdad.
// Aislado de salesStatus.rules.test.ts con su propio projectId (misma rama de
// firestore.rules, cero fixtures compartidas).

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeRulesEnv("demo-rules-foundation");
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe("firestore.rules — foundation (helpers + bordes + catch-all)", () => {
  describe("GRUPO A — isAdmin (colecciones admin-only)", () => {
    it("users: ADMIN get/create/update/delete -> SUCCEEDS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "users", "u-target"), { role: "OPERATOR", isActive: true });
      });
      const db = asAdmin(env);
      await assertSucceeds(getDoc(doc(db, "users", "u-target")));
      await assertSucceeds(setDoc(doc(db, "users", "u-new"), { role: "OPERATOR", isActive: true }));
      await assertSucceeds(updateDoc(doc(db, "users", "u-target"), { displayName: "x" }));
      await assertSucceeds(deleteDoc(doc(db, "users", "u-target")));
    });

    it("users: SUPERVISOR get -> FAILS · OPERATOR get -> FAILS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "users", "u-target"), { role: "OPERATOR", isActive: true });
      });
      await assertFails(getDoc(doc(asSupervisor(env), "users", "u-target")));
      await assertFails(getDoc(doc(asOperator(env), "users", "u-target")));
    });

    it("users: SUPERVISOR create -> FAILS · OPERATOR create -> FAILS", async () => {
      await assertFails(
        setDoc(doc(asSupervisor(env), "users", "u-new-1"), { role: "OPERATOR", isActive: true }),
      );
      await assertFails(
        setDoc(doc(asOperator(env), "users", "u-new-2"), { role: "OPERATOR", isActive: true }),
      );
    });

    it("settings: ADMIN get/create/update/delete -> SUCCEEDS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "settings", "general"), { seed: true });
      });
      const db = asAdmin(env);
      await assertSucceeds(getDoc(doc(db, "settings", "general")));
      await assertSucceeds(setDoc(doc(db, "settings", "new-doc"), { seed: true }));
      await assertSucceeds(updateDoc(doc(db, "settings", "general"), { seed: false }));
      await assertSucceeds(deleteDoc(doc(db, "settings", "general")));
    });

    it("settings: SUPERVISOR get -> FAILS · OPERATOR get -> FAILS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "settings", "general"), { seed: true });
      });
      await assertFails(getDoc(doc(asSupervisor(env), "settings", "general")));
      await assertFails(getDoc(doc(asOperator(env), "settings", "general")));
    });
  });

  describe("GRUPO B — hasRole('SUPERVISOR') discrimina de OPERATOR", () => {
    it("products: SUPERVISOR create -> SUCCEEDS · SUPERVISOR update -> SUCCEEDS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "products", "SKU-1"), { seed: true });
      });
      const db = asSupervisor(env);
      await assertSucceeds(setDoc(doc(db, "products", "SKU-NEW"), { seed: true }));
      await assertSucceeds(updateDoc(doc(db, "products", "SKU-1"), { seed: false }));
    });

    it("products: OPERATOR get -> SUCCEEDS (lee: es staff)", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "products", "SKU-1"), { seed: true });
      });
      await assertSucceeds(getDoc(doc(asOperator(env), "products", "SKU-1")));
    });

    it("products: OPERATOR create -> FAILS · update -> FAILS · delete -> FAILS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "products", "SKU-1"), { seed: true });
      });
      const db = asOperator(env);
      await assertFails(setDoc(doc(db, "products", "SKU-NEW"), { seed: true }));
      await assertFails(updateDoc(doc(db, "products", "SKU-1"), { seed: false }));
      await assertFails(deleteDoc(doc(db, "products", "SKU-1")));
    });

    it("supplier_sku_map: SUPERVISOR create -> SUCCEEDS · OPERATOR create -> FAILS", async () => {
      await assertSucceeds(setDoc(doc(asSupervisor(env), "supplier_sku_map", "MAP-1"), { seed: true }));
      await assertFails(setDoc(doc(asOperator(env), "supplier_sku_map", "MAP-2"), { seed: true }));
    });
  });

  describe("GRUPO C — isOwner + fieldsUnchanged: el guard de escalada", () => {
    // Los 2 SUCCEEDS de aca son DELIBERADOS, no un agujero: leer el propio doc es el
    // bootstrap de AuthContext (sin el nadie descubre su rol), y displayName es
    // justamente el campo que fieldsUnchanged(['role','isActive']) deja pasar.
    // Los 2 FAILS son el candado de escalada. Si alguno se pone verde al reves, es P0.
    const OWNERS = [
      { label: "SIGNED_NO_ROLE", uid: UID.noRole, dbFn: asNoRole },
      { label: "ROL_BASURA", uid: UID.junk, dbFn: asJunkRole },
      { label: "SUPERVISOR", uid: UID.supervisor, dbFn: asSupervisor },
      { label: "OPERATOR", uid: UID.operator, dbFn: asOperator },
    ] as const;

    for (const owner of OWNERS) {
      it(`users/${owner.label} sobre su PROPIO doc: get/upd_benigno SUCCEEDS, upd_role/upd_isActive FAILS`, async () => {
        await env.withSecurityRulesDisabled(async (god) => {
          await setDoc(doc(god.firestore(), "users", owner.uid), { seed: true, role: "X" });
        });
        const db = owner.dbFn(env);
        await assertSucceeds(getDoc(doc(db, "users", owner.uid)));
        await assertSucceeds(updateDoc(doc(db, "users", owner.uid), { displayName: "x" }));
        await assertFails(updateDoc(doc(db, "users", owner.uid), { role: "ADMIN" }));
        await assertFails(updateDoc(doc(db, "users", owner.uid), { isActive: true }));
      });
    }

    it("OPERATOR leyendo el doc de OTRO uid (users/u-admin) -> FAILS", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "users", UID.admin), { seed: true, role: "ADMIN" });
      });
      await assertFails(getDoc(doc(asOperator(env), "users", UID.admin)));
    });
  });

  describe("GRUPO D — ANON no toca nada", () => {
    const COLS = ["users", "settings", "products", "sales", "customers", "coils", "audit_logs", "counters"];

    it.each(COLS)("ANON no lee ni escribe %s", async (col) => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), col, "seeded"), { seed: true });
      });
      const db = asAnon(env);
      await assertFails(getDoc(doc(db, col, "seeded")));
      await assertFails(setDoc(doc(db, col, "nuevo"), { seed: true }));
    });
  });

  describe("GRUPO E — catch-all deny", () => {
    it("ADMIN get/create sobre coleccion_inventada_zzz -> FAILS", async () => {
      const db = asAdmin(env);
      await assertFails(getDoc(doc(db, "coleccion_inventada_zzz", "x")));
      await assertFails(setDoc(doc(db, "coleccion_inventada_zzz", "x"), { a: 1 }));
    });
  });
});
