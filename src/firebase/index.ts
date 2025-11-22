import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { firebaseConfig } from "./config";
import { useFirebase } from "./provider";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

let firebaseServices: FirebaseServices | null = null;

function initializeFirebase(): FirebaseServices {
  if (typeof window === "undefined") {
    // During server-side rendering, return a dummy object or throw an error
    // For this app, we expect Firebase to be client-side only.
    // A more robust solution might involve providing mock instances for SSR.
    if (!firebaseServices) {
       firebaseServices = {} as FirebaseServices;
    }
    return firebaseServices;
  }

  if (firebaseServices) {
    return firebaseServices;
  }

  const apps = getApps();
  const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  firebaseServices = { app, auth, firestore };

  return firebaseServices;
}

const useFirebaseApp = () => useFirebase().app;
const useAuth = () => useFirebase().auth;
const useFirestore = () => useFirebase().firestore;


export { initializeFirebase, useFirebase, useFirebaseApp, useAuth, useFirestore };
