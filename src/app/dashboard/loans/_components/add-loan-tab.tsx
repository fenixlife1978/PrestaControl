
"use client";

import { useMemo, useState } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp, updateDoc, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { AddLoanFlow } from "./add-loan-flow";
import type { Loan } from "../types";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
}

export function AddLoanTab() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [partnersCol] = useCollection(firestore ? collection(firestore, 'partners') : null);
  const partners: Partner[] = useMemo(() => partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) : [], [partnersCol]);

  // We need a key to reset the AddLoanFlow component after submission
  const [formKey, setFormKey] = useState(Date.now());

  const handleLoanSubmit = async (values: any) => {
     try {
       if (!firestore) {
         throw new Error("Firestore is not initialized");
       }
       const loanData = {
         partnerId: values.partnerId,
         amount: parseFloat(values.amount || "0"),
         startDate: Timestamp.fromDate(values.startDate),
         loanType: values.loanType,
         status: 'Aprobado',
         createdAt: serverTimestamp(),
         interestRate: values.interestRate,
         installments: values.installments,
         hasInterest: values.hasInterest,
         interestType: values.interestType,
         customInterest: values.customInterest,
         paymentType: values.paymentType,
         customInstallments: values.customInstallments,
       };
       
       await addDoc(collection(firestore, 'loans'), loanData);
       
       toast({
         title: "Préstamo añadido",
         description: "El nuevo préstamo ha sido registrado exitosamente.",
       });

       // Change the key to force re-mounting and resetting the form flow
       setFormKey(Date.now());

     } catch (e) {
       console.error("Error adding document: ", e);
       toast({
         title: "Error",
         description: "No se pudo añadir el préstamo.",
         variant: "destructive",
       });
     }
  };

  return (
    <AddLoanFlow 
        key={formKey}
        partners={partners} 
        onSubmit={handleLoanSubmit} 
        mode="add"
     />
  );
}

