import { addMetallicProductFormSchema } from "../src/modules/metallic-roofing/schemas/catalog";

const formValues = {
  family: "COBERTURA",
  finish: "GALV", // Not in active metallic finish ids, but zod only checks string
  color: "RRR",
  thickness: "0.4",
  width: "1200",
  length: "",
  unit: "PIEZA",
  sku: "COB040GALV",
  displayName: "COBERTURA GALV 0.40MM X 1200",
  widthMm: "1200",
};

const res = addMetallicProductFormSchema.safeParse(formValues);
console.log(JSON.stringify(res.error?.format() || "SUCCESS", null, 2));
