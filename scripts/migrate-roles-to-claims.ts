/**
 * migrate-roles-to-claims.ts
 *
 * Lee la colección 'users' de Firestore y sincroniza el campo 'role'
 * como custom claim en Firebase Auth ({ role: "ADMIN" | "SUPERVISOR" | "OPERATOR" }).
 *
 * Requisito: variable de entorno GOOGLE_APPLICATION_CREDENTIALS apuntando
 * al JSON de la service account, o PROJECT_ID si usas Application Default Credentials.
 *
 * Uso:
 *   npx tsx scripts/migrate-roles-to-claims.ts
 *   npx tsx scripts/migrate-roles-to-claims.ts --dry-run
 */

import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VALID_ROLES = new Set(["ADMIN", "SUPERVISOR", "OPERATOR"]);
const USERS_COLLECTION = "users";
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function initAdmin(): void {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  } else if (projectId) {
    // Útil si corres con `firebase emulators:exec` o ADC configurado
    admin.initializeApp({ projectId });
  } else {
    throw new Error(
      "Configura GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_PROJECT_ID antes de correr el script."
    );
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserDoc {
  uid: string;
  role: string;
  email?: string;
  displayName?: string;
}

interface MigrationResult {
  success: UserDoc[];
  skipped: Array<{ uid: string; reason: string }>;
  failed: Array<{ uid: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function fetchUsers(): Promise<UserDoc[]> {
  const db = admin.firestore();
  const snapshot = await db.collection(USERS_COLLECTION).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      role: data.role ?? "",
      email: data.email,
      displayName: data.displayName,
    };
  });
}

async function setClaimForUser(
  user: UserDoc,
  auth: admin.auth.Auth
): Promise<void> {
  const existing = await auth.getUser(user.uid);
  const currentClaims = existing.customClaims ?? {};

  if (currentClaims.role === user.role) {
    // Claim ya está sincronizado — evitamos escritura innecesaria
    throw new SkipError(`claim ya es '${user.role}', sin cambios`);
  }

  await auth.setCustomUserClaims(user.uid, {
    ...currentClaims,
    role: user.role,
  });
}

class SkipError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SkipError";
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  initAdmin();

  const auth = admin.auth();

  console.log("=".repeat(60));
  console.log(" AYR Steel ERP — Migración de roles a custom claims");
  if (DRY_RUN) console.log(" MODO DRY-RUN: no se escribirá nada en Auth");
  console.log("=".repeat(60));

  console.log("\n[1/3] Leyendo colección 'users' desde Firestore...");
  const users = await fetchUsers();
  console.log(`      ${users.length} documentos encontrados.\n`);

  const result: MigrationResult = { success: [], skipped: [], failed: [] };
  const total = users.length;

  console.log("[2/3] Procesando usuarios...\n");

  for (let i = 0; i < total; i++) {
    const user = users[i];
    const progress = `[${String(i + 1).padStart(String(total).length, " ")}/${total}]`;
    const label = user.email ?? user.uid;

    if (!VALID_ROLES.has(user.role)) {
      const reason = user.role
        ? `role inválido: '${user.role}'`
        : "campo 'role' ausente o vacío";
      console.warn(`  ${progress} OMITIDO  ${label} — ${reason}`);
      result.skipped.push({ uid: user.uid, reason });
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${progress} [DRY-RUN] ${label} → role='${user.role}'`);
      result.success.push(user);
      continue;
    }

    try {
      await setClaimForUser(user, auth);
      console.log(`  ${progress} OK       ${label} → role='${user.role}'`);
      result.success.push(user);
    } catch (err) {
      if (err instanceof SkipError) {
        console.log(`  ${progress} SKIP     ${label} — ${err.message}`);
        result.skipped.push({ uid: user.uid, reason: err.message });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ${progress} ERROR    ${label} — ${msg}`);
        result.failed.push({ uid: user.uid, error: msg });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log("\n" + "=".repeat(60));
  console.log("[3/3] Resumen");
  console.log("=".repeat(60));
  console.log(`  Procesados : ${total}`);
  console.log(`  Exitosos   : ${result.success.length}`);
  console.log(`  Omitidos   : ${result.skipped.length}`);
  console.log(`  Errores    : ${result.failed.length}`);

  if (result.skipped.length > 0) {
    console.log("\n  Usuarios omitidos:");
    result.skipped.forEach(({ uid, reason }) =>
      console.log(`    - ${uid}: ${reason}`)
    );
  }

  if (result.failed.length > 0) {
    console.log("\n  Usuarios con error:");
    result.failed.forEach(({ uid, error }) =>
      console.log(`    - ${uid}: ${error}`)
    );
    process.exitCode = 1;
  }

  console.log("\nMigración completada.\n");
}

main().catch((err) => {
  console.error("\nError fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
