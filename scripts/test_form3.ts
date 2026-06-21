import { addMetallicProductFormSchema } from "../src/modules/metallic-roofing/schemas/catalog";

const formValues = {
  family: "BOBINA", // This will fail because we removed it from enum
  finish: "ALUZINC",
  color: "",
  thickness: "0.45",
  width: "1200",
  length: "",
  unit: "KILOGRAMO",
  sku: "BOB045ALZ",
  displayName: "BOBINA ALUZINC 0.45MM X 1200",
  widthMm: "1200",
};

const res = addMetallicProductFormSchema.safeParse(formValues);
console.log(JSON.stringify(res.error?.format() || "SUCCESS", null, 2));
