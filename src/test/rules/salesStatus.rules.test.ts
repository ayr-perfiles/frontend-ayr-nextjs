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

// Primer uso de @firebase/rules-unit-testing en el repo (estaba instalado, sin
// consumidor). Cubre exclusivamente la regla nueva de sales.status (FASE G,
// opción 3: bloqueo quirúrgico de la transición a VOIDED + doc VOIDED terminal),
// no re-testea el resto de firestore.rules.

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-rules-salesstatus",
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

describe("firestore.rules — sales.status (FASE G opción 3)", () => {
  it("cliente ADMIN escribe {status:'VOIDED'} sobre una venta COMPLETED -> assertFails (candado a annulSale)", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1", { role: "ADMIN" }).firestore();
    await setDoc(doc(staffDb, "sales", "V-1"), {
      status: "COMPLETED",
      customerName: "Cliente Test",
      totalAmount: 100,
    });

    await assertFails(updateDoc(doc(staffDb, "sales", "V-1"), { status: "VOIDED" }));
  });

  it("cliente ADMIN escribe {status:'CONVERTED'} sobre una quote QUOTATION -> assertSucceeds (flujo approveQuotation)", async () => {
    const staffDb = testEnv.authenticatedContext("staff-2", { role: "ADMIN" }).firestore();
    await setDoc(doc(staffDb, "sales", "C-1"), {
      status: "QUOTATION",
      customerName: "Cliente Test",
      totalAmount: 50,
    });

    await assertSucceeds(
      updateDoc(doc(staffDb, "sales", "C-1"), { status: "CONVERTED", convertedToId: "V-2" }),
    );
  });

  it("cliente ADMIN escribe {status:'CANCELLED'} sobre una quote QUOTATION -> assertSucceeds (flujo cancelQuotation)", async () => {
    const staffDb = testEnv.authenticatedContext("staff-3", { role: "ADMIN" }).firestore();
    await setDoc(doc(staffDb, "sales", "C-2"), {
      status: "QUOTATION",
      customerName: "Cliente Test",
      totalAmount: 30,
    });

    await assertSucceeds(updateDoc(doc(staffDb, "sales", "C-2"), { status: "CANCELLED" }));
  });

  it("cliente ADMIN intenta tocar CUALQUIER campo de una venta ya VOIDED -> assertFails (terminal, congelada)", async () => {
    const staffDb = testEnv.authenticatedContext("staff-4", { role: "ADMIN" }).firestore();
    await setDoc(doc(staffDb, "sales", "V-3"), {
      status: "VOIDED",
      customerName: "Cliente Test",
      totalAmount: 100,
    });

    // Ni siquiera un campo no-financiero (customerName) — VOIDED es terminal.
    await assertFails(updateDoc(doc(staffDb, "sales", "V-3"), { customerName: "Otro Nombre" }));
    // Reescribir el mismo status VOIDED (no-op) también queda bloqueado.
    await assertFails(updateDoc(doc(staffDb, "sales", "V-3"), { status: "VOIDED" }));
  });

  // Admin SDK (el callable annulSale corre con firebase-admin) bypassea las rules
  // por diseño — no hay caso de rules-unit-testing que lo ejercite; ya está
  // cubierto por functions/src/callables/__tests__/annulSale.integration.test.ts
  // (FASE D) y los smoke tests reales de FASE G (PASO A/H5/H7).
});
