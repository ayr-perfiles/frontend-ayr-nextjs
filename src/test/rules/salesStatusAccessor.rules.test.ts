import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

// TANDA A RED — 2026-08-26. Ancla la deuda [SALES-STATUS-ACCESSOR] (CLAUDE.md
// v6.66.0/v6.68.0): `sales.update` referencia `resource.data.status` /
// `request.resource.data.status` SIN accessor seguro. Un doc de `sales` que
// nunca tuvo el campo `status` hace que la evaluación de la rule ABORTE —
// Firestore lo trata como deny — para CUALQUIER rol, ADMIN incluido.
// Mismo harness que salesStatus.rules.test.ts (hermano), NO se inventa uno nuevo.
//
// firestore.rules NO se toca en esta tanda. Los tests R1/R2 están escritos
// para fallar HOY (assertSucceeds/assertFails sobre un comportamiento que la
// rule de hoy no da) — es RED, no GREEN.

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-rules-sales-status-accessor",
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, "../../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function fullSaleFields() {
  return {
    customerName: "Cliente Test",
    totalAmount: 1180,
    subtotal: 1000,
    igv: 180,
    exchangeRate: 3.75,
    currency: "PEN",
    items: [{ sku: "TEST-SKU", quantity: 2, unitPrice: 500 }],
    paymentType: "CONTADO",
  };
}

describe("firestore.rules — [SALES-STATUS-ACCESSOR] (v6.66.0/v6.68.0, TANDA A RED)", () => {
  it("R0 — CONTROL: doc CON status, ADMIN edita campo benigno -> assertSucceeds", async () => {
    const staffDb = testEnv.authenticatedContext("staff-r0", { role: "ADMIN" }).firestore();
    // Sembrado vía bypass (withSecurityRulesDisabled): el seed no debe pasar por la
    // rule de `create` bajo prueba — solo el `updateDoc` de abajo se mide contra ella.
    await testEnv.withSecurityRulesDisabled(async (god) => {
      await setDoc(doc(god.firestore(), "sales", "V-ctrl-1"), {
        status: "COMPLETED",
        ...fullSaleFields(),
      });
    });

    await assertSucceeds(updateDoc(doc(staffDb, "sales", "V-ctrl-1"), { customerName: "OTRO NOMBRE" }));
  });

  it("R1 — ROJO ESPERADO: doc SIN status, mismo update benigno -> assertSucceeds (HOY debe fallar)", async () => {
    const staffDb = testEnv.authenticatedContext("staff-r1", { role: "ADMIN" }).firestore();
    // Idéntico a R0 salvo por la AUSENCIA del campo `status` — ese es el único delta.
    // Sembrado vía bypass por la misma razón que R0: el seed no debe chocar con la
    // rule de `create` (que exige `status`) — lo que se mide acá es el `update`.
    await testEnv.withSecurityRulesDisabled(async (god) => {
      await setDoc(doc(god.firestore(), "sales", "V-nostatus-1"), {
        ...fullSaleFields(),
      });
    });

    await assertSucceeds(updateDoc(doc(staffDb, "sales", "V-nostatus-1"), { customerName: "OTRO NOMBRE" }));
  });

  it("R2 — ROJO ESPERADO: ADMIN crea doc SIN status -> assertFails (HOY la rule lo permite)", async () => {
    const staffDb = testEnv.authenticatedContext("staff-r2", { role: "ADMIN" }).firestore();
    await assertFails(
      setDoc(doc(staffDb, "sales", "V-create-nostatus-1"), {
        ...fullSaleFields(),
      }),
    );
  });

  describe("R3b — medición documental (R3a dio NO: helpers ya seguros por diseño)", () => {
    it("R3b(a) — claim role BOGUS, update benigno sobre doc CON status -> assertFails", async () => {
      const bogusDb = testEnv.authenticatedContext("bogus-r3a", { role: "BOGUS" }).firestore();
      await testEnv.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "sales", "V-r3a-1"), {
          status: "COMPLETED",
          ...fullSaleFields(),
        });
      });

      await assertFails(updateDoc(doc(bogusDb, "sales", "V-r3a-1"), { customerName: "OTRO" }));
    });

    it("R3b(b) — SIN claim role (token sin el campo), update benigno sobre doc CON status -> assertFails", async () => {
      const noRoleDb = testEnv.authenticatedContext("norole-r3b", {}).firestore();
      await testEnv.withSecurityRulesDisabled(async (god) => {
        await setDoc(doc(god.firestore(), "sales", "V-r3b-1"), {
          status: "COMPLETED",
          ...fullSaleFields(),
        });
      });

      await assertFails(updateDoc(doc(noRoleDb, "sales", "V-r3b-1"), { customerName: "OTRO" }));
    });
  });
});
