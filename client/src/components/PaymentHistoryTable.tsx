import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Download, Banknote } from "lucide-react";
import { format } from "date-fns";

interface Payment {
  id: number;
  amount: string;
  currency: string;
  status: string;
  createdAt: Date;
  courseTitle: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  paymentMethodType?: "card" | "ach";
  paymentMethodLast4?: string | null;
}

interface PaymentHistoryTableProps {
  payments: Payment[];
}

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'succeeded':
      case 'completed':
        return 'secondary';
      case 'pending':
        return 'default';
      case 'failed':
      case 'refunded':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatAmount = (amount: string, currency: string) => {
    const numAmount = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(numAmount);
  };

  const getPaymentMethodIcon = (type?: "card" | "ach") => {
    if (type === "ach") return <Banknote className="h-4 w-4" />;
    return <CreditCard className="h-4 w-4" />;
  };

  const getItemLabel = (payment: Payment) => {
    const student = [payment.studentFirstName, payment.studentLastName].filter(Boolean).join(" ");
    if (payment.courseTitle && student) return `${payment.courseTitle} – ${student}`;
    if (payment.courseTitle) return payment.courseTitle;
    if (student) return student;
    return "Session";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payment history yet
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {getItemLabel(payment)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatAmount(payment.amount, payment.currency)}
                        <Badge variant={getStatusVariant(payment.status)} className="capitalize">
                          {payment.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getPaymentMethodIcon(payment.paymentMethodType)}
                        {payment.paymentMethodType === "ach" ? (
                          <Badge variant="outline">ACH</Badge>
                        ) : (
                          <span>{payment.paymentMethodLast4 ? `•••• ${payment.paymentMethodLast4}` : "Card"}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild aria-label="Download receipt">
                        <a href={`/api/pdf/receipt/${payment.id}`} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
