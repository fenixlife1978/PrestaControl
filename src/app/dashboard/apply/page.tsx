"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const loanApplicationSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser positivo."),
  purpose: z.string().min(10, "Por favor, proporcione un propósito más detallado."),
  repaymentTerm: z.string({
    required_error: "Por favor, seleccione un plazo de amortización.",
  }),
});

type LoanApplicationFormValues = z.infer<typeof loanApplicationSchema>;

export default function ApplyPage() {
  const form = useForm<LoanApplicationFormValues>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      purpose: "",
    },
  });

  function onSubmit(data: LoanApplicationFormValues) {
    toast({
      title: "¡Solicitud Enviada!",
      description: "Hemos recibido su solicitud de préstamo y la revisaremos en breve.",
    });
    console.log(data);
    form.reset();
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
            <CardTitle>Solicitud de Préstamo</CardTitle>
            <CardDescription>Complete el siguiente formulario para solicitar un nuevo préstamo.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Monto del Préstamo</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="ej: 5000" {...field} />
                    </FormControl>
                    <FormDescription>
                        ¿Cuánto dinero le gustaría pedir prestado?
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Propósito del Préstamo</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="ej: Para financiar la compra de un coche nuevo..."
                        {...field}
                        />
                    </FormControl>
                    <FormDescription>
                        Describa brevemente por qué necesita este préstamo.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="repaymentTerm"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Plazo de Amortización</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione un plazo de amortización" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="6 Months">6 Meses</SelectItem>
                        <SelectItem value="12 Months">12 Meses</SelectItem>
                        <SelectItem value="24 Months">24 Meses</SelectItem>
                        <SelectItem value="36 Months">36 Meses</SelectItem>
                        <SelectItem value="48 Months">48 Meses</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription>
                        ¿En cuánto tiempo necesita pagar el préstamo?
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit">Enviar Solicitud</Button>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
