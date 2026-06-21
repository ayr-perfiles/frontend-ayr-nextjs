import { addMetallicProductFormSchema } from "../src/modules/metallic-roofing/schemas/catalog";

const testCases = [
  {
    name: "Legacy Family (BOBINA)",
    data: {
      family: "BOBINA", // Should fail
      finish: "ALUZINC",
      color: "ROJO",
      thickness: "0.45",
      width: "1200",
      length: "",
      unit: "KILOGRAMO",
      sku: "BOB045ALZ",
      displayName: "BOBINA ALUZINC 0.45MM X 1200",
      widthMm: "1200",
    }
  },
  {
    name: "Legacy Color (RRR)",
    data: {
      family: "COBERTURA",
      finish: "ALUZINC",
      color: "RRR", // Should pass (Zod allows string, UI shows "heredado")
      thickness: "0.3",
      width: "1200",
      length: "",
      unit: "PIEZA",
      sku: "COB030ROJO",
      displayName: "COBERTURA 0.30 ROJO",
      widthMm: "1200",
    }
  },
  {
    name: "Sano",
    data: {
      family: "COBERTURA",
      finish: "ALUZINC",
      color: "ROJO",
      thickness: "0.3",
      width: "1200",
      length: "",
      unit: "PIEZA",
      sku: "COB030ROJO",
      displayName: "COBERTURA 0.30 ROJO",
      widthMm: "1200",
    }
  }
];

testCases.forEach(tc => {
  console.log(`\nTesting: ${tc.name}`);
  const res = addMetallicProductFormSchema.safeParse(tc.data);
  if (!res.success) {
    console.log("  => FAILED:", res.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
  } else {
    console.log("  => SUCCESS");
  }
});
