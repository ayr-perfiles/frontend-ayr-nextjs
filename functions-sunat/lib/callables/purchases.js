"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPurchaseStaging = exports.parsePurchaseXml = exports.importSireRce = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const secrets_1 = require("../config/secrets");
const jszip_1 = __importDefault(require("jszip"));
const purchaseXmlParser_1 = require("../services/purchaseXmlParser");
/**
 * Schema oficial actual de SUNAT para RCE (basado en índices 0-based si no hay cabeceras)
 */
const DEFAULT_RCE_MAPPING = {
    periodo: 0,
    car: 1,
    fechaEmision: 2,
    tipoCp: 4,
    serie: 5,
    numero: 6,
    rucProveedor: 8,
    razonSocialProveedor: 9,
    baseGravada: 10,
    igv: 11,
    total: 12,
    moneda: 13,
    tipoCambio: 14,
};
/**
 * Callable para importar masivamente el RCE de SIRE (SUNAT)
 */
exports.importSireRce = (0, https_1.onCall)({ secrets: secrets_1.ALL_SECRETS }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Usuario no autenticado");
    }
    const { content, fileName, mapping = DEFAULT_RCE_MAPPING } = request.data;
    if (!content) {
        throw new https_1.HttpsError("invalid-argument", "El contenido del archivo es requerido");
    }
    // Detectar delimitador (SUNAT suele usar | en TXT y ,/; en CSV)
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return { success: true, count: 0, report: [] };
    const firstLine = lines[0];
    let delimiter = "|";
    if (firstLine.includes(";"))
        delimiter = ";";
    else if (firstLine.includes(",") && !firstLine.includes("|"))
        delimiter = ",";
    const db = admin.firestore();
    const results = {
        nuevos: 0,
        reconciliados: 0,
        discrepancias: 0,
        omitidos: 0,
        detalles: [],
    };
    // Procesar en chunks para evitar límites de tiempo/memoria
    const CHUNK_SIZE = 50;
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
        const chunk = lines.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (line) => {
            const columns = line.split(delimiter).map((c) => c.trim());
            // Omitir si es una línea de cabecera o vacía
            if (columns[mapping.rucProveedor] === "RUC" || isNaN(Number(columns[mapping.rucProveedor]))) {
                results.omitidos++;
                return;
            }
            try {
                const data = parseSireRow(columns, mapping);
                const purchaseId = `${data.rucProveedor}_${data.serie}-${data.numero}`;
                const purchaseRef = db.collection("purchases").doc(purchaseId);
                await db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(purchaseRef);
                    const now = admin.firestore.FieldValue.serverTimestamp();
                    if (!doc.exists) {
                        // Caso 1: Compra Nueva (desde SIRE)
                        transaction.set(purchaseRef, {
                            supplier: { ruc: data.rucProveedor, name: data.razonSocialProveedor },
                            businessLine: "trading", // Por defecto
                            invoice: {
                                number: `${data.serie}-${data.numero}`,
                                date: admin.firestore.Timestamp.fromDate(data.fechaEmision),
                                currency: data.moneda,
                                exchangeRate: data.tipoCambio,
                                gravada: data.baseGravada,
                                igv: data.igv,
                                total: data.total,
                            },
                            items: [],
                            totalCostPEN: data.moneda === "USD" ? data.baseGravada * data.tipoCambio : data.baseGravada,
                            status: "REGISTRADA",
                            origin: "SIRE",
                            CAR: data.car,
                            stockPendiente: true,
                            validacionSunat: {
                                valido: true,
                                estadoCp: "ACEPTADO",
                                estadoRuc: "ACTIVO",
                                condDomiRuc: "HABIDO",
                                fecha: now,
                                origen: "SIRE",
                            },
                            createdAt: now,
                            createdBy: request.auth?.token.email || "sistema",
                        });
                        results.nuevos++;
                    }
                    else {
                        // Caso 2: Reconciliación
                        const existing = doc.data();
                        const discrepancias = {};
                        if (Math.abs(existing.invoice.gravada - data.baseGravada) > 0.01)
                            discrepancias.baseImponible = data.baseGravada;
                        if (Math.abs(existing.invoice.total - data.total) > 0.01)
                            discrepancias.total = data.total;
                        const hasDiscrepancy = Object.keys(discrepancias).length > 0;
                        transaction.update(purchaseRef, {
                            CAR: data.car,
                            validacionSunat: {
                                valido: true,
                                estadoCp: "ACEPTADO",
                                estadoRuc: "ACTIVO",
                                condDomiRuc: "HABIDO",
                                fecha: now,
                                origen: "SIRE",
                            },
                            ...(hasDiscrepancy ? { discrepancias } : {}),
                        });
                        if (hasDiscrepancy)
                            results.discrepancias++;
                        else
                            results.reconciliados++;
                    }
                });
            }
            catch (err) {
                console.error("Error procesando línea SIRE:", err, line);
                results.omitidos++;
            }
        }));
    }
    // Audit Log
    await db.collection("audit_logs").add({
        action: "IMPORT_SIRE_RCE",
        entityId: fileName || "batch_import",
        userEmail: request.auth.token.email || "unknown",
        details: `Importación SIRE finalizada. Nuevos: ${results.nuevos}, Reconciliados: ${results.reconciliados}, Discrepancias: ${results.discrepancias}, Omitidos: ${results.omitidos}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, results };
});
/**
 * Parsea uno o varios XML de compra (pueden venir en un ZIP o como string)
 */
exports.parsePurchaseXml = (0, https_1.onCall)({ secrets: secrets_1.ALL_SECRETS }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Usuario no autenticado");
    }
    const { xmlStrings, zipBase64 } = request.data;
    const parsedPurchases = [];
    try {
        if (zipBase64) {
            const zip = await jszip_1.default.loadAsync(zipBase64, { base64: true });
            const files = Object.keys(zip.files).filter((name) => name.toLowerCase().endsWith(".xml"));
            for (const fileName of files) {
                const content = await zip.file(fileName)?.async("string");
                if (content) {
                    parsedPurchases.push((0, purchaseXmlParser_1.parseInvoiceXml)(content));
                }
            }
        }
        else if (Array.isArray(xmlStrings)) {
            for (const xml of xmlStrings) {
                parsedPurchases.push((0, purchaseXmlParser_1.parseInvoiceXml)(xml));
            }
        }
        return { success: true, purchases: parsedPurchases };
    }
    catch (error) {
        console.error("Error parseando XMLs:", error);
        throw new https_1.HttpsError("internal", "Error al procesar los archivos XML: " + error.message);
    }
});
/**
 * Confirma el staging de una o varias compras, registrando stock y mapeos.
 */
exports.confirmPurchaseStaging = (0, https_1.onCall)({ secrets: secrets_1.ALL_SECRETS }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Usuario no autenticado");
    }
    const { purchases, businessLine } = request.data;
    if (!Array.isArray(purchases) || purchases.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "No hay compras para confirmar");
    }
    const db = admin.firestore();
    const results = { success: 0, errors: 0, details: [] };
    const LINE_CONFIG = {
        trading: { stock: "trading_stock", movements: "trading_stock_movements", catalog: "trading_catalog" },
        roofing: { stock: "roofing_stock", movements: "roofing_stock_movements", catalog: "roofing_catalog" },
    };
    const config = LINE_CONFIG[businessLine || "trading"];
    for (const p of purchases) {
        try {
            const purchaseId = `${p.rucProveedor}_${p.serie}-${p.numero}`;
            const purchaseRef = db.collection("purchases").doc(purchaseId);
            await db.runTransaction(async (tx) => {
                const pSnap = await tx.get(purchaseRef);
                // Si existe y no es SIRE, saltamos (idempotencia)
                if (pSnap.exists && pSnap.data()?.status === "REGISTRADA" && pSnap.data()?.origin !== "SIRE") {
                    return;
                }
                // 1. Guardar/Actualizar Mapeos Proveedor -> SKU
                for (const item of p.lines) {
                    if (item.sku) {
                        const mapId = `${p.rucProveedor}_${Buffer.from(item.description).toString("hex").substring(0, 50)}`;
                        const mapRef = db.collection("supplier_sku_map").doc(mapId);
                        tx.set(mapRef, {
                            rucProveedor: p.rucProveedor,
                            descripcionProveedor: item.description,
                            skuAYR: item.sku,
                            lastUsed: admin.firestore.FieldValue.serverTimestamp(),
                        }, { merge: true });
                    }
                }
                // 2. Preparar Items para Purchase y Stock
                const purchaseItems = p.lines.map((item) => ({
                    sku: item.sku,
                    productName: item.description,
                    quantity: item.quantity,
                    unitCostPEN: p.moneda === "USD" ? item.unitPrice * p.tipoCambio : item.unitPrice,
                }));
                // 3. Lógica PPP y Stock
                for (const item of purchaseItems) {
                    const stockRef = db.collection(config.stock).doc(item.sku);
                    const catalogRef = db.collection(config.catalog).doc(item.sku);
                    const [sSnap, cSnap] = await Promise.all([tx.get(stockRef), tx.get(catalogRef)]);
                    if (!cSnap.exists)
                        throw new Error(`SKU ${item.sku} no existe en el catálogo.`);
                    const currentQty = sSnap.exists ? (sSnap.data()?.quantity || 0) : 0;
                    const currentAvgCost = sSnap.exists ? (sSnap.data()?.avgCost || 0) : 0;
                    const newQty = currentQty + item.quantity;
                    let newAvgCost = item.unitCostPEN;
                    if (currentQty > 0) {
                        newAvgCost = ((currentQty * currentAvgCost) + (item.quantity * item.unitCostPEN)) / newQty;
                    }
                    newAvgCost = Number(newAvgCost.toFixed(4));
                    tx.set(stockRef, {
                        sku: item.sku,
                        productName: cSnap.data()?.displayName || item.productName,
                        quantity: newQty,
                        avgCost: newAvgCost,
                        totalValue: Number((newQty * newAvgCost).toFixed(2)),
                        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    tx.set(db.collection(config.movements).doc(), {
                        sku: item.sku,
                        type: "ENTRADA",
                        quantity: item.quantity,
                        costPerUnit: item.unitCostPEN,
                        reason: `XML: ${p.razonSocialProveedor} | Fact: ${p.serie}-${p.numero}`,
                        businessLine: businessLine || "trading",
                        createdBy: request.auth?.token.email || "sistema",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    tx.update(catalogRef, { avgCost: newAvgCost, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                }
                // 4. Guardar Compra
                tx.set(purchaseRef, {
                    supplier: { ruc: p.rucProveedor, name: p.razonSocialProveedor },
                    businessLine: businessLine || "trading",
                    invoice: {
                        number: `${p.serie}-${p.numero}`,
                        date: admin.firestore.Timestamp.fromDate(new Date(p.fechaEmision + "T12:00:00")),
                        currency: p.moneda,
                        exchangeRate: p.tipoCambio,
                        gravada: p.baseImponible,
                        igv: p.igv,
                        total: p.total,
                    },
                    items: purchaseItems,
                    totalCostPEN: p.moneda === "USD" ? p.baseImponible * p.tipoCambio : p.baseImponible,
                    status: "REGISTRADA",
                    origin: "XML",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: request.auth?.token.email || "sistema",
                }, { merge: true });
                // Audit Log
                tx.set(db.collection("audit_logs").doc(), {
                    action: "IMPORT_PURCHASE_XML",
                    entityId: purchaseId,
                    userEmail: request.auth?.token.email || "unknown",
                    details: `Importación XML confirmada. Factura ${p.serie}-${p.numero}.`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            results.success++;
        }
        catch (err) {
            console.error("Error confirmando compra XML:", err);
            results.errors++;
            results.details.push(`${p.serie}-${p.numero}: ${err.message}`);
        }
    }
    return { success: true, results };
});
/**
 * Parsea una fila del SIRE según el mapeo proporcionado
 */
function parseSireRow(columns, mapping) {
    const getVal = (field) => {
        if (typeof field === "number")
            return columns[field] || "";
        return "";
    };
    const fechaStr = getVal(mapping.fechaEmision); // DD/MM/YYYY
    const [day, month, year] = fechaStr.split("/").map(Number);
    return {
        periodo: getVal(mapping.periodo),
        car: getVal(mapping.car),
        fechaEmision: new Date(year, month - 1, day),
        tipoCp: getVal(mapping.tipoCp),
        serie: getVal(mapping.serie),
        numero: getVal(mapping.numero),
        rucProveedor: getVal(mapping.rucProveedor),
        razonSocialProveedor: getVal(mapping.razonSocialProveedor),
        baseGravada: parseFloat(getVal(mapping.baseGravada)) || 0,
        igv: parseFloat(getVal(mapping.igv)) || 0,
        total: parseFloat(getVal(mapping.total)) || 0,
        moneda: getVal(mapping.moneda) === "USD" ? "USD" : "PEN",
        tipoCambio: parseFloat(getVal(mapping.tipoCambio)) || 1,
    };
}
//# sourceMappingURL=purchases.js.map