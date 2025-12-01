
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import QRCode from 'qrcode';

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

type Loan = {
  id: string;
  partnerId: string;
  amount: number;
  loanType: "estandar" | "personalizado";
  interestRate?: string;
  installments?: string;
  startDate: { seconds: number, nanoseconds: number };
  hasInterest?: boolean;
  paymentType?: "cuotas" | "libre";
  interestType?: "porcentaje" | "fijo";
  customInterest?: string;
  customInstallments?: string;
};


type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
} | null;

type InstallmentPaid = {
    loanId: string;
    installmentNumber: number;
    amount: number;
}

export type PaymentReceiptData = {
    receiptNumber: number;
    paymentDate: Date;
    partner: Partner;
    installmentsPaid: InstallmentPaid[];
    totalPaid: number;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
};


export async function generatePaymentReceipt(receiptData: PaymentReceiptData, allLoans: Loan[], companySettings: CompanySettings) {
    const doc = new jsPDF();
    const emissionDate = new Date();
    const { receiptNumber, paymentDate, partner, installmentsPaid, totalPaid } = receiptData;
    const receiptNumberStr = String(receiptNumber).padStart(8, '0');
    const pageCenter = doc.internal.pageSize.getWidth() / 2;
    const topRightX = doc.internal.pageSize.getWidth() - 15;


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
    const qrCodeData = `Socio: ${partner.firstName} ${partner.lastName}\nMonto: ${formatCurrency(totalPaid)}\nRecibo: ${receiptNumberStr}`;
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, { width: 35, margin: 1 });
    doc.addImage(qrCodeImage, 'PNG', topRightX - 35, 12, 35, 35);
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(format(emissionDate, 'dd/MM/yyyy HH:mm:ss'), topRightX, 52, { align: 'right'});
    doc.setTextColor(0);

    doc.setFontSize(22);
    doc.setTextColor(34, 197, 94); // Green color
    doc.text(`Recibo de Pago`, pageCenter, 60, { align: 'center' });
    doc.setTextColor(0, 0, 0); // Reset color
    doc.setFontSize(14);
    doc.text(`Nro. ${receiptNumberStr}`, pageCenter, 68, { align: 'center' });


    // 3. PARTNER & PAYMENT DETAILS
    doc.setLineWidth(0.5);
    doc.line(15, 78, 195, 78);

    doc.setFontSize(12);
    doc.text("Datos del Socio", 15, 86);
    doc.setFontSize(10);
    doc.text(`Nombre: ${partner.firstName} ${partner.lastName}`, 15, 93);
    doc.text(`Cédula de Identidad: ${partner.cedula || 'N/A'}`, 100, 93);

    doc.setFontSize(12);
    doc.text("Detalles del Pago", 15, 103);
    doc.setFontSize(10);
    doc.text(`Monto Total Pagado: ${formatCurrency(totalPaid)}`, 15, 110);
    doc.text(`Fecha Efectiva del Pago: ${format(paymentDate, "dd/MM/yyyy")}`, 100, 110);
    
    // 4. INSTALLMENTS PAID
    const tableColumn = ["# Cuota", "Vencimiento Original", "Capital", "Interés", "Monto Pagado"];
    const tableRows: any[][] = [];

    installmentsPaid.forEach(p => {
        const loan = allLoans.find(l => l.id === p.loanId);
        let capital = 0;
        let interest = 0;
        let dueDate = null;

        if (loan) {
            const loanStartDate = new Date(loan.startDate.seconds * 1000);
            dueDate = addMonths(loanStartDate, p.installmentNumber);
            const principalAmount = loan.amount;

            if (loan.loanType === 'estandar' && loan.installments && loan.interestRate) {
                const installmentsCount = parseInt(loan.installments, 10);
                const principalPerInstallment = installmentsCount > 0 ? principalAmount / installmentsCount : 0;
                const monthlyInterestRate = parseFloat(loan.interestRate) / 100;
                let outstandingBalance = principalAmount;
                for (let j = 1; j < p.installmentNumber; j++) {
                    outstandingBalance -= principalPerInstallment;
                }
                interest = Math.round(outstandingBalance * monthlyInterestRate);
                capital = Math.round(principalPerInstallment);
            } else if (loan.loanType === 'personalizado' && loan.paymentType === 'cuotas' && loan.customInstallments) {
                 const installmentsCount = parseInt(loan.customInstallments, 10);
                 capital = installmentsCount > 0 ? Math.round(principalAmount / installmentsCount) : 0;
                 if(loan.hasInterest && loan.customInterest) {
                    const customInterestValue = parseFloat(loan.customInterest);
                    if(loan.interestType === 'porcentaje') {
                        interest = Math.round((principalAmount * (customInterestValue / 100)) / installmentsCount);
                    } else { // 'fijo'
                        interest = Math.round(customInterestValue / installmentsCount);
                    }
                }
            } else {
                capital = p.amount;
            }
        } else {
             capital = p.amount;
        }

        const row = [
            p.installmentNumber,
            dueDate ? format(dueDate, "dd/MM/yyyy") : 'N/A',
            formatCurrency(capital),
            formatCurrency(interest),
            formatCurrency(p.amount),
        ];
        tableRows.push(row);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 120,
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        }
    });

    // 5. FOOTER & SIGNATURES
    const finalY = (doc as any).autoTable.previous.finalY || 150;
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
    doc.save(`recibo_pago_${receiptNumberStr}_${partner.lastName}.pdf`);
}
