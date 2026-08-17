export interface TipoCambioResult {
  venta: number | null;
  fallback: boolean;
}

export async function fetchTipoCambio(fecha: string): Promise<TipoCambioResult> {
  try {
    const res = await fetch(`/api/tipo-cambio?fecha=${fecha}`);
    if (!res.ok) return { venta: null, fallback: true };
    const data = await res.json();
    if (!data.venta) return { venta: null, fallback: true };
    return { venta: Number(data.venta), fallback: !!data.fallback };
  } catch {
    return { venta: null, fallback: true };
  }
}
