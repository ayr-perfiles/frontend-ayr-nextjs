import { Sale } from "@/types";
import { Zap } from "lucide-react";

interface PrintableTicketProps {
  sale: Sale;
}

export const PrintableTicket = ({ sale }: PrintableTicketProps) => {
  // Cálculos de impuestos (Asumiendo que el total ya incluye IGV)
  const IGV_RATE = 0.18;
  const subtotal = sale.totalAmount / (1 + IGV_RATE);
  const igv = sale.totalAmount - subtotal;

  const isQuotation = sale.status === "QUOTATION";
  const documentTitle = isQuotation ? "COTIZACIÓN" : "TICKET DE VENTA";
  const documentNumber = sale.id ? sale.id.slice(-8).toUpperCase() : "00000000";

  const dateStr = sale.timestamp?.toDate
    ? sale.timestamp
        .toDate()
        .toLocaleDateString("es-PE", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
    : "Fecha no disponible";

  return (
    // Contenedor principal ajustado para impresión A4 o visualización limpia
    <div className="bg-white p-10 max-w-3xl mx-auto text-gray-800 print:shadow-none print:p-0 font-sans">
      {/* --- CABECERA (LOGO Y DATOS DE EMPRESA) --- */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-xl print:bg-blue-600 print:text-white">
            <Zap size={32} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic text-gray-900">
              AYR STEEL
            </h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              Industria Metalúrgica
            </p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-gray-900">AYR STEEL S.A.C.</p>
          <p className="text-gray-500">RUC: 20123456789</p>
          <p className="text-gray-500">Av. Los Industriales 123, Lima, Perú</p>
          <p className="text-gray-500">ventas@ayrsteel.com | +51 987 654 321</p>
        </div>
      </div>

      {/* --- TÍTULO Y DATOS DEL DOCUMENTO --- */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">
            {documentTitle}
          </h2>
          <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-widest">
            N° {documentNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Fecha de Emisión
          </p>
          <p className="text-sm font-semibold text-gray-800">{dateStr}</p>
        </div>
      </div>

      {/* --- DATOS DEL CLIENTE --- */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100 print:border-gray-300">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Cliente / Razón Social
            </p>
            <p className="font-bold text-gray-900 uppercase">
              {sale.customerName}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              RUC / DNI
            </p>
            <p className="font-bold text-gray-900">
              {sale.documentNumber || "No especificado"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Atendido por
            </p>
            <p className="text-sm font-semibold text-gray-700">
              {sale.sellerId || "Vendedor General"}
            </p>
          </div>
        </div>
      </div>

      {/* --- TABLA DE PRODUCTOS --- */}
      <div className="mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white print:bg-gray-200 print:text-gray-900">
              <th className="py-3 px-4 text-xs font-black uppercase tracking-widest rounded-tl-xl">
                Cant.
              </th>
              <th className="py-3 px-4 text-xs font-black uppercase tracking-widest">
                Descripción del Producto
              </th>
              <th className="py-3 px-4 text-xs font-black uppercase tracking-widest text-right">
                P. Unit.
              </th>
              <th className="py-3 px-4 text-xs font-black uppercase tracking-widest text-right rounded-tr-xl">
                Importe
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 border-b-2 border-gray-900">
            {sale.items?.map((item, index) => (
              <tr key={index}>
                <td className="py-4 px-4 text-sm font-bold text-gray-800">
                  {item.quantity}
                </td>
                <td className="py-4 px-4 text-sm font-bold text-gray-800 uppercase">
                  Perfil {item.sku}
                </td>
                <td className="py-4 px-4 text-sm font-mono text-gray-600 text-right">
                  S/ {item.unitPrice.toFixed(2)}
                </td>
                <td className="py-4 px-4 text-sm font-mono font-black text-gray-900 text-right">
                  S/ {(item.quantity * item.unitPrice).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- TOTALES --- */}
      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal:</span>
            <span className="font-mono">S/ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>IGV (18%):</span>
            <span className="font-mono">S/ {igv.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center border-t-2 border-gray-900 pt-3">
            <span className="font-black text-gray-900 uppercase tracking-widest text-sm">
              Total a Pagar:
            </span>
            <span className="font-black font-mono text-2xl text-gray-900">
              S/ {sale.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* --- FOOTER / TÉRMINOS --- */}
      <div className="text-center text-xs text-gray-400 mt-16 border-t border-gray-200 pt-6">
        {isQuotation ? (
          <>
            <p className="font-bold text-gray-500 mb-1">
              Esta cotización tiene una validez de 7 días calendario.
            </p>
            <p>
              Los precios están sujetos a cambios sin previo aviso. Los tiempos
              de entrega se confirmarán al emitir la Orden de Compra.
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-gray-500 mb-1">
              ¡Gracias por su compra en AYR STEEL!
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
