
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { addMonths } from "date-fns";
import QRCode from 'qrcode';
import { Timestamp } from "firebase/firestore";

import type { Loan } from "../types";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
  cedula?: string;
};

type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
} | null;

type Installment = {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
  balance: number;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
};

// Helper function to safely convert a date, whether it's a Timestamp or a JS Date
const safeGetDate = (date: Date | Timestamp): Date => {
    if (date instanceof Timestamp) {
        return date.toDate();
    }
    return date;
}

const calculatePaymentPlan = (loanData: Loan): Installment[] => {
    const plan: Installment[] = [];
    if (!loanData) return plan;

    const principalAmount = loanData.amount;
    const startDate = safeGetDate(loanData.startDate);
    
    if (loanData.loanType === 'estandar' && loanData.installments && loanData.interestRate) {
        const installmentsCount = parseInt(loanData.installments, 10);
        if (installmentsCount <= 0) return [];
        const monthlyInterestRate = parseFloat(loanData.interestRate) / 100;
        const principalPerInstallment = principalAmount / installmentsCount;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
          const interestForMonth = outstandingBalance * monthlyInterestRate;
          const roundedPrincipal = Math.round(principalPerInstallment);
          const roundedInterest = Math.round(interestForMonth);
          const totalPayment = roundedPrincipal + roundedInterest;
          const dueDate = addMonths(startDate, i);
          
          outstandingBalance -= principalPerInstallment;
          
          plan.push({
            installmentNumber: i,
            dueDate: format(dueDate, "dd/MM/yyyy"),
            principal: roundedPrincipal,
            interest: roundedInterest,
            total: totalPayment,
            balance: Math.round(outstandingBalance < 0.01 ? 0 : outstandingBalance),
          });
        }
    } else if (loanData.loanType === 'personalizado' && loanData.paymentType === 'cuotas' && loanData.customInstallments) {
        const installmentsCount = parseInt(loanData.customInstallments, 10);
        if (installmentsCount <= 0) return [];

        const principalPerInstallment = principalAmount / installmentsCount;
        let interestPerInstallment = 0;

        if(loanData.hasInterest && loanData.customInterest) {
            const customInterestValue = parseFloat(loanData.customInterest);
            if(loanData.interestType === 'porcentaje') {
                interestPerInstallment = (principalAmount * (customInterestValue / 100)) / installmentsCount;
            } else { 
                interestPerInstallment = customInterestValue / installmentsCount;
            }
        }
        
        const roundedPrincipal = Math.round(principalPerInstallment);
        const roundedInterest = Math.round(interestPerInstallment);
        const totalPerInstallment = roundedPrincipal + roundedInterest;
        let outstandingBalance = principalAmount;

        for (let i = 1; i <= installmentsCount; i++) {
            outstandingBalance -= principalPerInstallment;
            const dueDate = addMonths(startDate, i);
            
            plan.push({
                installmentNumber: i,
                dueDate: format(dueDate, "dd/MM/yyyy"),
                principal: roundedPrincipal,
                interest: roundedInterest,
                total: totalPerInstallment,
                balance: Math.round(outstandingBalance < 0.01 ? 0 : outstandingBalance),
            });
        }
    }

    return plan;
};


