"use client";

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

// Use a global variable to store the initialized services.
// This is safe in the context of Next.js app directory.
let firebaseServices: FirebaseServices | null = null;

function initializeFirebase(): FirebaseServices {
  // If the services are already initialized, return them.
  if (firebaseServices) {
    return firebaseServices;
  }

  // Get the app instance. If it doesn't exist, initialize it.
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  // Store the services in the global variable.
  firebaseServices = { app, auth, firestore };

  return firebaseServices;
}

const useFirebaseApp = () => useFirebase().app;
const useAuth = () => useFirebase().auth;
const useFirestore = () => useFirebase().firestore;

export { initializeFirebase, useFirebase, useFirebaseApp, useAuth, useFirestore };
