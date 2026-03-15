import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CreditCard, ChevronUp, ChevronDown, ExternalLink, Users } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { LOGIN_PATH } from "@/const";

function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default function ParentPayments() {
  const { user, isAuthenticated, loading } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: invoices, isLoading } = trpc.payment.getStripeInvoices.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 mt-20 max-w-4xl">
        <h1 className="text-3xl font-bold">Billing History</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-48 mb-3" />
                  <Skeleton className="h-4 w-64 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No invoices yet</p>
              <p className="text-sm mt-1">Enroll in a course to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {invoices.map(inv => {
              const isPaid = inv.status === "paid";
              const isUpcoming = inv.status === "upcoming";
              const isOpen = expanded[inv.id] ?? false;
              const invoiceDate = inv.created ? new Date(inv.created * 1000) : new Date();
              const periodStartDate = inv.periodStart ? new Date(inv.periodStart * 1000) : invoiceDate;
              const billingPeriod = format(periodStartDate, "MMMM yyyy");

              return (
                <div
                  key={inv.id}
                  className={`rounded-xl border bg-card overflow-hidden border-l-4 ${
                    isPaid ? "border-l-green-500" : isUpcoming ? "border-l-blue-400" : "border-l-amber-400"
                  }`}
                >
                  {/* Invoice Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Left: date + period + students */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded px-2 py-0.5">
                            {isUpcoming ? "Next Billing Date" : "Invoice Date"}
                          </span>
                          <span className="text-xl font-bold">
                            {format(invoiceDate, "MMMM d, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{billingPeriod}</p>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
                          {inv.lines.length > 1 ? (
                            <>
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-medium text-foreground">{inv.lines.length} courses</span>
                            </>
                          ) : inv.courseTitle ? (
                            <>
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-medium text-foreground">{inv.courseTitle}</span>
                              {inv.studentName && (
                                <>
                                  <span>·</span>
                                  <span>{inv.studentName}</span>
                                </>
                              )}
                              {inv.paymentNumber != null && inv.totalPayments != null && (
                                <>
                                  <span>·</span>
                                  <span>Payment {inv.paymentNumber} of {inv.totalPayments}</span>
                                </>
                              )}
                            </>
                          ) : inv.lines[0]?.courseTitle ? (
                            <>
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-medium text-foreground">{inv.lines[0].courseTitle}</span>
                              {inv.lines[0].studentName && (
                                <>
                                  <span>·</span>
                                  <span>{inv.lines[0].studentName}</span>
                                </>
                              )}
                              {inv.lines[0].paymentNumber != null && inv.lines[0].totalPayments != null && (
                                <>
                                  <span>·</span>
                                  <span>Payment {inv.lines[0].paymentNumber} of {inv.lines[0].totalPayments}</span>
                                </>
                              )}
                            </>
                          ) : null}
                        </div>
                        {isPaid && (
                          <p className="text-sm text-green-600 font-medium">
                            ✓ Paid {format(invoiceDate, "MMM d, yyyy")}
                          </p>
                        )}
                        {isUpcoming && (
                          <p className="text-sm text-blue-600 font-medium">
                            ⏳ Scheduled — will be charged on {format(invoiceDate, "MMM d, yyyy")}
                          </p>
                        )}
                      </div>

                      {/* Right: amount + status + actions */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-2xl font-bold">
                          {formatCents(isPaid ? inv.amountPaid : inv.amountDue, inv.currency)}
                        </span>
                        <Badge
                          className={
                            isPaid
                              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200"
                              : isUpcoming
                              ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200"
                              : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200"
                          }
                          variant="outline"
                        >
                          {isPaid ? "● Paid" : isUpcoming ? "● Upcoming" : "● Pending"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpanded(inv.id)}
                          className="gap-1"
                        >
                          {isOpen ? (
                            <><ChevronUp className="h-4 w-4" /> Hide</>
                          ) : (
                            <><ChevronDown className="h-4 w-4" /> Show</>
                          )}
                        </Button>
                        {!isUpcoming && inv.hostedInvoiceUrl && (
                          <Button
                            size="sm"
                            onClick={() => window.open(inv.hostedInvoiceUrl!, "_blank")}
                            className="gap-1.5"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View Invoice
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Line Items */}
                  {isOpen && (
                    <>
                      <Separator />
                      <div className="px-5 py-3 space-y-0">
                        {inv.lines.map((line, idx) => {
                          const lineCourse = line.courseTitle ?? inv.courseTitle;
                          const lineStudent = line.studentName ?? inv.studentName;
                          const linePayNum = line.paymentNumber ?? inv.paymentNumber;
                          const lineTotalPay = line.totalPayments ?? inv.totalPayments;
                          return (
                            <div key={line.id}>
                              <div className="flex items-start justify-between py-3">
                                <div>
                                  <p className="text-sm font-medium">{lineCourse ?? line.description}</p>
                                  {lineStudent && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Student: {lineStudent}</p>
                                  )}
                                  {linePayNum != null && lineTotalPay != null && (
                                    <p className="text-xs text-muted-foreground">
                                      Payment {linePayNum} of {lineTotalPay} monthly instalments
                                    </p>
                                  )}
                                </div>
                                <span className="font-medium text-sm ml-4 shrink-0">
                                  {formatCents(line.amount, line.currency)}
                                </span>
                              </div>
                              {idx < inv.lines.length - 1 && <Separator />}
                            </div>
                          );
                        })}
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center px-5 py-3 bg-primary text-primary-foreground rounded-b-xl">
                        <span className="text-sm font-bold uppercase tracking-wide">Total Amount</span>
                        <span className="text-lg font-bold">
                          {formatCents(isPaid ? inv.amountPaid : inv.amountDue, inv.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
