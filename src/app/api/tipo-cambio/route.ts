import { NextResponse } from "next/server";

// Reemplaza "AQUI_PEGA_TU_TOKEN" con tu token real de Decolecta si no usas .env
const API_TOKEN = process.env.APIS_PERU_TOKEN || "AQUI_PEGA_TU_TOKEN";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("fecha");

  if (!date) {
    return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  }

  try {
    if (!API_TOKEN || API_TOKEN === "AQUI_PEGA_TU_TOKEN") {
      throw new Error("Token de API no configurado en el servidor.");
    }

    const res = await fetch(
      `https://api.decolecta.com/v1/tipo-cambio/sunat?date=${date}`,
      {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
        cache: "no-store",
      },
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `Error API (Status: ${res.status})`);
    }

    // MAPEO EXACTO: Usamos sell_price y buy_price según la doc de Decolecta
    const venta = data.sell_price;
    const compra = data.buy_price;

    if (!venta) {
      throw new Error("El JSON de Decolecta no trajo el valor sell_price.");
    }

    // Retornamos el formato exacto que espera tu BulkUploadSales
    return NextResponse.json({
      venta: parseFloat(venta),
      compra: parseFloat(compra),
      fecha: date,
    });
  } catch (error: any) {
    console.error(`⚠️ TC real no disponible para ${date}:`, error.message);
    // Sin fallback numérico: el frontend debe pedir el TC manual, nunca asumir 3.75.
    return NextResponse.json({
      fallback: true,
      error: error.message,
    });
  }
}
