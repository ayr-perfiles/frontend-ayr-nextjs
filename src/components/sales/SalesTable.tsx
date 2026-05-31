import { useEffect, useRef, useState } from "react";
import { Sale } from "@/types";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
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
  Eye,
  Edit,
  XCircle,
} from "lucide-react";
import { createPortal } from "react-dom";

// 1. INTERFACE ACTUALIZADA
interface SalesTableProps {
  displaySales: Sale[];
  isLoading: boolean;
  role: string | null | undefined;
  isProcessing: boolean;
  currentPage: number;
  pageSize: number;
  onPrint: (sale: Sale) => void;
  onDuplicate: (saleId: string) => void;
  onApprove: (sale: Sale) => void;
  onViewDetails: (sale: Sale) => void;
  onEdit: (saleId: string) => void; // <-- NUEVA ACCIÓN
  onCancel: (saleId: string) => void; // <-- NUEVA ACCIÓN
}

export function SalesTable({
  displaySales,
  isLoading,
  role,
  isProcessing,
  currentPage,
  pageSize,
  onPrint,
  onDuplicate,
  onApprove,
  onViewDetails,
  onEdit,
  onCancel,
}: SalesTableProps) {
  if (isLoading && displaySales.length === 0) {
    return <TableSkeleton rows={7} columns={7} />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto min-h-[250px]">
        <table className="w-full text-left min-w-[950px] border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-12">
                #
              </th>
              <th className="p-4 pl-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Documento
              </th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                Total
              </th>
              <th className="p-4 text-xs font-bold text-emerald-600 uppercase tracking-wider text-right">
                Ganancia / Rastro
              </th>
              <th className="p-4 pr-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-28">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displaySales.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon="Receipt"
                    title="No hay resultados"
                    description="No se encontraron operaciones con los filtros actuales."
                  />
                </td>
              </tr>
            ) : (
              displaySales.map((sale, index) => {
                const saleWeight = (sale as any).totalWeight || 0;
                // Calculamos el número de fila exacto según la paginación
                const rowNumber = (currentPage - 1) * pageSize + index + 1;

                return (
                  <tr
                    key={sale.id}
                    className="group transition-colors hover:bg-blue-50/20"
                  >
                    <td className="p-4 text-center">
                      <span className="text-xs font-bold text-slate-400">
                        {rowNumber}
                      </span>
                    </td>

                    <td className="p-4 pl-2">
                      <p className="text-sm font-black text-blue-900 uppercase tracking-wider mb-1">
                        {sale.id}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {sale.timestamp?.toDate
                          ? sale.timestamp.toDate().toLocaleString("es-PE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Reciente"}
                      </p>
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-slate-700 uppercase text-sm mb-1">
                        {sale.customerName}
                      </p>
                      <p className="text-xs font-medium text-slate-400">
                        Doc: {sale.documentNumber || "---"}
                      </p>
                    </td>

                    <td className="p-4">
                      {sale.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-green-200 uppercase tracking-widest">
                          <CheckCircle2 size={12} /> Venta Cerrada
                        </span>
                      )}
                      {sale.status === "QUOTATION" && (
                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-orange-200 uppercase tracking-widest">
                          <FileText size={12} /> Cot. Pendiente
                        </span>
                      )}
                      {sale.status === "CONVERTED" && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-slate-200 uppercase tracking-widest">
                          <CheckCircle2 size={12} /> Cot. Aprobada
                        </span>
                      )}
                      {sale.status === "CANCELLED" && (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-red-100 uppercase tracking-widest">
                          <XCircle size={12} /> Rechazada
                        </span>
                      )}
                      {sale.status === "VOIDED" && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-[10px] font-black border border-red-200 uppercase tracking-widest">
                          <AlertCircle size={12} /> Anulada
                        </span>
                      )}
                      {sale.businessLines && sale.businessLines.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {sale.businessLines.map((line) => {
                            const config: Record<string, { label: string; cls: string }> = {
                              drywall: { label: "DRY", cls: "bg-blue-50 text-blue-600 border-blue-100" },
                              roofing: { label: "PVC", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
                              "metallic-roofing": { label: "ALU", cls: "bg-zinc-50 text-zinc-600 border-zinc-100" },
                              trading: { label: "TRD", cls: "bg-amber-50 text-amber-600 border-amber-100" },
                              services: { label: "SRV", cls: "bg-violet-50 text-violet-600 border-violet-100" },
                            };
                            const c = config[line] || { label: line.substring(0, 3).toUpperCase(), cls: "bg-gray-50 text-gray-600 border-gray-100" };
                            return (
                              <span
                                key={line}
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${c.cls}`}
                              >
                                {c.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <p className="font-black text-slate-800 text-base">
                        S/{" "}
                        {sale.totalAmount?.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      {saleWeight > 0 && (
                        <p className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                          <Scale size={10} />{" "}
                          {saleWeight.toLocaleString("es-PE")} kg
                        </p>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      {sale.status === "COMPLETED" && (
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-xs ${(sale.totalProfit || 0) < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}
                        >
                          <TrendingUp size={12} /> S/{" "}
                          {(sale.totalProfit || 0).toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}
                      {sale.status === "QUOTATION" && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          En espera
                        </span>
                      )}
                      {sale.status === "CONVERTED" && (
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center justify-end gap-1">
                          <LinkIcon size={10} /> {(sale as any).convertedToId}
                        </span>
                      )}
                      {(sale.status === "CANCELLED" ||
                        sale.status === "VOIDED") && (
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                          Sin efecto
                        </span>
                      )}
                    </td>

                    <td className="p-4 pr-6 relative">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewDetails(sale)}
                          className="p-2 text-slate-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
                          title="Ver Detalles"
                        >
                          <Eye size={18} />
                        </button>

                        <ActionMenu
                          sale={sale}
                          role={role}
                          isProcessing={isProcessing}
                          onPrint={() => onPrint(sale)}
                          onDuplicate={() => onDuplicate(sale.id!)}
                          onApprove={() => onApprove(sale)}
                          onEdit={() => onEdit(sale.id!)}
                          onCancel={() => onCancel(sale.id!)}
                        />
                      </div>
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

// 2. COMPONENTE ACTION MENU
function ActionMenu({
  sale,
  role,
  isProcessing,
  onPrint,
  onDuplicate,
  onApprove,
  onEdit,
  onCancel,
}: {
  sale: Sale;
  role?: string | null | undefined;
  isProcessing: boolean;
  onPrint: () => void;
  onDuplicate: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onCancel: () => void;
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
        className={`p-2 text-slate-400 rounded-lg transition ${isOpen ? "bg-blue-50 text-blue-600" : "hover:bg-slate-100 hover:text-blue-600"}`}
      >
        <MoreHorizontal size={20} />
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div
            className="absolute w-52 bg-white border border-slate-100 rounded-xl shadow-2xl z-[9999] py-2 animate-in fade-in zoom-in-95"
            style={{ top: coords.top, right: coords.right }}
          >
            <button
              onClick={onPrint}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-2 transition"
            >
              <FileDown size={16} /> Imprimir Ticket
            </button>

            <button
              onClick={onDuplicate}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-semibold flex items-center gap-2 transition"
            >
              <Copy size={16} /> Duplicar Operación
            </button>

            {/* SECCIÓN EXCLUSIVA PARA COTIZACIONES */}
            {sale.status === "QUOTATION" && (
              <>
                <div className="h-px bg-slate-100 my-1 mx-2" />

                {/* EDITAR COTIZACIÓN */}
                <button
                  onClick={onEdit}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 font-semibold flex items-center gap-2 transition"
                >
                  <Edit size={16} /> Editar Cotización
                </button>

                {/* APROBAR COTIZACIÓN */}
                {(role === "ADMIN" || role === "SUPERVISOR") && (
                  <button
                    onClick={onApprove}
                    disabled={isProcessing}
                    className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-600 hover:text-white font-bold flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}{" "}
                    Aprobar Venta
                  </button>
                )}

                {/* RECHAZAR / CANCELAR COTIZACIÓN */}
                <button
                  onClick={onCancel}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold flex items-center gap-2 transition mt-1"
                >
                  <XCircle size={16} /> Rechazar / Cancelar
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
