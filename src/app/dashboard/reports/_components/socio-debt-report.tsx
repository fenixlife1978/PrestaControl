

"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useCarteraData } from '../hooks/use-cartera-data';

export function SocioDebtReport() {
  const [searchQuery, setSearchQuery] = useState("");
  const { partnersDebt, grandTotals, isLoading } = useCarteraData();

  const filteredData = useMemo(() => {
    if (!partnersDebt) return [];
    if (!searchQuery) return partnersDebt;
    return partnersDebt.filter(p =>
      p.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [partnersDebt, searchQuery]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const generationDate = new Date();
    
    doc.setFontSize(18);
    doc.text("Reporte de Deuda Consolidada por Socio", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(generationDate, "dd/MM/yyyy HH:mm:ss", { locale: es })}`, 14, 30);
    
    const tableColumn = ["Socio", "Deuda Vencida", "Deuda Futura", "Deuda Total"];
    const tableRows = filteredData.map(p => [
        p.partnerName,
        formatCurrency(p.totalOverdue),
        formatCurrency(p.totalFuture),
        formatCurrency(p.totalDebt)
    ]);

    const totalRow = [
      { content: 'Totales Generales', colSpan: 1, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(grandTotals.overdue), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(grandTotals.future), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(grandTotals.total), styles: { fontStyle: 'bold', halign: 'right' } },
    ];
    tableRows.push(totalRow as any);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [36, 53, 91] },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' }
        }
    });
    
    doc.save(`reporte_deuda_por_socio_${format(generationDate, "yyyy-MM-dd")}.pdf`);
  };

  if (isLoading) {
    return <p>Calculando reporte...</p>;
  }

  return (
    <Card>
        <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                     <CardTitle>Reporte de Deuda Consolidada por Socio</CardTitle>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                     <div className="relative w-full sm:w-64">
                         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                         <Input
                            type="search"
                            placeholder="Buscar socio..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                         />
                     </div>
                     <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredData.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" /> Exportar
                    </Button>
                </div>
             </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Socio</TableHead>
                        <TableHead className="text-right text-destructive">Deuda Vencida</TableHead>
                        <TableHead className="text-right text-green-600">Deuda Futura</TableHead>
                        <TableHead className="text-right font-bold">Deuda Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length > 0 ? (
                        filteredData.map(p => (
                            <TableRow key={p.partnerId}>
                                <TableCell className="font-medium">{p.partnerName}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.totalOverdue)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.totalFuture)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(p.totalDebt)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">No se encontraron socios con deudas.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                {filteredData.length > 0 && grandTotals && (
                    <TableFooter>
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell className="text-right">Totales</TableCell>
                            <TableCell className="text-right text-destructive">{formatCurrency(grandTotals.overdue)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(grandTotals.future)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(grandTotals.total)}</TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
        </CardContent>
    </Card>
  );
}
