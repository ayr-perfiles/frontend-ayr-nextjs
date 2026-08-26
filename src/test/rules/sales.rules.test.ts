import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { makeRulesEnv, asAdmin, asSupervisor, asOperator } from "./helpers/rulesEnv";

// Cobertura de `sales` MAS ALLA de la transicion de status (eso ya lo cubre
// salesStatus.rules.test.ts, hermano de este archivo — NO se duplica acá:
// bloqueo de VOIDED, CONVERTED/CANCELLED permitidos, doc VOIDED terminal).
// Este archivo cubre: el blindaje de campos financieros (fieldsUnchanged),
// create/read/delete, y la subcoleccion history. Aislado con su propio projectId.

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeRulesEnv("demo-rules-sales");
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

describe("firestore.rules — sales (campos financieros + create/read/delete + history)", () => {
  describe("GRUPO J — campos financieros blindados", () => {
    // Este es el candado que obliga a que la edicion del carrito pase por callable
    // (editQuotation, v6.53.0). Existe desde entonces SIN UN SOLO TEST. Si alguno de
    // estos se pone verde al reves, el vector de manipulacion de totales esta abierto.
    const FINANCIEROS = ["totalAmount", "subtotal", "igv", "exchangeRate", "currency", "paymentType"];

    it.each(FINANCIEROS)("nadie edita %s client-side", async (field) => {
      await seedSale("V-1");
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertFails(updateDoc(doc(db, "sales", "V-1"), { [field]: "MUTADO" }));
      }
    });

    it("nadie edita items client-side", async () => {
      await seedSale("V-1");
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertFails(
          updateDoc(doc(db, "sales", "V-1"), { items: [{ sku: "OTRO", quantity: 99, unitPrice: 1 }] }),
        );
      }
    });
  });

  describe("GRUPO K — campo benigno (control negativo del GRUPO J)", () => {
    it("un campo NO financiero si se puede editar", async () => {
      await seedSale("V-2");
      await assertSucceeds(updateDoc(doc(asAdmin(env), "sales", "V-2"), { customerName: "OTRO" }));
    });
  });

  describe("GRUPO L — create / read / delete", () => {
    it("los 3 roles crean ventas", async () => {
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertSucceeds(setDoc(doc(db, "sales", `nuevo-${role.label}`), baseSale()));
      }
    });

    it("los 3 roles leen ventas", async () => {
      await seedSale("V-3");
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertSucceeds(getDoc(doc(db, "sales", "V-3")));
      }
    });

    it("solo ADMIN borra ventas", async () => {
      await seedSale("V-4");
      await assertSucceeds(deleteDoc(doc(asAdmin(env), "sales", "V-4")));
    });

    it("SUPERVISOR y OPERATOR no borran", async () => {
      await seedSale("V-5");
      await assertFails(deleteDoc(doc(asSupervisor(env), "sales", "V-5")));
      await assertFails(deleteDoc(doc(asOperator(env), "sales", "V-5")));
    });
  });

  describe("GRUPO M — subcoleccion history", () => {
    // history es AA para todo staff, sin guard de campos. El recon no encontro
    // escritores reales. Se ancla el comportamiento MEDIDO, no el deseable:
    // si resulta no tener consumidores, la decision de cerrarla es otro frente.
    it("los 3 roles leen history", async () => {
      await seedSale("V-6");
      await env.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "sales", "V-6", "history", "h1"), { seed: true });
      });
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertSucceeds(getDoc(doc(db, "sales", "V-6", "history", "h1")));
      }
    });

    it("los 3 roles crean history", async () => {
      await seedSale("V-7");
      for (const role of ROLES) {
        const db = role.dbFn(env);
        await assertSucceeds(setDoc(doc(db, "sales", "V-7", "history", `h-${role.label}`), { seed: true }));
      }
    });
  });
});
