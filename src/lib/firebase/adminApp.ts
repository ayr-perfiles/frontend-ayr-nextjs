import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Inicialización segura de Firebase Admin en el servidor (Next.js API Routes)
 */
export function initAdmin() {
  if (admin.apps.length > 0) return admin;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ayr-erp';

  // 1. Intentar cargar desde variable de entorno (JSON string)
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountVar) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountVar)),
      projectId
    });
    return admin;
  }

  // 2. En desarrollo, intentar cargar desde archivo local si existe
  if (process.env.NODE_ENV === 'development') {
    const localKeyPath = path.join(process.cwd(), 'serviceAccount.json');
    if (fs.existsSync(localKeyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId
      });
      console.log("🔐 Firebase Admin inicializado usando serviceAccount.json local");
      return admin;
    }
  }

  // 3. Fallback: Usar credenciales por defecto (útil en entornos GCP/Firebase Hosting)
  // O inicialización simple para que los emuladores detecten el Project ID
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId
    });
  } catch (e) {
    // Si falla ADC, inicializar solo con Project ID (último recurso para emuladores)
    admin.initializeApp({
      projectId
    });
  }
  
  return admin;
}
