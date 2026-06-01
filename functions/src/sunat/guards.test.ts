import { describe, it, expect, vi, beforeEach } from "vitest";
import * as admin from "firebase-admin";

// Mocks de firebase-admin
vi.mock("firebase-admin", () => {
  const mockDoc = {
    get: vi.fn(),
    update: vi.fn(),
    collection: vi.fn(),
    set: vi.fn(),
  };
  const mockCollection = {
    doc: vi.fn(() => mockDoc),
    add: vi.fn(),
  };
  mockDoc.collection.mockReturnValue(mockCollection);

  return {
    firestore: Object.assign(() => ({
      collection: vi.fn(() => mockCollection),
    }), {
      FieldValue: {
        serverTimestamp: vi.fn(() => "mock-timestamp"),
      },
    }),
  };
});

// Mock de secrets e integrations
vi.mock("../config/secrets", () => ({ ALL_SECRETS: [] }));
vi.mock("../config/integrations", () => ({
  getIntegrationConfig: vi.fn().mockResolvedValue({
    enabled: true,
    config: {
      ruc: "20612769151",
      series: { factura: "F001", boleta: "B001" }
    }
  }),
}));

// Mock de servicios SUNAT
vi.mock("./apiSunat", () => ({
  sendInvoiceToSunat: vi.fn().mockResolvedValue("mock-cdr-base64"),
  sendSummaryToSunat: vi.fn().mockResolvedValue("mock-ticket"),
}));
vi.mock("./xmlGenerator", () => ({ buildInvoiceXml: vi.fn().mockReturnValue("<xml/>") }));
vi.mock("./xmlSigner", () => ({ signXml: vi.fn().mockReturnValue("<signed-xml/>") }));
vi.mock("./pdfGenerator", () => ({ generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("pdf")) }));
vi.mock("../services/correlative", () => ({ getNextSequence: vi.fn().mockResolvedValue("000001") }));

// Importar los callables (después de los mocks)
import { emitirComprobante, comunicarBaja } from "./callables";

describe("SUNAT Callables Guards", () => {
  const db = admin.firestore();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emitirComprobante", () => {
    const mockRequest = {
      auth: { uid: "user-1", token: { email: "test@ayr.com" } },
      data: { saleId: "sale-1" },
    } as any;

    it("debe BLOQUEAR emisión si el estado es ACEPTADO", async () => {
      const saleSnap = {
        exists: true,
        data: () => ({ sunat: { estado: "ACEPTADO" } }),
      };
      (db.collection("sales").doc("sale-1").get as any).mockResolvedValue(saleSnap);

      await expect(emitirComprobante.run(mockRequest)).rejects.toThrow("Comprobante ya emitido y aceptado");
      
      // Verificar audit log
      expect(db.collection("audit_logs").add).toHaveBeenCalledWith(expect.objectContaining({
        action: "EMIT_BLOCKED_BURNED",
        estadoActual: "ACEPTADO"
      }));
    });

    it("debe BLOQUEAR emisión si el estado es BAJA_ACEPTADA (ANULADO)", async () => {
      const saleSnap = {
        exists: true,
        data: () => ({ sunat: { estado: "BAJA_ACEPTADA" } }),
      };
      (db.collection("sales").doc("sale-1").get as any).mockResolvedValue(saleSnap);

      await expect(emitirComprobante.run(mockRequest)).rejects.toThrow("Número anulado en SUNAT");
    });

    it("debe BLOQUEAR emisión si el estado es PENDIENTE", async () => {
      const saleSnap = {
        exists: true,
        data: () => ({ sunat: { estado: "PENDIENTE" } }),
      };
      (db.collection("sales").doc("sale-1").get as any).mockResolvedValue(saleSnap);

      await expect(emitirComprobante.run(mockRequest)).rejects.toThrow("Comprobante en proceso");
    });

    it("debe PERMITIR reenvío si el estado es RECHAZADO y reusar correlativo", async () => {
      const saleSnap = {
        exists: true,
        data: () => ({ 
          customerDocument: "20123456789",
          sunat: { estado: "RECHAZADO", serie: "F001", correlativo: "000042" } 
        }),
      };
      (db.collection("sales").doc("sale-1").get as any).mockResolvedValue(saleSnap);

      // Mock de bucket/storage para evitar errores en la subida
      const mockFile = { save: vi.fn().mockResolvedValue(undefined) };
      const mockBucket = { file: vi.fn(() => mockFile) };
      (admin as any).storage = () => ({ bucket: () => mockBucket });

      const result = await emitirComprobante.run(mockRequest);
      
      expect(result.success).toBe(true);
      expect(result.documentId).toBe("F001-000042");
      
      // Verificar que NO se llamó a getNextSequence (reúso)
      const { getNextSequence } = await import("../services/correlative");
      expect(getNextSequence).not.toHaveBeenCalled();
    });
  });

  describe("comunicarBaja", () => {
    const mockRequest = {
      auth: { uid: "user-1", token: { email: "test@ayr.com" } },
      data: { saleId: "sale-1", motivo: "Error en datos" },
    } as any;

    it("debe BLOQUEAR baja si el estado NO es ACEPTADO", async () => {
      const saleSnap = {
        exists: true,
        data: () => ({ sunat: { estado: "RECHAZADO" } }),
      };
      (db.collection("sales").doc("sale-1").get as any).mockResolvedValue(saleSnap);

      await expect(comunicarBaja.run(mockRequest)).rejects.toThrow("Solo se pueden anular comprobantes ACEPTADOS");
    });

    it("debe PERMITIR baja si el estado es ACEPTADO", async () => {
      const saleSnap = {
        exists: true,
        data: () => ({ sunat: { estado: "ACEPTADO", documentId: "F001-000001", tipoDoc: "01", emittedAt: { toDate: () => new Date() } } }),
      };
      (db.collection("sales").doc("sale-1").get as any).mockResolvedValue(saleSnap);

      const result = await comunicarBaja.run(mockRequest);
      expect(result.success).toBe(true);
      expect(result.ticket).toBe("mock-ticket");
    });
  });
});
