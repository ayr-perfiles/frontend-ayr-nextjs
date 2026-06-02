import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { ALL_SECRETS } from "../config/secrets";
import { getIntegrationConfig, SunatEmisionConfig } from "../config/integrations";
import { buildInvoiceXml } from "./xmlGenerator";
import { signXml } from "./xmlSigner";
import { sendInvoiceToSunat, sendSummaryToSunat, getStatusFromSunat } from "./apiSunat";
import { generateInvoicePdf } from "./pdfGenerator";
import { getNextSequence } from "../services/correlative";
import { buildVoidXml } from "./xmlVoidGenerator";

/**
 * Emite un comprobante a SUNAT para una venta específica
 */
export const emitirComprobante = onCall({ secrets: ALL_SECRETS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { saleId } = request.data;
  if (!saleId) {
    throw new HttpsError("invalid-argument", "El saleId es requerido");
  }

  const db = admin.firestore();
  const saleRef = db.collection("sales").doc(saleId);
  const saleSnap = await saleRef.get();

  if (!saleSnap.exists) {
    throw new HttpsError("not-found", "Venta no encontrada");
  }

  const saleData = saleSnap.data()!;
  const currentStatus = saleData.sunat?.estado;

  // ── GUARDIA DE ESTADO (QUEMADOS vs REENVIABLES) ──
  
  if (currentStatus === "ACEPTADO") {
    await db.collection("audit_logs").add({
      action: "EMIT_BLOCKED_BURNED",
      saleId,
      estadoActual: currentStatus,
      motivo: "Comprobante ya emitido y aceptado (número quemado).",
      userId: request.auth.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new HttpsError("already-exists", "Comprobante ya emitido y aceptado (número quemado). Genera un comprobante nuevo o emite Nota de Crédito.");
  }

  if (currentStatus === "BAJA_ACEPTADA" || currentStatus === "ANULADO") {
    await db.collection("audit_logs").add({
      action: "EMIT_BLOCKED_BURNED",
      saleId,
      estadoActual: currentStatus,
      motivo: "Número anulado en SUNAT (quemado).",
      userId: request.auth.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new HttpsError("failed-precondition", "Número anulado en SUNAT (quemado). La nueva venta debe tomar un correlativo nuevo.");
  }

  if (currentStatus === "PENDIENTE") {
    throw new HttpsError("unavailable", "Comprobante en proceso, consulta su estado antes de reintentar.");
  }

  try {
    const sunatConfig = await getIntegrationConfig<SunatEmisionConfig>("sunat-emision");
    if (!sunatConfig.enabled) {
      throw new Error("La integración con SUNAT está desactivada");
    }

    // Determinar tipo de documento (01 Factura, 03 Boleta)
    const documentType = saleData.customerDocument?.length === 11 ? "01" : "03";
    
    let serie: string;
    let correlativo: number;

    // REUSAR CORRELATIVO SI FUE RECHAZADO
    if (currentStatus === "RECHAZADO" && saleData.sunat?.serie && saleData.sunat?.correlativo) {
      serie = saleData.sunat.serie;
      correlativo = saleData.sunat.correlativo;
      console.log(`Reusando correlativo rechazado: ${serie}-${correlativo} para venta ${saleId}`);
    } else {
      // Obtener correlativo de forma atómica (NUEVO)
      serie = documentType === "01" ? sunatConfig.config.series.factura : sunatConfig.config.series.boleta;
      correlativo = await getNextSequence(serie);
    }

    const documentId = `${serie}-${correlativo}`;

    // Marcar como PENDIENTE antes de iniciar proceso largo para evitar race conditions
    await saleRef.update({
      "sunat.estado": "PENDIENTE",
      "sunat.mensajeSunat": "Procesando envío a SUNAT...",
      "sunat.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
    });

    const saleInfo = {
      ...saleData,
      documentId,
      documentType,
      issueDate: new Date().toISOString().split("T")[0],
      items: saleData.items || [],
      customerName: saleData.customerName || "CLIENTE VARIOS",
      customerDocument: saleData.customerDocument || "00000000",
    };

    // 1. Generar XML
    const xmlRaw = buildInvoiceXml(saleInfo, sunatConfig.config);

    // 2. Firmar XML
    const xmlSigned = signXml(xmlRaw);

    // 3. Enviar a SUNAT
    const fileName = `${sunatConfig.config.ruc}-${documentType}-${documentId}`;
    const cdrZipBase64 = await sendInvoiceToSunat(fileName, xmlSigned, sunatConfig);

    // 4. Generar PDF
    const pdfBuffer = await generateInvoicePdf(saleInfo, xmlSigned, sunatConfig.config);

    // 5. Extraer Hash (DigestValue)
    const hashMatch = xmlSigned.match(/<ds:DigestValue>(.*?)<\/ds:DigestValue>/);
    const hash = hashMatch ? hashMatch[1] : "";

    // 6. Subir a Storage
    const bucket = admin.storage().bucket();
    const folder = `sunat/${sunatConfig.config.ruc}/${documentType}/${documentId}`;

    const xmlPath = `${folder}/${fileName}.xml`;
    const cdrPath = `${folder}/R-${fileName}.zip`;
    const pdfPath = `${folder}/${fileName}.pdf`;

    await Promise.all([
      bucket.file(xmlPath).save(xmlSigned, { contentType: "text/xml" }),
      bucket.file(cdrPath).save(Buffer.from(cdrZipBase64, "base64"), { contentType: "application/zip" }),
      bucket.file(pdfPath).save(pdfBuffer, { contentType: "application/pdf" }),
    ]);

    // 7. Actualizar Venta
    const sunatUpdate = {
      sunat: {
        tipoDoc: documentType,
        serie,
        correlativo,
        documentId,
        estado: "ACEPTADO",
        xmlPath,
        cdrPath,
        pdfPath,
        hash,
        mensajeSunat: "Comprobante aceptado por SUNAT",
        emittedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    };

    await saleRef.update(sunatUpdate);

    // 8. Audit Log
    await db.collection("audit_logs").add({
      action: "EMIT_COMPROBANTE",
      entityId: saleId,
      userEmail: request.auth.token.email || "unknown",
      details: `Comprobante ${documentId} emitido exitosamente.`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, documentId, sunat: sunatUpdate.sunat };
  } catch (error: any) {
    console.error("Error en emitirComprobante:", error);

    // Registrar error en la venta si es posible
    await saleRef.update({
      "sunat.estado": "RECHAZADO",
      "sunat.mensajeSunat": error.message || "Error desconocido en emisión",
    }).catch(() => {});

    await db.collection("audit_logs").add({
      action: "EMIT_COMPROBANTE_ERROR",
      entityId: saleId,
      userEmail: request.auth.token.email || "unknown",
      details: `Error al emitir: ${error.message}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw new HttpsError("internal", error.message || "Error al procesar con SUNAT");
  }
});

/**
 * Comunica la baja (anulación) de un comprobante ante SUNAT
 */
export const comunicarBaja = onCall({ secrets: ALL_SECRETS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { saleId, motivo } = request.data;
  if (!saleId || !motivo) {
    throw new HttpsError("invalid-argument", "saleId y motivo son requeridos");
  }

  const db = admin.firestore();
  const saleRef = db.collection("sales").doc(saleId);
  const saleSnap = await saleRef.get();

  if (!saleSnap.exists) {
    throw new HttpsError("not-found", "Venta no encontrada");
  }

  const saleData = saleSnap.data()!;

  if (saleData.sunat?.estado !== "ACEPTADO") {
    throw new HttpsError("failed-precondition", "Solo se pueden anular comprobantes ACEPTADOS por SUNAT");
  }

  try {
    const sunatConfig = await getIntegrationConfig<SunatEmisionConfig>("sunat-emision");

    // Identificador de baja RA-YYYYMMDD-Correlativo
    const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const bajaSerie = `RA-${todayStr}`;
    const bajaCorrelativo = await getNextSequence(bajaSerie);
    const identifierBaja = `${bajaSerie}-${bajaCorrelativo}`;

    const bajaInfo = {
      identifierBaja,
      originalDocumentId: saleData.sunat.documentId,
      originalDocumentType: saleData.sunat.tipoDoc,
      originalIssueDate: saleData.sunat.emittedAt.toDate().toISOString().split("T")[0],
      voidIssueDate: new Date().toISOString().split("T")[0],
      voidReason: motivo,
    };

    // 1. Generar XML de Baja
    const xmlRaw = buildVoidXml(bajaInfo, sunatConfig.config);

    // 2. Firmar XML
    const xmlSigned = signXml(xmlRaw);

    // 3. Enviar a SUNAT (sendSummary devuelve un ticket)
    const fileName = `${sunatConfig.config.ruc}-${identifierBaja}`;
    const ticket = await sendSummaryToSunat(fileName, xmlSigned, sunatConfig);

    // 4. Actualizar estado de la venta
    await saleRef.update({
      "sunat.estado": "BAJA_PENDIENTE",
      "sunat.ticketBaja": ticket,
      "sunat.motivoBaja": motivo,
      status: "VOIDED", // Anulación interna también
    });

    await db.collection("audit_logs").add({
      action: "VOID_COMPROBANTE",
      entityId: saleId,
      userEmail: request.auth.token.email || "unknown",
      details: `Comunicación de baja enviada. Ticket: ${ticket}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, ticket };
  } catch (error: any) {
    console.error("Error en comunicarBaja:", error);
    throw new HttpsError("internal", error.message || "Error al comunicar la baja");
  }
});

/**
 * Consulta el estado de un ticket de baja
 */
export const consultarEstadoBaja = onCall({ secrets: ALL_SECRETS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { ticket, saleId } = request.data;
  if (!ticket || !saleId) {
    throw new HttpsError("invalid-argument", "ticket y saleId son requeridos");
  }

  try {
    const sunatConfig = await getIntegrationConfig<SunatEmisionConfig>("sunat-emision");
    const { statusCode, cdrZipBase64 } = await getStatusFromSunat(ticket, sunatConfig);

    if (statusCode === "0") {
      // Éxito: La baja fue procesada y aceptada
      const db = admin.firestore();
      const saleRef = db.collection("sales").doc(saleId);

      await saleRef.update({
        "sunat.estado": "BAJA_ACEPTADA",
        "sunat.mensajeSunat": "Baja aceptada por SUNAT",
      });

      // Si hay CDR, podríamos guardarlo también
      if (cdrZipBase64) {
        const bucket = admin.storage().bucket();
        const cdrPath = `sunat/${sunatConfig.config.ruc}/BAJAS/R-${ticket}.zip`;
        await bucket.file(cdrPath).save(Buffer.from(cdrZipBase64, "base64"), { contentType: "application/zip" });
        await saleRef.update({ "sunat.cdrBajaPath": cdrPath });
      }

      return { success: true, estado: "BAJA_ACEPTADA" };
    } else if (statusCode === "98") {
      return { success: true, estado: "EN_PROCESO" };
    } else {
      return { success: false, estado: "RECHAZADO", statusCode };
    }
  } catch (error: any) {
    console.error("Error en consultarEstadoBaja:", error);
    throw new HttpsError("internal", error.message || "Error al consultar estado");
  }
});
