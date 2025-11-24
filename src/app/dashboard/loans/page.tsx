
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AddLoanTab } from "./_components/add-loan-tab";
import { LoanHistoryTab } from "./_components/loan-history-tab";


export default function LoansPage() {
  return (
    <Tabs defaultValue="history">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="add">Añadir Préstamo</TabsTrigger>
        <TabsTrigger value="history">Historial de Préstamos</TabsTrigger>
      </TabsList>
      <TabsContent value="add">
        <Card>
          <CardHeader>
            <CardTitle>Añadir Nuevo Préstamo</CardTitle>
            <CardDescription>
              Busque un socio y complete el formulario para registrar un nuevo préstamo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddLoanTab />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="history">
        <LoanHistoryTab />
      </TabsContent>
    </Tabs>
  );
}

