import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SupervisorReportResult } from '@/core/reports/bobinasSupervisorLogic';

export function generateBobinasSupervisorPdf(report: SupervisorReportResult, { corteLabel }: { corteLabel: string }) {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  
  // Titles
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('STOCK DE BOBINAS — ALUZINC', 40, 40);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Corte al ${corteLabel} · Línea PERFILES`, 40, 55);

  let currentY = 80;

  const renderSection = (title: string, color: [number, number, number], rows: any[], subtotals: any) => {
    // Section Header (banda de color)
    doc.setFillColor(...color);
    doc.rect(40, currentY, doc.internal.pageSize.getWidth() - 80, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 45, currentY + 14);
    
    currentY += 20;

    const tableData = rows.map(r => [
      r.und,
      r.espesorMm.toString(),
      r.anchoM.toFixed(3),
      r.acabado,
      r.proveedor,
      r.empresa,
      r.pesoKg.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      r.metrajeML.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      formatDate(r.fechaFactura)
    ]);

    tableData.push([
      subtotals.count.toString(),
      '',
      '',
      'SUBTOTAL',
      '',
      '',
      subtotals.pesoKg.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      subtotals.metrajeML.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      ''
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['UND', 'ESPESOR (mm)', 'ANCHO (m)', 'ACABADO', 'PROVEEDOR', 'EMPRESA', 'PESO (kg)', 'METRAJE (m)', 'FECHA']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: color },
      margin: { left: 40, right: 40 },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 30;
  };

  if (report.abiertas.length > 0) {
    renderSection('BOBINAS ABIERTAS', [37, 99, 235], report.abiertas, report.subAbiertas); // blue-600
  }
  if (report.cerradas.length > 0) {
    renderSection('BOBINAS CERRADAS', [71, 85, 105], report.cerradas, report.subCerradas); // slate-600
  }

  doc.save('stock_bobinas_supervisor.pdf');
}

function formatDate(date: Date | null) {
  if (!date) return '—';
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}
