import { NextResponse } from 'next/server';
import { initAdmin } from "@/lib/firebase/adminApp";

/**
 * GET /api/scripts/migrate-roles
 * Migra roles de Firestore a Custom Claims de Auth.
 */
export async function GET() {
  try {
    const adminApp = initAdmin();
    const db = adminApp.firestore();
    const auth = adminApp.auth();

    const usersSnapshot = await db.collection("users").get();
    const totalUsers = usersSnapshot.size;

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const details = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;
      const role = userData.role;
      const email = userData.email || "email desconocido";

      if (!role) {
        skippedCount++;
        continue;
      }

      const validRoles = ["ADMIN", "SUPERVISOR", "OPERATOR"];
      if (!validRoles.includes(role)) {
        skippedCount++;
        continue;
      }

      try {
        await auth.setCustomUserClaims(uid, { role });
        successCount++;
        details.push(`✅ ${email} -> ${role}`);
      } catch (err: any) {
        errorCount++;
        details.push(`❌ ${email}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: "Migración de roles completada.",
      summary: {
        total: totalUsers,
        success: successCount,
        skipped: skippedCount,
        errors: errorCount
      },
      details
    });
  } catch (error: any) {
    console.error("[API Migrate Roles]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
