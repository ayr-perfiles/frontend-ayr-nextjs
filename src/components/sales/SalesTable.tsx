import { useEffect, useRef, useState } from "react";
import { Sale } from "@/types";
import {
  CheckCircle2,
  FileText,
  TrendingUp,
  Scale,
  AlertCircle,
  MoreHorizontal,
  FileDown,
  Copy,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { createPortal } from "react-dom";

interface SalesTableProps {
  displaySales: Sale[];
  isLoading: boolean;
  role: string | null | undefined;
  isProcessing: boolean;
  onPrint: (sale: Sale) => void;
  onDuplicate: (saleId: string) => void;
  onApprove: (sale: Sale) => void;
}

export function SalesTable({
  displaySales,
  isLoading,
  role,
  isProcessing,
  onPrint,
  onDuplicate,
  onApprove,
}: SalesTableProps) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto pb-36">
        <table className="w-full text-left min-w-[950px]">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Documento
              </th>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Cliente
              </th>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Estado
              </th>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                Total
              </th>
              <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">
                Ganancia / Rastro
              </th>
              <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-24">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displaySales.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-400">
                  <AlertCircle
                    className="mx-auto mb-3 text-gray-300"
                    size={48}
                  />
                  <p className="font-bold">
                    No se encontraron operaciones con estos filtros.
                  </p>
                </td>
              </tr>
            ) : (
              displaySales.map((sale) => {
                const saleWeight = (sale as any).totalWeight || 0;

                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-blue-50/30 transition group"
                  >
                    <td className="p-4 pl-6">
                      <p className="text-xs font-black text-gray-800 uppercase tracking-widest mb-1">
                        {sale.id}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {sale.timestamp?.toDate
                          ? sale.timestamp.toDate().toLocaleString("es-PE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Reciente"}
                      </p>
                    </td>

                    <td className="p-4">
                      <p className="font-black text-gray-800 uppercase leading-none mb-1 text-sm">
                        {sale.customerName}
                      </p>
                      <p className="text-xs font-bold text-gray-400">
                        {sale.documentNumber || "---"}
                      </p>
                    </td>

                    <td className="p-4">
                      {sale.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-green-200 uppercase tracking-widest">
                          <CheckCircle2 size={12} /> Venta Cerrada
                        </span>
                      )}
                      {sale.status === "QUOTATION" && (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-orange-200 uppercase tracking-widest">
                          <FileText size={12} /> Cot. Pendiente
                        </span>
                      )}
                      {/* NUEVO ESTADO: Cotización que ya fue aprobada */}
                      {sale.status === "CONVERTED" && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-blue-200 uppercase tracking-widest">
                          <CheckCircle2 size={12} /> Cot. Aprobada
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <p className="font-black text-gray-900 text-lg leading-tight">
                        S/{" "}
                        {sale.totalAmount?.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      {saleWeight > 0 && (
                        <p className="text-[10px] font-bold text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                          <Scale size={10} />{" "}
                          {saleWeight.toLocaleString("es-PE")} kg
                        </p>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      {sale.status === "COMPLETED" && (
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-3 py-1 rounded-lg border text-sm ${(sale.totalProfit || 0) < 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}
                        >
                          <TrendingUp size={14} /> S/{" "}
                          {(sale.totalProfit || 0).toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}
                      {sale.status === "QUOTATION" && (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          En espera
                        </span>
                      )}
                      {/* NUEVO: Mostrar qué Venta se generó a partir de esta cotización */}
                      {sale.status === "CONVERTED" && (
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center justify-end gap-1">
                          <LinkIcon size={12} /> Generó{" "}
                          {(sale as any).convertedToId}
                        </span>
                      )}
                    </td>

                    <td className="p-4 pr-6 relative">
                      <ActionMenu
                        sale={sale}
                        role={role}
                        isProcessing={isProcessing}
                        onPrint={() => onPrint(sale)}
                        onDuplicate={() => onDuplicate(sale.id!)}
                        onApprove={() => onApprove(sale)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionMenu({
  sale,
  role,
  isProcessing,
  onPrint,
  onDuplicate,
  onApprove,
}: {
  sale: Sale;
  role?: string | null | undefined;
  isProcessing: boolean;
  onPrint: () => void;
  onDuplicate: () => void;
  onApprove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeMenu = () => setIsOpen(false);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [isOpen]);

  return (
    <div className="relative flex justify-center">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className={`p-2 text-gray-500 rounded-lg transition ${isOpen ? "bg-blue-50 text-blue-600" : "hover:bg-blue-50 hover:text-blue-600"}`}
      >
        <MoreHorizontal size={20} />
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div
            className="absolute w-48 bg-white border border-gray-100 rounded-xl shadow-2xl z-[9999] py-1 animate-in fade-in zoom-in-95"
            style={{ top: coords.top, right: coords.right }}
          >
            <button
              onClick={onPrint}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-2 transition"
            >
              <FileDown size={16} /> Imprimir Ticket
            </button>

            <button
              onClick={onDuplicate}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-semibold flex items-center gap-2 transition"
            >
              <Copy size={16} /> Duplicar Operación
            </button>

            {/* 🔒 AQUÍ ESTÁ EL CANDADO: Admin o Supervisor pueden aprobar */}
            {sale.status === "QUOTATION" &&
              (role === "ADMIN" || role === "SUPERVISOR") && (
                <>
                  <div className="h-px bg-gray-100 my-1 mx-2" />
                  <button
                    onClick={onApprove}
                    disabled={isProcessing}
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-600 hover:text-white font-bold flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}{" "}
                    Aprobar Venta
                  </button>
                </>
              )}
          </div>,
          document.body,
        )}
    </div>
  );
}
