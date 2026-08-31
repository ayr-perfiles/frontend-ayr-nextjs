import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { makeRulesEnv, asAdmin } from "./helpers/rulesEnv";
import { buildQuotationDoc } from "@/core/sales/domain/saleDocBuilder";

/**
 * [QUOTATION-APPROVE-UNREACHABLE] (COLA #1) — U0, el GATE del frente.
 *
 * El diseño acordado con el dueño es un par de campos ADITIVOS
 * (`clientAccepted` + `clientAcceptedAt`) sobre el doc de cotización, dejando
 * `status` INTACTO. Todo ese diseño cuelga de una sola premisa sobre
 * `firestore.rules:101-104` (coordenada RE-VERIFICADA en esta tanda):
 *
 *   allow update: if canWrite()
 *     && fieldsUnchanged(['totalAmount','subtotal','igv','exchangeRate','currency','items','paymentType'])
 *     && !(request.resource.data.get('status','') == 'VOIDED' && resource.data.get('status','') != 'VOIDED')
 *     && !(resource.data.get('status','') == 'VOIDED');
 *
 * La Tanda 6 (T0.5) DERIVÓ por lectura que agregar una clave nueva pasa ese
 * guard, porque `fieldsUnchanged` es un denylist de 7 campos y no un allowlist
 * de claves permitidas. Una derivación no es una medición: este archivo la mide.
 *
 * FIXTURE CON EL BUILDER REAL (`buildQuotationDoc`), no a mano — B19. No es
 * cosmético acá: el doc que produce el builder **no tiene** 5 de los 7 campos
 * protegidos (`subtotal`, `igv`, `exchangeRate`, `currency`, `paymentType` NO
 * están en `CanonicalSaleDoc`; solo `totalAmount` e `items`). Un fixture a mano
 * que los incluyera estaría midiendo una forma de doc que producción no escribe.
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeRulesEnv("demo-rules-client-accepted");
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const QUOTE_ID = "C-000900";

/** Cotización NATIVA en `QUOTATION`, con la forma REAL que escribe `createQuotation`. */
function realQuotationDoc() {
  return buildQuotationDoc(
    {
      status: "QUOTATION",
      customerName: "CLIENTE RULES TEST",
      customerDocument: "20600000001",
      documentNumber: "",
      sellerId: "u-admin",
      items: [
        {
          sku: "COB030ROJO",
          productName: "COBERTURA ALUZINC 0.30MM ROJO",
          quantity: 100,
          unitPrice: 12,
          unitValue: 10.169,
          baseCost: 0,
          businessLine: "metallic-roofing",
          unitOfMeasure: "METRO LINEAL",
          isCoil: false,
        },
      ],
    },
    Timestamp.fromDate(new Date("2026-08-31T12:00:00.000Z")),
  );
}

async function seedQuotation(): Promise<void> {
  await env.withSecurityRulesDisabled(async (god) => {
    await setDoc(doc(god.firestore(), "sales", QUOTE_ID), realQuotationDoc());
  });
}

describe("firestore.rules — campos aditivos de aceptación del cliente sobre `sales`", () => {
  describe("U0.1 — el par aditivo PASA el guard de campos financieros", () => {
    it("agregar clientAccepted + clientAcceptedAt, sin tocar ningún campo existente, PASA", async () => {
      await seedQuotation();
      await assertSucceeds(
        updateDoc(doc(asAdmin(env), "sales", QUOTE_ID), {
          clientAccepted: true,
          clientAcceptedAt: serverTimestamp(),
        }),
      );
    });
  });

  describe("U0.2 — control negativo: el guard SIGUE rechazando lo que debe", () => {
    // Sin este bloque, U0.1 sería igual de compatible con "las rules no validan
    // nada" — mismo criterio que el GRUPO K de sales.rules.test.ts (v6.64.0).
    it("modificar un campo financiero EXISTENTE (totalAmount) sigue RECHAZANDO", async () => {
      await seedQuotation();
      await assertFails(
        updateDoc(doc(asAdmin(env), "sales", QUOTE_ID), { totalAmount: 999999 }),
      );
    });

    // El par discriminante exacto: `subtotal` es una clave que el builder real NO
    // escribe, igual que `clientAccepted`. La única diferencia entre las 2 es el
    // NOMBRE. Si esta pasara, el guard no estaría discriminando por nombre y U0.1
    // estaría pasando por el motivo equivocado ("agregar claves siempre se puede").
    it("AGREGAR un campo financiero que el doc no tenía (subtotal) también RECHAZA", async () => {
      await seedQuotation();
      await assertFails(
        updateDoc(doc(asAdmin(env), "sales", QUOTE_ID), { subtotal: 1000 }),
      );
    });

    it("el par aditivo NO habilita colar un financiero en el mismo update", async () => {
      await seedQuotation();
      await assertFails(
        updateDoc(doc(asAdmin(env), "sales", QUOTE_ID), {
          clientAccepted: true,
          clientAcceptedAt: serverTimestamp(),
          totalAmount: 1,
        }),
      );
    });
  });
});
