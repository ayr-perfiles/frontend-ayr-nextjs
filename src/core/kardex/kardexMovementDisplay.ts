export function getKardexMovementDisplay(type: string): { sign: "+" | "-" | ""; label: string; className: string } {
  switch (type) {
    case "IN":
    case "ENTRADA":
      return {
        sign: "+",
        label: "ENTRADA",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    case "OUT":
    case "SALIDA":
      return {
        sign: "-",
        label: "SALIDA",
        className: "bg-red-50 text-red-700 border-red-200"
      };
    case "SCRAP":
      return {
        sign: "-",
        label: "MERMA",
        className: "bg-amber-50 text-amber-700 border-amber-200"
      };
    case "SCRAP_REVERSAL":
      return {
        sign: "+",
        label: "REVERSA MERMA",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    default:
      console.warn(`[kardex] type no mapeado: ${type}`);
      return {
        sign: "",
        label: type,
        className: "bg-gray-100 text-gray-600 border-gray-200"
      };
  }
}
