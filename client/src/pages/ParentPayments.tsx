import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentHistoryTable } from "@/components/PaymentHistoryTable";
import { LOGIN_PATH } from "@/const";

export default function ParentPayments() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: payments, isLoading } = trpc.parentProfile.getPayments.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="container py-8 space-y-6">
        <h1 className="text-3xl font-bold">Payments</h1>
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ) : (
          <PaymentHistoryTable payments={payments || []} />
        )}
      </div>
    </div>
  );
}
