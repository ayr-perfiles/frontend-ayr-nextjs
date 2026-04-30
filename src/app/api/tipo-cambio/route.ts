import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("fecha"); // Formato esperado: YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  }

  try {
    // API pública de apis.net.pe para obtener TC histórico de la SUNAT
    const res = await fetch(
      `https://api.decolecta.com/v1/tipo-cambio/sunat?date=${date}`,
    );
    if (!res.ok) throw new Error("Error en API externa");

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error API Tipo Cambio:", error);
    // Fallback de seguridad por si la API falla, para que no se bloquee tu carga masiva
    return NextResponse.json({ venta: 3.75, compra: 3.7, fallback: true });
  }
}
