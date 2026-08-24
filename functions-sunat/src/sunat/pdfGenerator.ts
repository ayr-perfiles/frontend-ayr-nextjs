import PDFDocument from "pdfkit";
import QRCode from "qrcode";

/**
 * Extrae el DigestValue (Hash) del XML firmado usando expresiones regulares
 */
function extractDigestValue(signedXml: string): string {
  const match = signedXml.match(/<ds:DigestValue>(.*?)<\/ds:DigestValue>/);
  return match ? match[1] : "";
}

/**
 * Genera el PDF del comprobante en memoria y devuelve un Buffer
 */
export async function generateInvoicePdf(
  saleInfo: any,
  signedXml: string,
  sunatConfig: any,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const { ruc: RUC_EMPRESA, razonSocial: RAZON_SOCIAL, direccionFiscal: DIRECCION_FISCAL } = sunatConfig;
      const digestValue = extractDigestValue(signedXml);

      // --- 1. CABECERA ---
      doc.font("Helvetica-Bold").fontSize(14).text(RAZON_SOCIAL);
      doc.font("Helvetica").fontSize(9).text(DIRECCION_FISCAL);
      doc.text("Perú");

      // Recuadro derecho para el RUC y Tipo de Comprobante
      const tipoCompTexto =
        saleInfo.documentType === "01"
          ? "FACTURA ELECTRÓNICA"
          : "BOLETA DE VENTA ELECTRÓNICA";
      doc.rect(380, 40, 180, 90).stroke();

      doc
        .font("Helvetica-Bold")
        .text(`R.U.C. ${RUC_EMPRESA}`, 390, 55, {
          align: "center",
          width: 160,
        });
      doc
        .font("Helvetica")
        .fontSize(11)
        .text(tipoCompTexto, 390, 75, { align: "center", width: 160 });
      doc
        .fontSize(12)
        .text(saleInfo.documentId, 390, 105, { align: "center", width: 160 });

      // --- 2. INFORMACIÓN DEL CLIENTE ---
      doc.fontSize(9).text("", 40, 150);
      doc.text(`FECHA DE EMISIÓN: ${saleInfo.issueDate}`);
      doc.text(`CLIENTE: ${saleInfo.customerName}`);
      doc.text(`DOCUMENTO: ${saleInfo.customerDocument}`);
      doc.text(`MONEDA: SOLES (PEN)`);

      // --- 3. TABLA DE ITEMS ---
      let currentY = 230;
      doc.font("Helvetica-Bold");
      doc.text("CANT.", 40, currentY, { width: 40 });
      doc.text("DESCRIPCIÓN", 90, currentY, { width: 270 });
      doc.text("P. UNIT", 380, currentY, { width: 60, align: "right" });
      doc.text("TOTAL", 480, currentY, { width: 70, align: "right" });

      doc
        .moveTo(40, currentY + 15)
        .lineTo(550, currentY + 15)
        .stroke();
      currentY += 25;

      doc.font("Helvetica");
      let subtotalGlobal = 0;
      let igvGlobal = 0;
      const IGV_RATE = 0.18;

      saleInfo.items.forEach((item: any) => {
        const totalItem = item.quantity * item.unitPrice;
        const valorVentaItem = totalItem / (1 + IGV_RATE);
        const igvItem = totalItem - valorVentaItem;

        subtotalGlobal += valorVentaItem;
        igvGlobal += igvItem;

        doc.text(item.quantity.toString(), 40, currentY, { width: 40 });
        doc.text(item.description || item.name || "Producto/Servicio", 90, currentY, {
          width: 270,
        });
        doc.text(`S/ ${item.unitPrice.toFixed(2)}`, 380, currentY, {
          width: 60,
          align: "right",
        });
        doc.text(`S/ ${totalItem.toFixed(2)}`, 480, currentY, {
          width: 70,
          align: "right",
        });
        currentY += 20;
      });

      const totalGlobal = subtotalGlobal + igvGlobal;

      // --- 4. TOTALES ---
      currentY += 15;
      doc.font("Helvetica-Bold");
      doc.text("OP. GRAVADA:", 360, currentY, { width: 100, align: "right" });
      doc
        .font("Helvetica")
        .text(`S/ ${subtotalGlobal.toFixed(2)}`, 480, currentY, {
          width: 70,
          align: "right",
        });

      currentY += 15;
      doc
        .font("Helvetica-Bold")
        .text("I.G.V. (18%):", 360, currentY, { width: 100, align: "right" });
      doc
        .font("Helvetica")
        .text(`S/ ${igvGlobal.toFixed(2)}`, 480, currentY, {
          width: 70,
          align: "right",
        });

      currentY += 15;
      doc
        .font("Helvetica-Bold")
        .text("TOTAL A PAGAR:", 360, currentY, { width: 100, align: "right" });
      doc.text(`S/ ${totalGlobal.toFixed(2)}`, 480, currentY, {
        width: 70,
        align: "right",
      });

      // --- 5. ESTRUCTURA DEL CÓDIGO QR ---
      const tipoDocCliente =
        saleInfo.customerDocument.length === 11 ? "6" : "1";
      const [serie, correlativo] = saleInfo.documentId.split("-");

      const qrString = [
        RUC_EMPRESA,
        saleInfo.documentType,
        serie,
        correlativo,
        igvGlobal.toFixed(2),
        totalGlobal.toFixed(2),
        saleInfo.issueDate,
        tipoDocCliente,
        saleInfo.customerDocument,
        digestValue,
        "",
      ].join("|");

      const qrBuffer = await QRCode.toBuffer(qrString, {
        type: "png",
        width: 110,
      });

      doc.image(qrBuffer, 40, currentY + 30);
      doc.font("Helvetica").fontSize(8);
      doc.text(`Valor Resumen: ${digestValue}`, 160, currentY + 50);
      doc.text(
        "Representación impresa de la Factura Electrónica.",
        160,
        currentY + 65,
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
