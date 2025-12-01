
"use client";

import { useMemo, useState } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, addDoc, serverTimestamp, Timestamp, updateDoc, doc, runTransaction } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { AddLoanFlow } from "./add-loan-flow";
import { generateLoanReceipt } from "../utils/generate-loan-receipt";
import type { Loan } from "../types";

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
}

type CompanySettings = {
  name?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  rif?: string;
  email?: string;
}

export function AddLoanTab() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [partnersCol] = useCollection(firestore ? collection(firestore, 'partners') : null);
  const [loansCol] = useCollection(firestore ? collection(firestore, 'loans') : null);
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc] = useDocument(settingsRef);


  const partners: Partner[] = useMemo(() => partnersCol ? partnersCol.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) : [], [partnersCol]);

  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);

  // We need a key to reset the AddLoanFlow component after submission
  const [formKey, setFormKey] = useState(Date.now());

  const handleLoanSubmit = async (values: any) => {
     try {
       if (!firestore) {
         throw new Error("Firestore is not initialized");
       }
       
       const metadataRef = doc(firestore, "metadata", "loans");
       
       const newLoanRef = doc(collection(firestore, "loans"));

       await runTransaction(firestore, async (transaction) => {
          const metadataDoc = await transaction.get(metadataRef);
          const currentLoanNumber = metadataDoc.exists() ? metadataDoc.data().lastNumber || 0 : 0;
          const newLoanNumber = currentLoanNumber + 1;

          const loanData = {
            loanNumber: newLoanNumber,
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
          
          transaction.set(newLoanRef, loanData);
          transaction.set(metadataRef, { lastNumber: newLoanNumber }, { merge: true });
       });


       const partner = partners.find(p => p.id === values.partnerId);
       if (!partner) throw new Error("Partner not found for receipt generation");

       const fullLoanData = {
          id: newLoanRef.id,
          loanNumber: (await runTransaction(firestore, async t => (await t.get(metadataRef)).data()?.lastNumber)),
          partnerId: values.partnerId,
          partnerName: `${partner.firstName} ${partner.lastName}`,
          amount: parseFloat(values.amount || "0"),
          startDate: Timestamp.fromDate(values.startDate),
          loanType: values.loanType,
          status: 'Aprobado',
          createdAt: Timestamp.now(),
          ...values
       } as Loan;


       generateLoanReceipt(fullLoanData, partner, companySettings);

       toast({
         title: "Préstamo añadido y Recibo Generado",
         description: "El nuevo préstamo ha sido registrado y el recibo se está descargando.",
       });

       // Change the key to force re-mounting and resetting the form flow
       setFormKey(Date.now());

     } catch (e: any) {
       console.error("Error adding document: ", e);
       toast({
         title: "Error",
         description: e.message || "No se pudo añadir el préstamo.",
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
