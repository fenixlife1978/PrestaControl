"use client";

import { createContext, useContext, ReactNode } from "react";
import { FirebaseApp } from "firebase/app";
import { Auth, User } from "firebase/auth"; // Importamos User
import { Firestore } from "firebase/firestore";

// Tipo del Contexto, incluyendo el estado de autenticación
export interface FirebaseContextType {
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
    // Nuevo: El estado del usuario de Firebase. 
    // undefined mientras carga, User o null cuando se resuelve.
    currentUser: User | null | undefined; 
    loading: boolean;
}

// Inicialización del Contexto
const FirebaseContext = createContext<FirebaseContextType | null>(null);

export const FirebaseProvider = ({ 
    children, 
    value 
}: { 
    children: ReactNode;
    value: FirebaseContextType;
}) => {
    // Ya no necesitamos la verificación !value, ya que el contexto nunca será null.
    // Solo se debe verificar que el hook se use dentro del provider.
    return (
        <FirebaseContext.Provider value={value}>
            {children}
        </FirebaseContext.Provider>
    );
};

export function useFirebase() {
    const context = useContext(FirebaseContext);
    if (context === null) {
        throw new Error("useFirebase must be used within a FirebaseProvider");
    }
    return context;
}