export async function generateLoanReceipt(loan: Loan, partner: Partner, companySettings: CompanySettings) {
    const doc = new jsPDF();
    const emissionDate = new Date();
    const loanNumberStr = String(loan.loanNumber).padStart(6, '0');
    const pageCenter = doc.internal.pageSize.getWidth() / 2;

    // 1. HEADER
    if (companySettings?.logoUrl) {
        try {
            const response = await fetch(companySettings.logoUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            await new Promise<void>(resolve => {
                reader.onloadend = () => {
                    doc.addImage(reader.result as string, 'PNG', 15, 12, 30, 15);
                    resolve();
                };
            });
        } catch (e) {
            console.error("Error loading company logo:", e);
        }
    }
    doc.setFontSize(9);
    doc.text(companySettings?.name || '', pageCenter, 15, { align: 'center'});
    doc.text(companySettings?.rif || '', pageCenter, 20, { align: 'center'});
    doc.text(companySettings?.address || '', pageCenter, 25, { align: 'center'});
    doc.text(companySettings?.phone || '', pageCenter, 30, { align: 'center'});

    // 2. RECEIPT NUMBER & QR CODE
    const qrCodeData = `Socio: ${partner.firstName} ${partner.lastName}\nCédula: ${partner.cedula}\nMonto: ${formatCurrency(loan.amount)}\nRecibo: ${loanNumberStr}`;
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, { width: 35 });
    doc.addImage(qrCodeImage, 'PNG', 160, 12, 35, 35);
    
    doc.setFontSize(22);
    doc.setTextColor(255, 0, 0); // Red color
    doc.text(`Recibo de Préstamo Nro. ${loanNumberStr}`, 15, 55);
    doc.setTextColor(0, 0, 0); // Reset color
    
    doc.setFontSize(10);
    doc.text(`Fecha de Emisión: ${format(emissionDate, 'dd/MM/yyyy HH:mm:ss')}`, 15, 62);


    // 3. PARTNER & LOAN DETAILS
    doc.setLineWidth(0.5);
    doc.line(15, 70, 195, 70);

    doc.setFontSize(12);
    doc.text("Datos del Socio", 15, 78);
    doc.setFontSize(10);
    doc.text(`Nombre: ${partner.firstName} ${partner.lastName}`, 15, 85);
    doc.text(`Cédula de Identidad: ${partner.cedula || 'N/A'}`, 100, 85);

    doc.setFontSize(12);
    doc.text("Detalles del Préstamo", 15, 95);
    doc.setFontSize(10);
    doc.text(`Monto del Préstamo: ${formatCurrency(loan.amount)}`, 15, 102);
    doc.text(`Fecha de Inicio: ${format(safeGetDate(loan.startDate), "dd/MM/yyyy")}`, 100, 102);
    doc.text(`Tipo de Préstamo: ${loan.loanType.charAt(0).toUpperCase() + loan.loanType.slice(1)}`, 15, 109);
    
    let loanDetailsText = "";
    if (loan.loanType === 'estandar') {
      loanDetailsText = `Interés: ${loan.interestRate}% (Sistema Alemán), Plazo: ${loan.installments} cuotas`;
    } else {
      loanDetailsText = `Modalidad: ${loan.paymentType}, Interés: ${loan.hasInterest ? (loan.interestType === 'porcentaje' ? `${loan.customInterest}%` : `${formatCurrency(parseFloat(loan.customInterest || '0'))}`) : 'No Aplica'}`;
    }
    doc.text(`Condiciones: ${loanDetailsText}`, 15, 116);

    // 4. PAYMENT PLAN
    const paymentPlan = calculatePaymentPlan(loan);
    if (paymentPlan.length > 0) {
        const tableColumn = ["# Cuota", "Fecha Venc.", "Capital", "Interés", "Total Cuota", "Saldo Pendiente"];
        const tableRows: any[][] = [];

        paymentPlan.forEach(p => {
            const row = [
                p.installmentNumber,
                p.dueDate,
                formatCurrency(p.principal),
                formatCurrency(p.interest),
                formatCurrency(p.total),
                formatCurrency(p.balance),
            ];
            tableRows.push(row);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 125,
            headStyles: { fillColor: [36, 53, 91] }, // --primary color
            styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
            }
        });
    } else {
        doc.text("Este préstamo no tiene un plan de pagos por cuotas (modalidad de abono libre).", 15, 130);
    }
    

    // 5. FOOTER & SIGNATURES
    const finalY = (doc as any).autoTable.previous.finalY || (paymentPlan.length > 0 ? 170 : 140);
    const signatureY = finalY + 40;

    doc.setLineWidth(0.2);
    doc.line(30, signatureY, 90, signatureY); // Socio Signature Line
    doc.text("Recibí Conforme", 60, signatureY + 5, { align: 'center' });
    doc.text(`${partner.firstName} ${partner.lastName}`, 60, signatureY + 10, { align: 'center' });
    doc.text(`C.I: ${partner.cedula}`, 60, signatureY + 15, { align: 'center' });


    doc.line(120, signatureY, 180, signatureY); // Empresa Signature Line
    doc.text("Firma y Sello", 150, signatureY + 5, { align: 'center' });
    doc.text(companySettings?.name || 'La Empresa', 150, signatureY + 10, { align: 'center' });
    doc.text('Autorizado', 150, signatureY + 15, { align: 'center' });

    // SAVE PDF
    doc.save(`recibo_prestamo_${loanNumberStr}_${partner.lastName}.pdf`);
}
