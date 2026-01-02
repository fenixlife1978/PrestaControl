
"use client";

import { useMemo } from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, Timestamp, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { addMonths, isPast, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";

// Types
type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
};

type Loan = {
  id: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: Timestamp;
  hasInterest?: boolean;
  paymentType?: "cuotas" | "libre";
  interestType?: "porcentaje" | "fijo";
  customInterest?: string;
  customInstallments?: string;
};

type Payment = {
  id: string;
  loanId: string;
  installmentNumber: number | null;
  amount: number;
  type: 'payment' | 'closure' | 'abono_libre';
};

export type PartnerDebt = {
  partnerId: string;
  partnerName: string;
  totalOverdue: number;
  totalFuture: number;
  totalDebt: number;
};

export type InstallmentDetail = {
    loanId: string;
    partnerName: string;
    installmentNumber: number;
    dueDate: Date;
    total: number;
    isOverdue: boolean;
};

export type LibreAbonoLoanDetail = {
    partnerName: string;
    loanId: string;
    originalAmount: number;
    remainingBalance: number;
};

export function useCarteraData() {
  const firestore = useFirestore();

  const [loansCol, loadingLoans] = useCollection(firestore ? query(collection(firestore, "loans"), where("status", "==", "Aprobado")) : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const [paymentsCol, loadingPayments] = useCollection(firestore ? collection(firestore, "payments") : null);

  const partners: Partner[] = useMemo(() => partnersCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)) || [], [partnersCol]);
  
  const activeLoans: Loan[] = useMemo(() =>
    loansCol?.docs
      .map((doc) => {
        const data = doc.data();
        const partner = partners.find(p => p.id === data.partnerId);
        return {
          id: doc.id,
          ...data,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "Desconocido",
        } as Loan;
      }) || [],
    [loansCol, partners]
  );
  
  const allPayments: Payment[] = useMemo(() => paymentsCol?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)) || [], [paymentsCol]);

  const carteraData = useMemo(() => {
    const debtMap: { [key: string]: PartnerDebt } = {};

    partners.forEach(p => {
      debtMap[p.id] = {
        partnerId: p.id,
        partnerName: `${p.firstName} ${p.lastName}`,
        totalOverdue: 0,
        totalFuture: 0,
        totalDebt: 0
      };
    });
    
    const allInstallments: InstallmentDetail[] = [];
    const allLibreAbono: LibreAbonoLoanDetail[] = [];

    activeLoans.forEach(loan => {
      const partnerDebt = debtMap[loan.partnerId];
      if (!partnerDebt) return;

      if (loan.paymentType === 'cuotas') {
        let installmentsCount = 0;
        if (loan.loanType === 'estandar' && loan.installments) {
          installmentsCount = parseInt(loan.installments, 10);
        } else if (loan.loanType === 'personalizado' && loan.customInstallments) {
          installmentsCount = parseInt(loan.customInstallments, 10);
        }

        if (installmentsCount > 0) {
          const principalAmount = loan.amount;
          const startDate = loan.startDate.toDate();

          for (let i = 1; i <= installmentsCount; i++) {
            const isPaid = allPayments.some(p => p.loanId === loan.id && p.installmentNumber === i && p.type === 'payment');
            if (isPaid) continue;

            const dueDate = addMonths(startDate, i);
            let total = 0;

            if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
              const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
              const principalPerInstallment = principalAmount / installmentsCount;
              let outstandingBalance = principalAmount;
              for (let j = 1; j < i; j++) {
                if (!allPayments.some(p => p.loanId === loan.id && p.installmentNumber === j && p.type === 'payment')) {
                   outstandingBalance -= principalPerInstallment;
                }
              }
              const interestForMonth = outstandingBalance * monthlyInterestRate;
              total = Math.round(principalPerInstallment + interestForMonth);
            } else if (loan.loanType === 'personalizado' && loan.customInstallments) {
              const principalPerInstallment = principalAmount / installmentsCount;
              let interestPerInstallment = 0;
              if (loan.hasInterest && loan.customInterest) {
                const customInterestValue = parseFloat(loan.customInterest);
                if (loan.interestType === 'porcentaje') {
                  interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
                } else {
                  interestPerInstallment = customInterestValue / installmentsCount;
                }
              }
              total = Math.round(principalPerInstallment + interestPerInstallment);
            }
            
            const installmentDetail = {
                loanId: loan.id,
                partnerName: loan.partnerName || "Desconocido",
                installmentNumber: i,
                dueDate: dueDate,
                total: total,
                isOverdue: isPast(dueDate)
            };
            allInstallments.push(installmentDetail);

            if (installmentDetail.isOverdue) {
              partnerDebt.totalOverdue += total;
            } else {
              partnerDebt.totalFuture += total;
            }
          }
        }
      } else if (loan.paymentType === 'libre') {
        const paidAmount = allPayments
          .filter(p => p.loanId === loan.id && p.type === 'abono_libre')
          .reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance = Math.round(loan.amount - paidAmount);
        
        if (remainingBalance > 0) {
            allLibreAbono.push({
                partnerName: loan.partnerName || "Desconocido",
                loanId: loan.id,
                originalAmount: loan.amount,
                remainingBalance: remainingBalance,
            });
            partnerDebt.totalFuture += remainingBalance;
        }
      }
    });

    const partnersDebtList = Object.values(debtMap)
      .map(p => ({ ...p, totalDebt: p.totalOverdue + p.totalFuture }))
      .filter(p => p.totalDebt > 0);

    const grandTotals = partnersDebtList.reduce((acc, p) => {
        acc.overdue += p.totalOverdue;
        acc.future += p.totalFuture;
        acc.total += p.totalDebt;
        return acc;
    }, { overdue: 0, future: 0, total: 0 });

    return {
      partnersDebt: partnersDebtList.sort((a, b) => b.totalDebt - a.totalDebt),
      grandTotals,
      allInstallments,
      allLibreAbono,
    };
  }, [partners, activeLoans, allPayments]);

  const isLoading = loadingLoans || loadingPartners || loadingPayments;

  return { ...carteraData, isLoading };
}
