import { readFileSync } from "fs";
import path from "path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";

export async function makeRulesEnv(projectId: string): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
}

export const UID = {
  admin: "u-admin",
  supervisor: "u-super",
  operator: "u-oper",
  noRole: "u-norole",
  junk: "u-junk",
} as const;

export const asAdmin = (env: RulesTestEnvironment): Firestore =>
  env.authenticatedContext(UID.admin, { role: "ADMIN" }).firestore();
export const asSupervisor = (env: RulesTestEnvironment): Firestore =>
  env.authenticatedContext(UID.supervisor, { role: "SUPERVISOR" }).firestore();
export const asOperator = (env: RulesTestEnvironment): Firestore =>
  env.authenticatedContext(UID.operator, { role: "OPERATOR" }).firestore();
export const asNoRole = (env: RulesTestEnvironment): Firestore =>
  env.authenticatedContext(UID.noRole, {}).firestore();
export const asJunkRole = (env: RulesTestEnvironment): Firestore =>
  env.authenticatedContext(UID.junk, { role: "NO_EXISTE_XYZ" }).firestore();
export const asAnon = (env: RulesTestEnvironment): Firestore =>
  env.unauthenticatedContext().firestore();
