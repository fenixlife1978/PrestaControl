import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PaymentsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos</CardTitle>
        <CardDescription>
          Aquí puede gestionar y revisar todos los pagos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>El contenido del módulo de pagos estará disponible aquí.</p>
      </CardContent>
    </Card>
  );
}
