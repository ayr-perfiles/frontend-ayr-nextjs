/**
 * scripts/migrate-roles-to-claims.js
 *
 * Migra roles de Firestore a custom claims de Firebase Auth.
 *
 * USO:
 *   GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json" node scripts/migrate-roles-to-claims.js
 *
 * PREREQUISITOS:
 *   - Descargar serviceAccountKey.json desde Firebase Console
 *   - Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   - NUNCA commitear serviceAccountKey.json al repositorio
 */

import admin from "firebase-admin";
import path from "path";

// ════════════════════════════════════════════════════════════
// INICIALIZACIÓN SEGURA DE FIREBASE ADMIN
// ════════════════════════════════════════════════════════════

function initializeFirebase() {
  // Opción 1: Usar GOOGLE_APPLICATION_CREDENTIALS (variable de entorno)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log(`✅ Usando credenciales desde: ${keyPath}`);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return;
  }

  // Opción 2: Buscar serviceAccountKey.json en la raíz del proyecto
  const localKeyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  try {
    const serviceAccount = require(localKeyPath);
    console.log(`✅ Usando serviceAccountKey.json local`);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  } catch {
    // No existe el archivo local
  }

  // Opción 3: Usar FIREBASE_PROJECT_ID (solo funciona en GCP/Firebase hosting)
  if (process.env.FIREBASE_PROJECT_ID) {
    console.log(
      `✅ Usando Application Default Credentials con proyecto: ${process.env.FIREBASE_PROJECT_ID}`,
    );
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    return;
  }

  // Error: No hay credenciales disponibles
  console.error(`
❌ Error fatal: No se encontraron credenciales de Firebase.

SOLUCIONES:

1. RECOMENDADO - Usar service account key:
   a. Firebase Console → Tu proyecto → Project Settings → Service Accounts
   b. Click "Generate new private key" → Descarga el JSON
   c. Mueve el archivo a la raíz del proyecto como "serviceAccountKey.json"
   d. Agrega al .gitignore: echo "serviceAccountKey.json" >> .gitignore
   e. Corre el script: node scripts/migrate-roles-to-claims.js

2. O usa variable de entorno:
   GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json" node scripts/migrate-roles-to-claims.js

3. En Windows PowerShell:
   $env:GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
   node scripts/migrate-roles-to-claims.js
`);
  process.exit(1);
}

// ════════════════════════════════════════════════════════════
// MIGRACIÓN DE ROLES
// ════════════════════════════════════════════════════════════

async function migrateRolesToClaims() {
  initializeFirebase();

  const db = admin.firestore();
  const auth = admin.auth();

  console.log("\n🚀 Iniciando migración de roles a custom claims...\n");

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    // Obtener todos los usuarios de Firestore
    const usersSnapshot = await db.collection("users").get();
    const totalUsers = usersSnapshot.size;

    console.log(`📋 Usuarios encontrados en Firestore: ${totalUsers}\n`);

    if (totalUsers === 0) {
      console.log('⚠️  No se encontraron usuarios en la colección "users"');
      console.log(
        '   Verifica que la colección existe y tiene documentos con campo "role"',
      );
      process.exit(0);
    }

    // Procesar cada usuario
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;
      const role = userData.role;
      const email = userData.email || "email desconocido";

      // Validar que tiene un rol
      if (!role) {
        console.log(`⚠️  [SKIP] ${email} (${uid}) - No tiene campo "role"`);
        skippedCount++;
        continue;
      }

      // Validar que el rol es válido
      const validRoles = ["ADMIN", "SUPERVISOR", "OPERATOR"];
      if (!validRoles.includes(role)) {
        console.log(
          `⚠️  [SKIP] ${email} - Rol inválido: "${role}". Roles válidos: ${validRoles.join(", ")}`,
        );
        skippedCount++;
        continue;
      }

      try {
        // Verificar si el usuario existe en Firebase Auth
        await auth.getUser(uid);

        // Setear custom claim
        await auth.setCustomUserClaims(uid, { role });

        console.log(`✅ [OK] ${email} → role: ${role}`);
        successCount++;
      } catch (authError) {
        if (authError.code === "auth/user-not-found") {
          console.log(
            `❌ [ERROR] ${email} (${uid}) - Usuario no existe en Firebase Auth`,
          );
        } else {
          console.log(`❌ [ERROR] ${email} - ${authError.message}`);
        }
        errorCount++;
      }
    }

    // Resumen final
    console.log("\n" + "═".repeat(50));
    console.log("📊 RESUMEN DE MIGRACIÓN");
    console.log("═".repeat(50));
    console.log(`✅ Exitosos:  ${successCount}/${totalUsers}`);
    console.log(`⚠️  Omitidos: ${skippedCount}/${totalUsers}`);
    console.log(`❌ Errores:   ${errorCount}/${totalUsers}`);
    console.log("═".repeat(50));

    if (successCount > 0) {
      console.log(`
✅ Migración completada.

IMPORTANTE: Los custom claims NO se reflejan automáticamente en sesiones activas.
Los usuarios necesitan:
  1. Cerrar sesión y volver a iniciar sesión, o
  2. El frontend puede forzar el refresh del token:
     await auth.currentUser.getIdToken(true);

VERIFICAR en Firebase Console:
  Authentication → Users → Click en un usuario → Custom claims
  Debe mostrar: { "role": "ADMIN" } (o SUPERVISOR/OPERATOR)
`);
    }

    if (errorCount > 0) {
      console.log(`
⚠️  Hubo ${errorCount} error(es). Revisa los mensajes arriba.
Puedes correr el script nuevamente - solo procesa los que faltan.
`);
    }
  } catch (error) {
    console.error("\n❌ Error fatal durante la migración:", error.message);
    console.error("\nPosibles causas:");
    console.error("  - Permisos insuficientes en la service account");
    console.error('  - La colección "users" no existe');
    console.error("  - Problema de conexión a Firestore");
    process.exit(1);
  }

  process.exit(0);
}

// ════════════════════════════════════════════════════════════
// VERIFICACIÓN (modo --verify)
// ════════════════════════════════════════════════════════════

async function verifyClaims() {
  initializeFirebase();

  const db = admin.firestore();
  const auth = admin.auth();

  console.log("\n🔍 Verificando custom claims...\n");

  const usersSnapshot = await db.collection("users").get();

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const uid = userDoc.id;
    const email = userData.email || "email desconocido";
    const roleInFirestore = userData.role;

    try {
      const userRecord = await auth.getUser(uid);
      const claims = userRecord.customClaims;
      const roleInClaims = claims?.role;

      const match = roleInFirestore === roleInClaims;
      const status = match ? "✅" : "❌";

      console.log(`${status} ${email}`);
      console.log(
        `   Firestore: ${roleInFirestore || "N/A"} | Claims: ${roleInClaims || "N/A"}`,
      );
      if (!match) {
        console.log(`   ⚠️  DESINCRONIZADO - Correr migración`);
      }
    } catch {
      console.log(`❌ ${email} - No encontrado en Auth`);
    }
  }

  console.log("\nVerificación completada.");
  process.exit(0);
}

// ════════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.includes("--verify")) {
  verifyClaims().catch(console.error);
} else {
  migrateRolesToClaims().catch(console.error);
}
