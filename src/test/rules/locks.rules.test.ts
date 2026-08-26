import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { makeRulesEnv, asAdmin, asSupervisor, asOperator } from "./helpers/rulesEnv";

// Cobertura de los 3 candados duros de firestore.rules: colecciones append-only
// (create sí, update/delete nunca — ni ADMIN), audit_logs (append-only con read
// restringido a ADMIN, molde propio, no encaja en el de append-only genérico), y
// write:false/server-only (lectura de staff, escritura de nadie o de nadie salvo
// el Admin SDK, que bypassea rules por diseño). Aislado con su propio projectId.

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeRulesEnv("demo-rules-locks");
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

describe("firestore.rules — locks (append-only + write:false + server-only)", () => {
  describe("GRUPO F — append-only (create SI, update/delete NO, para NINGUN rol)", () => {
    // El kardex es partida doble append-only y ningun consumidor filtra por voided:
    // una correccion via update seria SILENCIOSA e indetectable. update/delete deben
    // fallar para los 3 roles, ADMIN incluido. Si alguno se pone verde al reves, es P0.
    const APPEND_ONLY = [
      "kardex_movements",
      "strips_movements",
      "metallic_roofing_stock_movements",
      "roofing_stock_movements",
      "trading_stock_movements",
      "services_stock_movements",
    ];

    // ANCLA VOLTEADA (2026-08-26, decisión del dueño / canWrite()): create era
    // isStaff() (los 3 roles), ahora es canWrite() (ADMIN+SUPERVISOR) — OPERATOR
    // deja de crear movimientos append-only. read sigue isStaff() (sin cambio);
    // update/delete siguen `if false` para TODOS, ADMIN incluido (sin cambio).
    // Ver TANDA 2, GRUPO 5 de operatorWrites.rules.test.ts.
    it.each(APPEND_ONLY)(
      "%s: get SUCCEEDS los 3, create SUCCEEDS solo ADMIN/SUPERVISOR, update/delete FAILS para los 3",
      async (col) => {
        for (const role of ROLES) {
          await env.withSecurityRulesDisabled(async (god) => {
            await setDoc(doc(god.firestore(), col, "seeded"), { seed: true });
          });
          const db = role.dbFn(env);
          await assertSucceeds(getDoc(doc(db, col, "seeded")));
          if (role.label === "OPERATOR") {
            await assertFails(setDoc(doc(db, col, `nuevo-${role.label}`), { seed: true }));
          } else {
            await assertSucceeds(setDoc(doc(db, col, `nuevo-${role.label}`), { seed: true }));
          }
          await assertFails(updateDoc(doc(db, col, "seeded"), { probe: 1 }));
          await assertFails(deleteDoc(doc(db, col, "seeded")));
        }
      },
    );
  });

  describe("GRUPO G — audit_logs (append-only con read restringido)", () => {
    it("audit_logs: solo ADMIN lee", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "audit_logs", "seeded"), { seed: true });
      });
      await assertSucceeds(getDoc(doc(asAdmin(env), "audit_logs", "seeded")));
    });

    it("audit_logs: SUPERVISOR y OPERATOR no leen", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "audit_logs", "seeded"), { seed: true });
      });
      await assertFails(getDoc(doc(asSupervisor(env), "audit_logs", "seeded")));
      await assertFails(getDoc(doc(asOperator(env), "audit_logs", "seeded")));
    });

    // ANCLA VOLTEADA (2026-08-26, decisión del dueño / canWrite()): create pasó de
    // isStaff() a canWrite() — OPERATOR ya no escribe audit_logs directo desde el
    // cliente (los triggers/callables del backend siguen vía Admin SDK, que
    // bypassea rules). Ver TANDA 2, GRUPO 5.
    it("ADMIN y SUPERVISOR crean audit_logs, OPERATOR no", async () => {
      await assertSucceeds(setDoc(doc(asAdmin(env), "audit_logs", "nuevo-ADMIN"), { seed: true }));
      await assertSucceeds(setDoc(doc(asSupervisor(env), "audit_logs", "nuevo-SUPERVISOR"), { seed: true }));
      await assertFails(setDoc(doc(asOperator(env), "audit_logs", "nuevo-OPERATOR"), { seed: true }));
    });

    it("audit_logs: nadie modifica ni borra", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "audit_logs", "seeded"), { seed: true });
      });
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertFails(updateDoc(doc(db, "audit_logs", "seeded"), { probe: 1 }));
        await assertFails(deleteDoc(doc(db, "audit_logs", "seeded")));
      }
    });
  });

  describe("GRUPO H — write:false (lectura staff, escritura de nadie)", () => {
    const READ_ONLY = ["scrap_logs", "counters", "sunatCounters", "_noop_stock"];

    it.each(READ_ONLY)(
      "%s: get SUCCEEDS, create/update/delete FAILS para ADMIN/SUPERVISOR/OPERATOR",
      async (col) => {
        for (const role of ROLES) {
          await env.withSecurityRulesDisabled(async (god) => {
            await setDoc(doc(god.firestore(), col, "seeded"), { seed: true });
          });
          const db = role.dbFn(env);
          await assertSucceeds(getDoc(doc(db, col, "seeded")));
          await assertFails(setDoc(doc(db, col, "nuevo"), { seed: true }));
          await assertFails(updateDoc(doc(db, col, "seeded"), { probe: 1 }));
          await assertFails(deleteDoc(doc(db, col, "seeded")));
        }
      },
    );
  });

  describe("GRUPO I — server-only (ni ADMIN entra)", () => {
    // idempotency_keys es 100% backend (admin SDK saltea rules). Que ADMIN tampoco
    // pueda LEER es deliberado: cerrado por default, no por olvido.
    it("idempotency_keys: ADMIN no tiene NINGUN acceso", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "idempotency_keys", "seeded"), { seed: true });
      });

      const admin = asAdmin(env);
      await assertFails(getDoc(doc(admin, "idempotency_keys", "seeded")));
      await assertFails(setDoc(doc(admin, "idempotency_keys", "nuevo"), { seed: true }));
      await assertFails(updateDoc(doc(admin, "idempotency_keys", "seeded"), { probe: 1 }));
      await assertFails(deleteDoc(doc(admin, "idempotency_keys", "seeded")));
    });

    it("idempotency_keys: SUPERVISOR y OPERATOR tampoco leen", async () => {
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "idempotency_keys", "seeded"), { seed: true });
      });

      await assertFails(getDoc(doc(asSupervisor(env), "idempotency_keys", "seeded")));
      await assertFails(getDoc(doc(asOperator(env), "idempotency_keys", "seeded")));
    });
  });
});
