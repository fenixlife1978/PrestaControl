
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
import { CuotasPorCobrar } from "./_components/cuotas-por-cobrar";
import { AbonosVencidos } from "./_components/abonos-vencidos";

export default function PaymentsPage() {
  return (
    <Tabs defaultValue="installments">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="installments">Cuotas del Mes</TabsTrigger>
        <TabsTrigger value="overdue">Abonos Vencidos</TabsTrigger>
      </TabsList>
      <TabsContent value="installments">
        <Card>
          <CardHeader>
            <CardTitle>Cuotas por Cobrar</CardTitle>
            <CardDescription>
              Seleccione un mes y año para ver las cuotas con vencimiento en ese período.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CuotasPorCobrar />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="overdue">
        <Card>
            <CardHeader>
                <CardTitle>Abonos Vencidos</CardTitle>
                <CardDescription>
                    Lista de socios con cuotas pendientes de pago de meses anteriores.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AbonosVencidos />
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
