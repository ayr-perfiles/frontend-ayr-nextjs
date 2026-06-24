import { create } from "xmlbuilder2";

/**
 * Genera el XML UBL 2.1 para la Guía de Remisión Remitente (DespatchAdvice)
 */
export function buildDespatchXml(guiaInfo: any) {
  console.log(
    "Generando XML para la Guía de Remisión con la siguiente información:",
    guiaInfo,
  );

  const RUC_EMPRESA = process.env.SUNAT_RUC || "20612769151";
  const RAZON_SOCIAL =
    process.env.EMPRESA_RAZON_SOCIAL || "EMBOTELLADORA MOALV S.A.C.";

  // Ubigeo de la Planta de Moalv
  const UBIGEO_PARTIDA = process.env.UBIGEO_PARTIDA || "250101";
  const DIRECCION_PARTIDA =
    process.env.DIRECCION_PARTIDA || "AV. PRINCIPAL MZ. A LOTE. 1";

  // --- VALIDACIÓN Y BLINDAJE DE DATOS ---
  // Nos aseguramos de que modalidad sea estrictamente "01" o "02", sin espacios ni enteros.
  const modalidad = String(guiaInfo.modalidadTraslado || "02")
    .trim()
    .padStart(2, "0");
  const driverDni = guiaInfo.driverDni ? String(guiaInfo.driverDni).trim() : "";
  const transportistaRuc = guiaInfo.transportistaRuc
    ? String(guiaInfo.transportistaRuc).trim()
    : "";
  const vehiclePlate = guiaInfo.vehiclePlate
    ? String(guiaInfo.vehiclePlate).replace(/[^A-Za-z0-9]/g, "")
    : "";

  const xmlObj = {
    DespatchAdvice: {
      "@xmlns": "urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2",
      "@xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "@xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "@xmlns:ext":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",

      // Espacio reservado para la firma digital
      "ext:UBLExtensions": {
        "ext:UBLExtension": {
          "ext:ExtensionContent": "",
        },
      },

      "cbc:UBLVersionID": "2.1",
      "cbc:CustomizationID": "2.0", // Versión exigida por SUNAT para GRE
      "cbc:ID": String(guiaInfo.documentId), // Ej. T001-121
      "cbc:IssueDate": String(guiaInfo.issueDate), // YYYY-MM-DD
      "cbc:IssueTime": guiaInfo.issueTime || "00:00:00",
      "cbc:DespatchAdviceTypeCode": {
        "@listAgencyName": "PE:SUNAT",
        "@listName": "Tipo de Documento",
        "@listURI": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01",
        "#text": "09", // 09 = Guía de Remisión Remitente
      },

      // EMISOR (Tu empresa)
      "cac:DespatchSupplierParty": {
        "cac:Party": {
          "cac:PartyIdentification": {
            "cbc:ID": {
              "@schemeID": "6",
              "@schemeName": "Documento de Identidad",
              "@schemeAgencyName": "PE:SUNAT",
              "@schemeURI": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
              "#text": RUC_EMPRESA,
            },
          },
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": RAZON_SOCIAL,
          },
        },
      },

      // DESTINATARIO (El Cliente)
      "cac:DeliveryCustomerParty": {
        "cac:Party": {
          "cac:PartyIdentification": {
            "cbc:ID": {
              // 6 = RUC, 1 = DNI
              "@schemeID":
                String(guiaInfo.customerDocument).length === 11 ? "6" : "1",
              "@schemeName": "Documento de Identidad",
              "@schemeAgencyName": "PE:SUNAT",
              "@schemeURI": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
              "#text": String(guiaInfo.customerDocument),
            },
          },
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": guiaInfo.customerName,
          },
        },
      },

      // DATOS DEL TRASLADO Y TRANSPORTE
      "cac:Shipment": {
        "cbc:ID": "SUNAT_Envio",
        "cbc:HandlingCode": {
          "@listAgencyName": "PE:SUNAT",
          "@listName": "Motivo de traslado",
          "@listURI": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20",
          "#text": guiaInfo.motivoTraslado || "01",
        },
        // Peso Bruto Total
        "cbc:GrossWeightMeasure": {
          "@unitCode": "KGM",
          "#text": String(guiaInfo.pesoTotalKilos),
        },

        // ETAPA DEL TRASLADO
        "cac:ShipmentStage": {
          "cbc:TransportModeCode": {
            "@listName": "Modalidad de traslado",
            "@listAgencyName": "PE:SUNAT",
            "@listURI": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18",
            "#text": modalidad,
          },

          "cac:TransitPeriod": {
            "cbc:StartDate": String(guiaInfo.issueDate),
          },

          // 01 = Transporte Público (Se requiere Transportista)
          ...(modalidad === "01" && {
            "cac:CarrierParty": {
              "cac:PartyIdentification": {
                "cbc:ID": {
                  "@schemeID": "6",
                  "@schemeName": "Documento de Identidad",
                  "@schemeAgencyName": "PE:SUNAT",
                  "@schemeURI":
                    "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
                  "#text": transportistaRuc,
                },
              },
              "cac:PartyLegalEntity": {
                "cbc:RegistrationName": guiaInfo.transportistaRazonSocial,
              },
            },
          }),

          // 02 = Transporte Privado (Se requiere Conductor con catálogos obligatorios)
          // 02 = Transporte Privado (Se requiere Conductor con catálogos obligatorios)
          ...(modalidad === "02" && {
            "cac:DriverPerson": {
              "cbc:ID": {
                "@schemeID": "1", // 1 = DNI
                "@schemeName": "Documento de Identidad",
                "@schemeAgencyName": "PE:SUNAT",
                "@schemeURI":
                  "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
                "#text": driverDni,
              },
              "cbc:FirstName": "Conductor",
              "cbc:FamilyName": "Principal",
              "cbc:JobTitle": "Principal",

              // 🔥 SOLUCIÓN AL ERROR 2572: Número de Licencia de Conducir (Brevete)
              // Si no lo tienes en tu BD aún, SUNAT suele aceptar una letra (ej. 'Q' o 'A') seguida del DNI.
              "cac:IdentityDocumentReference": {
                "cbc:ID": String(
                  guiaInfo.driverLicense || `Q${driverDni}`,
                ).toUpperCase(),
              },
            },
          }),
        },

        // DIRECCIONES DE LLEGADA Y PARTIDA (Estructura exacta según Greenter/SUNAT)
        "cac:Delivery": {
          "cac:DeliveryAddress": {
            "cbc:ID": {
              "@schemeAgencyName": "PE:INEI",
              "@schemeName": "Ubigeos",
              "#text": String(guiaInfo.ubigeoLlegada),
            },
            "cac:AddressLine": {
              "cbc:Line": guiaInfo.direccionLlegada,
            },
          },
          "cac:Despatch": {
            "cac:DespatchAddress": {
              "cbc:ID": {
                "@schemeAgencyName": "PE:INEI",
                "@schemeName": "Ubigeos",
                "#text": UBIGEO_PARTIDA,
              },
              "cac:AddressLine": {
                "cbc:Line": DIRECCION_PARTIDA,
              },
            },
          },
        },

        // PLACA DEL VEHÍCULO (Solo si es Privado '02')
        ...(modalidad === "02" && vehiclePlate
          ? {
              "cac:TransportHandlingUnit": {
                "cac:TransportEquipment": {
                  "cbc:ID": vehiclePlate,
                },
              },
            }
          : {}),
      },

      // LÍNEAS DE PRODUCTOS (Detalle de mercadería)
      "cac:DespatchLine": guiaInfo.items.map((item: any, index: number) => ({
        "cbc:ID": (index + 1).toString(),
        "cbc:DeliveredQuantity": {
          "@unitCode": item.unitCode || "NIU", // NIU = Unidades
          "#text": String(item.quantity),
        },
        "cac:OrderLineReference": {
          "cbc:LineID": (index + 1).toString(),
        },
        "cac:Item": {
          "cbc:Description": item.description, // Cambiado por estándar de descripción del item en GRE
          "cac:SellersItemIdentification": {
            "cbc:ID": String(item.productId),
          },
        },
      })),
    },
  };

  const doc = create({ version: "1.0", encoding: "utf-8" }, xmlObj);
  return doc.end({ prettyPrint: false });
}
