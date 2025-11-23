
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

export default function PaymentsPage() {
  return (
    <Tabs defaultValue="installments">
      <TabsList className="grid w-full grid-cols-1">
        <TabsTrigger value="installments">Cuotas por Cobrar</TabsTrigger>
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
    </Tabs>
  );
}
