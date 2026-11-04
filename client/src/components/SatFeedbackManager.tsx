import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { convertToCSV } from "../../../server/csv-export";

const parse = (s?: string | null): string[] => {
  try { return JSON.parse(s || "[]"); } catch { return []; }
};

const fmt = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

export function SatFeedbackManager() {
  const { data, isLoading } = trpc.satFeedback.list.useQuery();

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      "submitted", "name", "contact", "prepFeeling", "moreInFuture", "topicsHelp",
      "targetScore", "biggestChallenge", "referrals", "paidInterest",
      "testDate", "paidWants", "contactMethod",
    ];
    const rows = data.map((r) => ({
      ...r,
      submitted: fmt(r.createdAt),
      paidWants: parse(r.paidWants).join("; "),
      referrals: parse(r.referrals).join(" | "),
    }));
    const csv = "\uFEFF" + convertToCSV(rows, headers);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sat-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        No feedback yet. Responses from /sat-feedback will show up here.
      </CardContent></Card>
    );
  }

  const field = (label: string, value?: string | null) =>
    value ? <div><span className="text-muted-foreground">{label}: </span>{value}</div> : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          SAT Feedback <span className="text-muted-foreground font-normal">({data.length})</span>
        </h2>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {data.map((r) => (
        <Card key={r.id}>
          <CardContent className="py-4 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-base">{r.name}</div>
                <div className="text-muted-foreground">{r.contact} · {fmt(r.createdAt)}</div>
              </div>
              <Badge variant={r.paidInterest === "Yes, definitely" ? "default" : "secondary"}>
                {r.paidInterest}
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-1">
              {field("Target score", r.targetScore)}
              {field("Challenge", r.biggestChallenge)}
              {field("Prep feeling", r.prepFeeling)}
              {field("Test date", r.testDate)}
              {field("Best contact", r.contactMethod)}
              {field("Wants in paid program", parse(r.paidWants).join(", "))}
            </div>
            <details className="pt-1">
              <summary className="cursor-pointer text-primary">Full response</summary>
              <div className="mt-2 space-y-1">
                {field("Want more of", r.moreInFuture)}
                {field("Topics needing help", r.topicsHelp)}
                {field("Referrals", parse(r.referrals).join(" | "))}
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}