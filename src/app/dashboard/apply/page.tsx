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
  amount: z.coerce.number().positive("Amount must be positive."),
  purpose: z.string().min(10, "Please provide a more detailed purpose."),
  repaymentTerm: z.string({
    required_error: "Please select a repayment term.",
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
      title: "Application Submitted!",
      description: "We have received your loan application and will review it shortly.",
    });
    console.log(data);
    form.reset();
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
            <CardTitle>Loan Application</CardTitle>
            <CardDescription>Fill out the form below to apply for a new loan.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Loan Amount</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="e.g., 5000" {...field} />
                    </FormControl>
                    <FormDescription>
                        How much money would you like to borrow?
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
                    <FormLabel>Purpose of Loan</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="e.g., To finance a new car purchase..."
                        {...field}
                        />
                    </FormControl>
                    <FormDescription>
                        Briefly describe why you need this loan.
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
                    <FormLabel>Repayment Term</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a repayment term" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="6 Months">6 Months</SelectItem>
                        <SelectItem value="12 Months">12 Months</SelectItem>
                        <SelectItem value="24 Months">24 Months</SelectItem>
                        <SelectItem value="36 Months">36 Months</SelectItem>
                        <SelectItem value="48 Months">48 Months</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription>
                        How long do you need to repay the loan?
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit">Submit Application</Button>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
