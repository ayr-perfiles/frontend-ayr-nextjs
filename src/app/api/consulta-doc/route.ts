import { NextResponse } from "next/server";
import { getSystemSettings } from "@/services/settingsService";

export async function GET(request: Request) {
  // 1. Obtenemos el número de la URL (ej: /api/consulta-doc?numero=20123456789)
  const { searchParams } = new URL(request.url);
  const numero = searchParams.get("numero");

  if (!numero || (numero.length !== 8 && numero.length !== 11)) {
    return NextResponse.json(
      { error: "Número inválido. Debe tener 8 u 11 dígitos." },
      { status: 400 },
    );
  }

  // 2. Determinamos si es DNI o RUC para elegir el endpoint correcto
  const isRUC = numero.length === 11;
  const endpoint = isRUC
    ? `https://api.decolecta.com/v1/sunat/ruc?numero=${numero}`
    : `https://api.decolecta.com/v1/reniec/dni?numero=${numero}`;

  try {
    // 3. Obtenemos la configuración guardada en Firebase
    const settings = await getSystemSettings();

    // 4. Prioridad Dinámica: Primero Firebase, luego .env local
    const token = settings?.sunatApiToken || process.env.APIS_PERU_TOKEN || "";

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Token de API no configurado. Ve al panel de Configuración > Integraciones API.",
        },
        { status: 500 },
      );
    }

    // 5. Hacemos la consulta a la API externa de forma segura
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // Evitamos que Next.js cachee esta respuesta
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(
        "No se encontró el documento en los registros oficiales.",
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al consultar API externa" },
      { status: 500 },
    );
  }
}
