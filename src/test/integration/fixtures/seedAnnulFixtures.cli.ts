import admin from "firebase-admin";
import { seedAnnulFixtures } from "./seedAnnulFixtures";
import serviceAccount from "../../../../serviceAccountKeyTest.json";

if ((serviceAccount as any).project_id !== "ayrsteel-test") {
  console.error("ERROR: seedAnnulFixtures.cli must run against ayrsteel-test only. Aborting.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) });
const db = admin.firestore();

(async () => {
  console.log("Seeding annul fixtures against ayrsteel-test...");
  const seeded = await seedAnnulFixtures(db);
  console.log("Seeded fixtures:", JSON.stringify(seeded, null, 2));
  process.exit(0);
})();
