import { useState, useEffect } from "react";
import { Sale } from "@/types";
import { Zap } from "lucide-react";
import { getSystemSettings, SystemSettings } from "@/services/settingsService";

interface PrintableTicketProps {
  sale: Sale;
}

export const PrintableTicket = ({ sale }: PrintableTicketProps) => {
  // Estado para guardar la configuración traída de Firebase
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Cargar configuración al momento de preparar el ticket
  useEffect(() => {
    const fetchSettings = async () => {
      const data = await getSystemSettings();
      if (data) setSettings(data);
    };
    fetchSettings();
  }, []);

  // --- VALORES DINÁMICOS CON RESPALDO (Fallbacks) ---
  // Si 'settings' existe usa esos datos, si no, usa los valores por defecto.
  const IGV_RATE = settings?.igvRate ?? 0.18;
  const companyName = settings?.companyName || "AYR STEEL";
  const companyRuc = settings?.companyRuc || "20123456789";
  const companyAddress =
    settings?.companyAddress || "Av. Los Industriales 123, Lima, Perú";
  const contactInfo = `${settings?.companyEmail || "ventas@ayrsteel.com"} | ${settings?.companyPhone || "+51 987 654 321"}`;

  // Cálculos de impuestos
  const subtotal = sale.totalAmount / (1 + IGV_RATE);
  const igv = sale.totalAmount - subtotal;

  // Cálculo de Peso Total
  const totalWeight =
    (sale as any).totalWeight ||
    sale.items?.reduce(
      (sum, item: any) => sum + item.quantity * (item.unitWeight || 0),
      0,
    ) ||
    0;

  const isQuotation = sale.status === "QUOTATION";
  const documentTitle = isQuotation ? "COTIZACIÓN" : "TICKET DE VENTA";
  const documentNumber = sale.id ? sale.id.slice(-8).toUpperCase() : "00000000";

  const dateStr = sale.timestamp?.toDate
    ? sale.timestamp.toDate().toLocaleDateString("es-PE", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Fecha no disponible";

  // Extraemos posibles campos extendidos del cliente
  const address = (sale as any).customerAddress;
  const contactName = (sale as any).contactName;
  const contactPhone = (sale as any).contactPhone;

  return (
    // Contenedor principal: paddings reducidos para maximizar espacio
    <div className="bg-white p-6 md:p-8 max-w-4xl mx-auto text-gray-800 print:shadow-none print:max-w-full font-sans">
      {/* 🟢 REGLA DE IMPRESIÓN: Margen de 10mm solicitado */}
      <style type="text/css" media="print">
        {`
          @page { margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `}
      </style>

      {/* --- CABECERA DINÁMICA --- */}
      <div className="flex justify-between items-center border-b border-gray-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg print:bg-blue-600 print:text-white">
            <Zap size={20} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic text-gray-900 leading-none">
              {companyName}
            </h1>
            <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest leading-none mt-0.5">
              Industria Metalúrgica
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] leading-tight">
          <p className="font-bold text-gray-900">
            {companyName} S.A.C. | RUC: {companyRuc}
          </p>
          <p className="text-gray-500">{companyAddress}</p>
          <p className="text-gray-500">{contactInfo}</p>
        </div>
      </div>

      {/* --- TÍTULO Y FECHA COMPACTOS --- */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
            {documentTitle}
          </h2>
          <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">
            N° {documentNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
            Fecha de Emisión
          </p>
          <p className="text-xs font-semibold text-gray-800">{dateStr}</p>
        </div>
      </div>

      {/* --- DATOS DEL CLIENTE --- */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 print:border-gray-300">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 gap-x-4">
          <div className="md:col-span-2">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              Cliente / Razón Social
            </p>
            <p className="text-xs font-bold text-gray-900 uppercase leading-tight">
              {sale.customerName}
            </p>
          </div>
          <div className="md:col-span-1">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              RUC / DNI
            </p>
            <p className="text-xs font-bold text-gray-900">
              {sale.documentNumber || "---"}
            </p>
          </div>
          <div className="md:col-span-1">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              Atendido por
            </p>
            <p className="text-xs font-semibold text-gray-700">
              {sale.sellerId || "Vendedor General"}
            </p>
          </div>

          {/* Fila secundaria condicional (Dirección y Contacto) */}
          {(address || contactName) && (
            <div className="col-span-1 md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-gray-200 pt-2 mt-1">
              {address && (
                <div className="md:col-span-2">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                    Dirección Fiscal
                  </p>
                  <p className="text-[10px] font-semibold text-gray-700 uppercase leading-tight">
                    {address}
                  </p>
                </div>
              )}
              {contactName && (
                <div className="md:col-span-2">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                    Atención a (Contacto)
                  </p>
                  <p className="text-[10px] font-semibold text-gray-700 uppercase leading-tight">
                    {contactName} {contactPhone && ` • Cel: ${contactPhone}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- TABLA DE PRODUCTOS --- */}
      <div className="mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white print:bg-gray-200 print:text-gray-900">
              <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest rounded-tl-lg">
                Cant.
              </th>
              <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest">
                Descripción del Producto
              </th>
              <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-right">
                Peso
              </th>
              <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-right">
                P. Unit.
              </th>
              <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-right rounded-tr-lg">
                Importe
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 border-b border-gray-900">
            {sale.items?.map((item: any, index) => {
              const itemWeight = item.quantity * (item.unitWeight || 0);

              return (
                <tr key={index}>
                  <td className="py-3 px-3 text-sm font-bold text-gray-800">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-3 text-sm font-bold text-gray-800 uppercase">
                    Perfil {item.sku}
                  </td>
                  <td className="py-3 px-3 text-xs font-mono text-gray-500 text-right">
                    {itemWeight > 0 ? `${itemWeight.toFixed(2)} kg` : "---"}
                  </td>
                  <td className="py-3 px-3 text-sm font-mono text-gray-600 text-right">
                    S/ {item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-sm font-mono font-black text-gray-900 text-right">
                    S/ {(item.quantity * item.unitPrice).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- TOTALES DINÁMICOS --- */}
      <div className="flex justify-end mb-6">
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Subtotal:</span>
            <span className="font-mono">S/ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            {/* Calculamos el % de IGV para mostrarlo en el texto */}
            <span>IGV ({(IGV_RATE * 100).toFixed(0)}%):</span>
            <span className="font-mono">S/ {igv.toFixed(2)}</span>
          </div>

          {totalWeight > 0 && (
            <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2 mt-1">
              <span>Peso Total Estimado:</span>
              <span className="font-mono font-bold text-gray-700">
                {totalWeight.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}{" "}
                kg
              </span>
            </div>
          )}

          <div className="flex justify-between items-center border-t-2 border-gray-900 pt-2 mt-1">
            <span className="font-black text-gray-900 uppercase tracking-widest text-sm">
              Total a Pagar:
            </span>
            <span className="font-black font-mono text-xl text-gray-900">
              S/ {sale.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* --- FOOTER COMPACTO --- */}
      <div className="text-center text-[9px] text-gray-400 border-t border-gray-200 pt-3">
        {isQuotation ? (
          <>
            <p className="font-bold text-gray-500 mb-0.5">
              Esta cotización tiene una validez de 7 días calendario.
            </p>
            <p>
              Los precios están sujetos a cambios sin previo aviso. Los tiempos
              de entrega se confirmarán al emitir la Orden de Compra.
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-gray-500 mb-0.5">
              ¡Gracias por su compra en {companyName}!
            </p>
            <p>
              Este documento es una representación impresa del ticket de venta.
              Consérvelo para cualquier reclamo o garantía.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
