import "server-only";

import { cookies } from "next/headers";
import { initializeServerApp, FirebaseServerApp } from "firebase/app";
import { getAuth, Auth, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

interface AuthenticatedApp {
  firebaseServerApp: FirebaseServerApp;
  currentUser: User | null;
}

export async function getAuthenticatedAppForUser(): Promise<AuthenticatedApp> {
  const cookieStore = await cookies();
  const authIdToken = cookieStore.get("__session")?.value;

  const firebaseServerApp = initializeServerApp(firebaseConfig, {
    authIdToken,
  });

  const auth: Auth = getAuth(firebaseServerApp);
  await auth.authStateReady();

  return {
    firebaseServerApp,
    currentUser: auth.currentUser,
  };
}
