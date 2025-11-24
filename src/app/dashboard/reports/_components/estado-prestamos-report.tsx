

"use client";

import { useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, Timestamp, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Partner = {
  id: string;
  firstName: string;
  lastName: string;
};

type Loan = {
  id: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado" | "Pagado";
  loanType: "estandar" | "personalizado";
  startDate: Timestamp;
};

type CompanySettings = {
    name?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    rif?: string;
    email?: string;
}

export function EstadoPrestamosReport() {
  const firestore = useFirestore();

  const [loansCol, loadingLoans] = useCollection(firestore ? collection(firestore, "loans") : null);
  const [partnersCol, loadingPartners] = useCollection(firestore ? collection(firestore, "partners") : null);
  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loadingSettings] = useDocument(settingsRef);


  const partners: Partner[] = useMemo(
    () => partnersCol?.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner)) || [],
    [partnersCol]
  );
  
  const allLoans: Loan[] = useMemo(
    () => loansCol?.docs.map((doc) => {
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

  const companySettings: CompanySettings | null = useMemo(() => {
    return settingsDoc?.exists() ? settingsDoc.data() as CompanySettings : null
  }, [settingsDoc]);

  const { activeLoans, finishedLoans } = useMemo(() => {
    const active = allLoans.filter(loan => loan.status === 'Aprobado');
    const finished = allLoans.filter(loan => loan.status === 'Pagado');
    return { activeLoans: active, finishedLoans: finished };
  }, [allLoans]);

  const totalActiveAmount = useMemo(() => activeLoans.reduce((sum, loan) => sum + loan.amount, 0), [activeLoans]);
  const totalFinishedAmount = useMemo(() => finishedLoans.reduce((sum, loan) => sum + loan.amount, 0), [finishedLoans]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const formatDate = (date: Date) => date.toLocaleDateString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit' });

  const generatePDF = (loans: Loan[], title: string, total: number) => {
    const doc = new jsPDF();
    
    // Header
    if (companySettings?.logoUrl) {
        doc.addImage(companySettings.logoUrl, 'PNG', 14, 15, 30, 15);
    }
    doc.setFontSize(10);
    const companyInfoX = doc.internal.pageSize.getWidth() - 14;
    doc.text(companySettings?.name || '', companyInfoX, 15, { align: 'right'});
    doc.setFontSize(8);
    doc.text(companySettings?.rif || '', companyInfoX, 19, { align: 'right'});
    doc.text(companySettings?.address || '', companyInfoX, 23, { align: 'right'});
    doc.text(companySettings?.phone || '', companyInfoX, 27, { align: 'right'});
    doc.text(companySettings?.email || '', companyInfoX, 31, { align: 'right'});
    
    // Title
    doc.setFontSize(18);
    doc.text(title, 14, 45);
    
    const tableColumn = ["Socio", "Fecha Inicio", "Monto", "Tipo"];
    const tableRows: any[][] = [];

    loans.forEach(loan => {
        const rowData = [
            loan.partnerName,
            formatDate(loan.startDate.toDate()),
            formatCurrency(loan.amount),
            loan.loanType,
        ];
        tableRows.push(rowData);
    });

    const totalRow = [
      { content: 'Monto Total', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(total), styles: { fontStyle: 'bold', halign: 'right' } },
      ''
    ];
    tableRows.push(totalRow);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 55,
        headStyles: { fillColor: [36, 53, 91] },
        styles: { halign: 'left' },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'center' }
        }
    });
    
    doc.save(`${title.toLowerCase().replace(/ /g, '_')}.pdf`);
  };
  
  const isLoading = loadingLoans || loadingPartners || loadingSettings;

  if (isLoading) {
    return <p>Cargando reporte...</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Préstamos Activos</CardTitle>
                <CardDescription>Lista de todos los préstamos actualmente en curso.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => generatePDF(activeLoans, "Reporte de Préstamos Activos", totalActiveAmount)} disabled={activeLoans.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Socio</TableHead>
                        <TableHead>Fecha Inicio</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {activeLoans.length > 0 ? (
                        activeLoans.map(loan => (
                            <TableRow key={loan.id}>
                                <TableCell className="font-medium">{loan.partnerName}</TableCell>
                                <TableCell>{formatDate(loan.startDate.toDate())}</TableCell>
                                <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={3} className="text-center">No hay préstamos activos.</TableCell></TableRow>
                    )}
                </TableBody>
                 {activeLoans.length > 0 && (
                     <TableFooter>
                        <TableRow>
                            <TableCell colSpan={2} className="text-right font-bold">Total Activo</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(totalActiveAmount)}</TableCell>
                        </TableRow>
                    </TableFooter>
                )}
             </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Préstamos Finalizados</CardTitle>
                <CardDescription>Historial de préstamos que ya han sido pagados en su totalidad.</CardDescription>
            </div>
             <Button variant="outline" size="sm" onClick={() => generatePDF(finishedLoans, "Reporte de Préstamos Finalizados", totalFinishedAmount)} disabled={finishedLoans.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Socio</TableHead>
                        <TableHead>Fecha Inicio</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {finishedLoans.length > 0 ? (
                        finishedLoans.map(loan => (
                             <TableRow key={loan.id}>
                                <TableCell className="font-medium">{loan.partnerName}</TableCell>
                                <TableCell>{formatDate(loan.startDate.toDate())}</TableCell>
                                <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={3} className="text-center">No hay préstamos finalizados.</TableCell></TableRow>
                    )}
                </TableBody>
                {finishedLoans.length > 0 && (
                     <TableFooter>
                        <TableRow>
                            <TableCell colSpan={2} className="text-right font-bold">Total Finalizado</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(totalFinishedAmount)}</TableCell>
                        </TableRow>
                    </TableFooter>
                )}
             </Table>
        </CardContent>
      </Card>
    </div>
  );
}
