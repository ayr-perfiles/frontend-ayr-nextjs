const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ayrsteel-test' });
const db = admin.firestore();

async function checkFinishes() {
  const snapshot = await db.collection('coil_finishes').get();
  if (snapshot.empty) {
    console.log('No finishes found in ayrsteel-test. Seeding GALV...');
    await db.collection('coil_finishes').doc('GALV').set({
      label: 'Galvanizado',
      densityFactor: 7.85,
      lines: ['drywall', 'metallic-roofing']
    });
    console.log('GALV seeded successfully with densityFactor 7.85.');
  } else {
    let galvFound = false;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log(`Finish: ${doc.id}, densityFactor: ${data.densityFactor}`);
      if (doc.id === 'GALV' && data.densityFactor) galvFound = true;
    }
    if (!galvFound) {
      console.log('GALV not found or missing densityFactor, seeding now...');
      await db.collection('coil_finishes').doc('GALV').set({
        label: 'Galvanizado',
        densityFactor: 7.85,
        lines: ['drywall', 'metallic-roofing']
      }, { merge: true });
      console.log('GALV updated.');
    }
  }
}
checkFinishes().catch(console.error);
