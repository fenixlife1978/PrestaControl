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

let firebaseServices: FirebaseServices | null = null;

function initializeFirebase(): FirebaseServices {
	if (firebaseServices) {
		return firebaseServices;
	}

	const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
	const auth = getAuth(app);
	const firestore = getFirestore(app);

	firebaseServices = { app, auth, firestore };

	return firebaseServices;
}

const services = initializeFirebase();

const app = services.app;
const auth = services.auth;
const firestore = services.firestore;

const useFirebaseApp = () => useFirebase().app;
const useAuth = () => useFirebase().auth;
const useFirestore = () => useFirebase().firestore;

export { initializeFirebase, useFirebase, useFirebaseApp, useAuth, useFirestore, app, auth, firestore };