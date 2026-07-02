import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadsManager() {
  const { data: leads, isLoading, refetch } = trpc.admin.getLeads.useQuery();

  const updateStatus = trpc.admin.updateLeadStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleStatusChange = (id: number, status: string) => {
    updateStatus.mutate({ id, status: status as "new" | "contacted" });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No leads yet. Submissions from the website contact form will show up here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Leads <span className="text-muted-foreground font-normal">({leads.length})</span>
        </h2>
      </div>

      <div className="space-y-3">
        {leads.map((lead) => (
          <Card key={lead.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{lead.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Parent: {lead.parentName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={lead.status === "contacted" ? "default" : "secondary"}>
                    {lead.status === "contacted" ? "Contacted" : "New"}
                  </Badge>
                  <Select
                    value={lead.status}
                    onValueChange={(value) => handleStatusChange(lead.id, value)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                    {lead.email}
                  </a>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                    {lead.phone}
                  </a>
                </div>
                {lead.message && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Message: </span>
                    {lead.message}
                  </div>
                )}
                {lead.bestAvailability && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Best availability: </span>
                    {lead.bestAvailability}
                  </div>
                )}
                <div className="sm:col-span-2 text-xs text-muted-foreground pt-1">
                  Submitted {formatDate(lead.createdAt)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
