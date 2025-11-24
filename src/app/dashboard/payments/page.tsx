
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
import { PagarLibreAbono } from "./_components/pagar-libre-abono";

export default function PaymentsPage() {
  return (
    <Tabs defaultValue="installments">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
        <TabsTrigger value="installments">Cuotas del Mes</TabsTrigger>
        <TabsTrigger value="overdue">Cuotas sin pagar (Vencidas)</TabsTrigger>
        <TabsTrigger value="free-payment">Pagar Libre Abono</TabsTrigger>
      </TabsList>
      <TabsContent value="installments">
        <Card>
          <CardHeader>
            <CardTitle>Cuotas por Cobrar</CardTitle>
            <CardDescription>
              Seleccione un mes y año para ver las cuotas con vencimiento en ese período. Puede registrar pagos o realizar el cierre del mes.
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
                <CardTitle>Cuotas sin pagar (Vencidas)</CardTitle>
                <CardDescription>
                    Lista de socios con cuotas pendientes de pago de meses que ya han sido cerrados.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AbonosVencidos />
            </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="free-payment">
        <Card>
            <CardHeader>
                <CardTitle>Abono a Préstamos de Modalidad Libre</CardTitle>
                <CardDescription>
                    Busque un socio para registrar un abono parcial o el pago total de un préstamo con modalidad de pago libre.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <PagarLibreAbono />
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
