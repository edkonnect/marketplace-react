import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TutorSessionsTrend() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.session.myMonthlyTrend.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows = data ?? [];
  const sum = (items: typeof rows, key: "total" | "completed") =>
    items.reduce((s, d) => s + d[key], 0);

  const past = rows.slice(0, 6);
  const current = rows[6];
  const next = rows.slice(7);

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 container mx-auto px-4 pt-28 pb-12 max-w-4xl">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => setLocation("/tutor/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold">Sessions Trend</h1>
        <p className="text-muted-foreground mb-6">
          Last 6 months, this month and next 6 months (cancelled excluded)
        </p>

        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{sum(past, "total")}</span>
                  <p className="text-xs text-muted-foreground mt-1">{sum(past, "completed")} completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>This month</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{current?.total ?? 0}</span>
                  <p className="text-xs text-muted-foreground mt-1">{current?.completed ?? 0} completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Next 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{sum(next, "total")}</span>
                  <p className="text-xs text-muted-foreground mt-1">{sum(next, "completed")} completed</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Month by month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[1fr_90px_110px] text-xs font-medium text-muted-foreground border-b pb-2">
                  <span>Month</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Completed</span>
                </div>
                {rows.map((d, i) => (
                  <div
                    key={d.month}
                    className={`grid grid-cols-[1fr_90px_110px] py-3 text-sm border-b last:border-0 ${
                      i === 6 ? "bg-primary/5 font-medium" : ""
                    }`}
                  >
                    <span>
                      {d.month}
                      {i === 6 && <Badge variant="secondary" className="ml-2">This month</Badge>}
                    </span>
                    <span className="text-right">{d.total}</span>
                    <span className="text-right">{d.completed}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_90px_110px] pt-3 mt-1 border-t text-sm font-semibold">
                  <span>Total</span>
                  <span className="text-right">{sum(rows, "total")}</span>
                  <span className="text-right">{sum(rows, "completed")}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}