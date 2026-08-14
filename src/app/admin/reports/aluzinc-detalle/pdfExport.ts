import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AluzincDetalleGroup, AluzincDetalleResult } from '@/core/reports/aluzincDetalleLogic';

export function generateAluzincDetallePdf(result: AluzincDetalleResult, { periodLabel, title, filename, scope = 'full', warnings = [] }: { periodLabel: string; title?: string; filename?: string; scope?: 'full' | 'single'; warnings?: string[] }) {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  
  // Titles
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title || 'REPORTE VENTAS vs PRODUCCIÓN — ALUZINC', 40, 40);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodLabel} · Línea PERFILES`, 40, 55);

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

  const formatNum = (num: number) =>
    num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  let currentY = 80;

  const activeWarnings = scope === 'full' ? warnings : (result.grupos[0]?.warnings || []);

  if (activeWarnings.length > 0) {
    doc.setFillColor(254, 243, 199); // amber-50
    doc.rect(40, currentY, doc.internal.pageSize.getWidth() - 80, 20 + activeWarnings.length * 15, 'F');
    doc.setTextColor(180, 83, 9); // amber-700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ADVERTENCIAS:', 45, currentY + 14);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    activeWarnings.forEach((w, idx) => {
      doc.text(`• ${w}`, 45, currentY + 30 + (idx * 15));
    });
    
    currentY += 30 + activeWarnings.length * 15 + 10;
  }

  // Header band
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(40, currentY, doc.internal.pageSize.getWidth() - 80, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN POR GRUPO', 45, currentY + 14);
  
  currentY += 20;

  const tableData = result.grupos.map((g: AluzincDetalleGroup) => {
    const isWarning = g.warnings.length > 0;
    const costo = g.montoVentas - g.profitVentas;
    const margenPct = g.montoVentas > 0 ? ((g.profitVentas / g.montoVentas) * 100).toFixed(2) + '%' : '—';
    return [
      g.color,
      g.thicknessMm,
      g.clientes.size.toString(),
      g.nVentas.toString(),
      formatMoney(g.montoVentas),
      formatMoney(g.profitVentas),
      formatMoney(costo),
      margenPct,
      formatNum(g.mlProduced),
      g.piezas.toString(),
      isWarning ? '—' : formatNum(g.teoricoKg),
      isWarning ? '—' : formatNum(g.consumidoKg),
      isWarning ? '—' : (g.desvioKg > 0 ? '+' : '') + formatNum(g.desvioKg),
      isWarning ? '—' : (g.desvioPct > 0 ? '+' : '') + (g.desvioPct * 100).toFixed(2) + '%'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [[
      'COLOR', 'ESP.', 'CLI.', 
      'CANT.', 'MONTO', 'GANANCIA', 'COSTO', 'MARGEN %',
      'PROD (m)', 'PZAS.', 
      'TEÓRICO (kg)', 'CONS. (kg)', 'DESV. (kg)', 'DESV. %'
    ]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    styles: { fontSize: 7 },
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowData = result.grupos[data.row.index];
        if (rowData && rowData.warnings.length > 0) {
          data.cell.styles.textColor = [220, 38, 38]; 
        }
      }
    }
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 30;

  // Breakdown per group
  for (const g of result.grupos) {
    if (currentY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFillColor(71, 85, 105); // slate-600
    doc.rect(40, currentY, doc.internal.pageSize.getWidth() - 80, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`GRUPO: ${g.color} - ${g.thicknessMm}mm`, 45, currentY + 14);
    
    currentY += 25;

    // Ventas
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Desglose de Ventas', 40, currentY);
    currentY += 10;

    const ventasBody = g.ventasDetalle.map(v => {
      const margen = v.ventaTotal > 0 ? (((v.ventaTotal - v.costoTotal) / v.ventaTotal) * 100).toFixed(2) + '%' : '—';
      return [
        v.documentNumber,
        v.customerName,
        v.cotizacion,
        v.sku,
        v.quantity.toString(),
        formatMoney(v.unitValue),
        formatMoney(v.ventaTotal),
        formatMoney(v.cUnit),
        formatMoney(v.costoTotal),
        margen
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['DOCUMENTO', 'CLIENTE', 'COTIZACIÓN', 'SKU', 'CANT', 'V.UNIT', 'VENTA S/', 'C.UNIT', 'COSTO S/', 'MARGEN %']],
      body: ventasBody,
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7 },
      margin: { left: 40, right: 40 }
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

    // Producción
    if (currentY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Desglose de Producción', 40, currentY);
    currentY += 10;

    const logsBody = g.logsDetalle.map(l => [
      l.documentId,
      l.sku,
      formatNum(l.mlProduced),
      formatNum(l.consumoKg),
      formatMoney(l.costoProdPEN)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['DOCUMENTO', 'SKU', 'ML PROD', 'CONSUMO KG', 'COSTO PROD S/']],
      body: logsBody,
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7 },
      margin: { left: 40, right: 40 }
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 40;
  }

  doc.save(filename || 'aluzinc_ventas_vs_produccion.pdf');
}
