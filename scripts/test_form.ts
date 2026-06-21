import { addMetallicProductFormSchema } from "../src/modules/metallic-roofing/schemas/catalog";

const product1 = {
  family: "COBERTURA",
  finish: "ALUZINC",
  color: "RRR",
  thickness: "0.3",
  width: "1200",
  length: "",
  unit: "METRO",
  sku: "COB030ROJO",
  displayName: "COBERTURA 0.30 ROJO",
  widthMm: "1200",
};

const product2 = {
  family: "BOBINA", // A product with family BOBINA (now removed from enum)
  finish: "NATURAL",
  color: "",
  thickness: "0.45",
  width: "1200",
  length: "",
  unit: "KILOGRAMO",
  sku: "BOB045NAT",
  displayName: "BOBINA 0.45 NATURAL",
  widthMm: "1200",
};

console.log("Testing product 1 (COB030ROJO):");
const res1 = addMetallicProductFormSchema.safeParse(product1);
if (!res1.success) {
  console.log("ERRORS:", JSON.stringify(res1.error.format(), null, 2));
} else {
  console.log("SUCCESS");
}

console.log("\nTesting product 2 (BOBINA family):");
const res2 = addMetallicProductFormSchema.safeParse(product2);
if (!res2.success) {
  console.log("ERRORS:", JSON.stringify(res2.error.format(), null, 2));
} else {
  console.log("SUCCESS");
}
