"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { initializeFirebase } from "./index";
// Importamos el tipo corregido
import { FirebaseProvider, FirebaseContextType } from "./provider"; 

export const FirebaseClientProvider = ({ children }: { children: ReactNode }) => {
  const firebase = initializeFirebase();
  const { auth } = firebase;

  // Estados para el usuario y el estado de carga inicial
  // undefined al inicio, null/User después
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Suscribirse a los cambios de estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user); 
      setLoading(false); // Desactiva la carga una vez que se verifica el estado inicial
    });

    // 2. Limpiar la suscripción
    return () => unsubscribe();
  }, [auth]);

  // Mostrar un loader mientras Firebase inicializa el estado de Auth
  if (loading || currentUser === undefined) {
    // Nota: El 'currentUser === undefined' es manejado por el loading state,
    // pero lo dejamos explícito si el loader es muy rápido.
    return <div className="flex items-center justify-center min-h-screen">Cargando autenticación...</div>;
  }

  // 3. Construir el objeto de valor para el contexto
  const providerValue: FirebaseContextType = {
    ...firebase,
    currentUser: currentUser, 
    loading: false, 
  };

  return (
    <FirebaseProvider value={providerValue}> 
      {children}
    </FirebaseProvider>
  );
};