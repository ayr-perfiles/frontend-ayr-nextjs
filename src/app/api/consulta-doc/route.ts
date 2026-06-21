import { NextResponse } from "next/server";
import { getSystemSettings } from "@/services/settingsService";

// ejemplo de respuesta dni

// {
// 	"first_name": "ROXANA KARINA",
// 	"first_last_name": "DELGADO",
// 	"second_last_name": "HUAMANI",
// 	"full_name": "DELGADO HUAMANI ROXANA KARINA",
// 	"document_number": "46027897"
// }

// ejemplo de respuest ruc

// {
// 	"razon_social": "REXTIE S.A.C.",
// 	"numero_documento": "20601030013",
// 	"estado": "ACTIVO",
// 	"condicion": "HABIDO",
// 	"direccion": "AV. JOSE GALVEZ BARRENECHEA NRO 566 INT. 101 URB. CORPAC ",
// 	"ubigeo": "150131",
// 	"via_tipo": "AV.",
// 	"via_nombre": "JOSE GALVEZ BARRENECHEA",
// 	"zona_codigo": "URB.",
// 	"zona_tipo": "CORPAC",
// 	"numero": "566",
// 	"interior": "101",
// 	"lote": "-",
// 	"dpto": "-",
// 	"manzana": "-",
// 	"kilometro": "-",
// 	"distrito": "SAN ISIDRO",
// 	"provincia": "LIMA",
// 	"departamento": "LIMA",
// 	"es_agente_retencion": false,
// 	"es_buen_contribuyente": false,
// 	"locales_anexos": null
// }

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
