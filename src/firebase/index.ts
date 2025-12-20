
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

// Singleton pattern to ensure Firebase is initialized only once
let firebaseServices: FirebaseServices | null = null;

export function initializeFirebase(): FirebaseServices {
	if (typeof window === 'undefined') {
		// On the server, we don't want to initialize Firebase client SDK
		// This is a safeguard, as most of our usage is client-side.
		// A more robust solution might involve different entry points for server/client.
		if (firebaseServices) return firebaseServices; // Return if already created
		const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
		const auth = getAuth(app);
		const firestore = getFirestore(app);
		firebaseServices = { app, auth, firestore };
		return firebaseServices;
	}

	if (!firebaseServices) {
		const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
		const auth = getAuth(app);
		const firestore = getFirestore(app);
		firebaseServices = { app, auth, firestore };
	}

	return firebaseServices;
}

// Custom hooks to be used in components
const useFirebaseApp = () => useFirebase().app;
const useAuth = () => useFirebase().auth;
const useFirestore = () => useFirebase().firestore;

// Exporting hooks and the main provider hook
export { useFirebase, useFirebaseApp, useAuth, useFirestore };
